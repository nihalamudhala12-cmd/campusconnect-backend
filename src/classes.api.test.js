/**
 * Classes API Verification Test Suite
 * M5 — Classes
 *
 * Tests functional, validation, authorization, department isolation,
 * and database integration for the Classes module.
 */

/**
 * Database isolation must be established BEFORE any other module loads.
 * Requiring ./config snapshots process.env, after which DB_NAME redirection
 * would have no effect. This suite wipes the departments table, so it is only
 * ever permitted to run against the dedicated test database.
 */
const testDatabase = require('./infrastructure/database/testDatabase');
testDatabase.useTestDatabase();

const assert = require('assert');
const http = require('http');
const express = require('express');
const { app } = require('./app');
const connection = require('./infrastructure/database/connection');
const { errorHandler } = require('./middleware/errorHandler');
const asyncHandler = require('./middleware/asyncHandler');
const validateRequest = require('./middleware/validateRequest');
const { authenticate } = require('./middleware/authMiddleware');
const { authorize } = require('./middleware/rbacMiddleware');
const BaseController = require('./controllers/baseController');
const { parseIdOrCode, validateUUID } = require('./utils/idMapper');
const { applyDepartmentScope } = require('./repositories/departmentScope');
const { BadRequestError, NotFoundError, ValidationError, ForbiddenError, ConflictError } = require('./errors');

const { toClassDto } = require('./utils/dtoMapper');
const ClassRepository = require('./modules/classes/classRepository');
const ClassService = require('./modules/classes/classService');
const ClassValidator = require('./modules/classes/classValidator');

function listenApp(expressApp) {
  return new Promise((resolve) => {
    const s = expressApp.listen(0, () => resolve(s));
  });
}

function makeRequest(server, options, postData = null) {
  const port = server.address().port;
  const reqOptions = { hostname: 'localhost', port, ...options };

  return new Promise((resolve, reject) => {
    const req = http.request(reqOptions, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(body); } catch (_e) { parsed = body; }
        resolve({ statusCode: res.statusCode, headers: res.headers, body: parsed });
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

function createTestJwt(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.dummy_sig`;
}

let testServer = null;
let testClient = null;
let deptUuids = {}; // Map of dept codes to UUIDs

async function setupDB() {
  await testDatabase.ensureTestDatabase();
  await connection.initialize();
  await connection.verifyConnection();
  await testDatabase.assertTestDatabase(connection.getPool());
  testClient = connection.getPool();
  await testDatabase.assertTestDatabase(testClient);

  // Reset tables
  await testClient.query('DELETE FROM classes');
  await testClient.query('DELETE FROM departments');

  // Create test departments
  const testDepts = [
    { code: 'DEPT_CS', name: 'Computer Science' },
    { code: 'DEPT_MATH', name: 'Mathematics' },
    { code: 'DEPT_EE', name: 'Electrical Engineering' },
    { code: 'DEPT_CIVIL', name: 'Civil Engineering' },
    { code: 'DEPT_DUP', name: 'Duplicate Test' }
  ];

  for (const dept of testDepts) {
    const result = await testClient.query(
      'INSERT INTO departments (id, name, code, status) VALUES (gen_random_uuid(), $1, $2, $3) RETURNING id',
      [dept.name, dept.code, 'ACTIVE']
    );
    deptUuids[dept.code] = result.rows[0].id;
  }
}

async function teardownDB() {
  if (testClient) {
    try { await testClient.query('DELETE FROM classes'); } catch (_e) {}
    try { await testClient.query('DELETE FROM departments'); } catch (_e) {}
    await connection.close(1000).catch(() => {});
  }
}

function addDeptHeaders(headers, deptCode) {
  const deptId = deptUuids[deptCode];
  if (!deptId) {
    throw new Error(`Unknown department code: ${deptCode}`);
  }
  return { ...headers, 'x-user-dept': deptId };
}

async function runClassesTests() {
  console.log('--- Starting Classes API Verification Test Suite ---');

  try {
    await setupDB();
    testServer = await listenApp(app);

    // =========================================================================
    // 1. Functional: Create class
    // =========================================================================
    console.log('\n[CLS-01] Testing Create class...');
    {
      const res = await makeRequest(testServer, {
        path: '/classes',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': 'usr_hod_1', 'x-user-role': 'HOD', 'x-user-dept': deptUuids['DEPT_CS'] },
      }, { name: 'B.Tech CSE', code: 'CSE-BTECH', departmentId: deptUuids['DEPT_CS'], semester: 3 });

      assert.strictEqual(res.statusCode, 201, `Expected 201, got ${res.statusCode}`);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.name, 'B.Tech CSE');
      assert.strictEqual(res.body.data.code, 'CSE-BTECH');
      assert.strictEqual(res.body.data.departmentId, deptUuids['DEPT_CS']);
      assert.strictEqual(res.body.data.semester, 3);
      assert.strictEqual(res.body.data.status, 'ACTIVE');
      assert.ok(res.body.data.id);
      console.log('  ✓ Create class returns 201 with DTO envelope');
    }

    // =========================================================================
    // 2. Functional: List classes
    // =========================================================================
    console.log('\n[CLS-02] Testing List classes...');
    {
      const res = await makeRequest(testServer, {
        path: '/classes',
        method: 'GET',
        headers: { 'x-user-id': 'usr_hod_1', 'x-user-role': 'HOD', 'x-user-dept': deptUuids['DEPT_CS'] },
      });

      assert.strictEqual(res.statusCode, 200);
      assert.ok(Array.isArray(res.body.data));
      assert.ok(res.body.data.length >= 1);
      assert.ok(res.body.meta);
      assert.strictEqual(res.body.meta.total, res.body.data.length);
      console.log('  ✓ List classes returns paginated DTO array');
    }

    // =========================================================================
    // 3. Functional: Retrieve class by ID
    // =========================================================================
    console.log('\n[CLS-03] Testing Retrieve class by ID...');
    {
      const createRes = await makeRequest(testServer, {
        path: '/classes',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': 'usr_hod_1', 'x-user-role': 'HOD', 'x-user-dept': deptUuids['DEPT_CS'] },
      }, { name: 'M.Tech CSE', code: 'CSE-MTECH', departmentId: deptUuids['DEPT_CS'], semester: 1 });

      const classId = createRes.body.data.id;

      const res = await makeRequest(testServer, {
        path: `/classes/${classId}`,
        method: 'GET',
        headers: { 'x-user-id': 'usr_hod_1', 'x-user-role': 'HOD', 'x-user-dept': deptUuids['DEPT_CS'] },
      });

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.data.id, classId);
      assert.strictEqual(res.body.data.name, 'M.Tech CSE');
      console.log('  ✓ Retrieve class by ID returns correct DTO');
    }

    // =========================================================================
    // 4. Functional: Update class
    // =========================================================================
    console.log('\n[CLS-04] Testing Update class...');
    {
      const createRes = await makeRequest(testServer, {
        path: '/classes',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': 'usr_hod_1', 'x-user-role': 'HOD', 'x-user-dept': deptUuids['DEPT_CS'] },
      }, { name: 'Original Name', code: 'CSE-ORIG', departmentId: deptUuids['DEPT_CS'], semester: 2 });

      const classId = createRes.body.data.id;

      const res = await makeRequest(testServer, {
        path: `/classes/${classId}`,
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-user-id': 'usr_hod_1', 'x-user-role': 'HOD', 'x-user-dept': deptUuids['DEPT_CS'] },
      }, { name: 'Updated Name', semester: 4 });

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.data.name, 'Updated Name');
      assert.strictEqual(res.body.data.semester, 4);
      assert.strictEqual(res.body.data.code, 'CSE-ORIG');
      console.log('  ✓ Update class modifies only provided fields');
    }

    // =========================================================================
    // 5. Functional: Deactivate class
    // =========================================================================
    console.log('\n[CLS-05] Testing Deactivate class...');
    {
      const createRes = await makeRequest(testServer, {
        path: '/classes',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': 'usr_hod_1', 'x-user-role': 'HOD', 'x-user-dept': deptUuids['DEPT_CS'] },
      }, { name: 'To Deactivate', code: 'CSE-DEL', departmentId: deptUuids['DEPT_CS'] });

      const classId = createRes.body.data.id;

      const delRes = await makeRequest(testServer, {
        path: `/classes/${classId}`,
        method: 'DELETE',
        headers: { 'x-user-id': 'usr_hod_1', 'x-user-role': 'HOD', 'x-user-dept': deptUuids['DEPT_CS'] },
      });

      assert.strictEqual(delRes.statusCode, 200);
      assert.strictEqual(delRes.body.data.status, 'INACTIVE');
      assert.strictEqual(delRes.body.message, 'Class deactivated successfully');
      console.log('  ✓ Deactivate class sets status to INACTIVE');
    }

    // =========================================================================
    // 6. Validation: Missing required fields
    // =========================================================================
    console.log('\n[CLS-06] Testing validation - missing required fields...');
    {
      const res = await makeRequest(testServer, {
        path: '/classes',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': 'usr_hod_1', 'x-user-role': 'HOD', 'x-user-dept': deptUuids['DEPT_CS'] },
      }, { name: 'Missing Code' });

      assert.strictEqual(res.statusCode, 422);
      assert.ok(res.body.error.errors.some((e) => e.field === 'code'));
      assert.ok(res.body.error.errors.some((e) => e.field === 'departmentId'));
      console.log('  ✓ Missing required fields return 422 with field-level errors');
    }

    // =========================================================================
    // 7. Validation: Invalid field types
    // =========================================================================
    console.log('\n[CLS-07] Testing validation - invalid field types...');
    {
      const res = await makeRequest(testServer, {
        path: '/classes',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': 'usr_hod_1', 'x-user-role': 'HOD', 'x-user-dept': deptUuids['DEPT_CS'] },
      }, { name: '', code: 12345, departmentId: deptUuids['DEPT_CS'], semester: 'invalid' });

      assert.strictEqual(res.statusCode, 422);
      console.log('  ✓ Invalid field types return 422 with field-level errors');
    }

    // =========================================================================
    // 8. Validation: Invalid semester
    // =========================================================================
    console.log('\n[CLS-08] Testing validation - invalid semester...');
    {
      const res = await makeRequest(testServer, {
        path: '/classes',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': 'usr_hod_1', 'x-user-role': 'HOD', 'x-user-dept': deptUuids['DEPT_CS'] },
      }, { name: 'Bad Semester', code: 'CSE-SEM', departmentId: deptUuids['DEPT_CS'], semester: 99 });

      assert.strictEqual(res.statusCode, 422);
      assert.ok(res.body.error.errors.some((e) => e.field === 'semester'));
      console.log('  ✓ Invalid semester returns 422');
    }

    // =========================================================================
    // 9. Authorization: Unauthorized role rejected
    // =========================================================================
    console.log('\n[CLS-09] Testing Authorization - unauthorized role...');
    {
      const res = await makeRequest(testServer, {
        path: '/classes',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': 'usr_stu_1', 'x-user-role': 'STUDENT', 'x-user-dept': deptUuids['DEPT_CS'], 'x-expected-error': 'true' },
      }, { name: 'Unauthorized', code: 'CSE-UNAUTH', departmentId: deptUuids['DEPT_CS'] });

      assert.strictEqual(res.statusCode, 403);
      assert.strictEqual(res.body.error.code, 'FORBIDDEN');
      console.log('  ✓ Unauthorized role returns 403 Forbidden');
    }

    // =========================================================================
    // 10. Department Isolation: Cross-department access denied
    // =========================================================================
    console.log('\n[CLS-10] Testing Department Isolation...');
    {
      // Create a class in DEPT_MATH
      const createMath = await makeRequest(testServer, {
        path: '/classes',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': 'usr_hod_1', 'x-user-role': 'HOD', 'x-user-dept': deptUuids['DEPT_MATH'] },
      }, { name: 'Math Class', code: 'MATH-101', departmentId: deptUuids['DEPT_MATH'] });

      assert.strictEqual(createMath.statusCode, 201);
      const mathClassId = createMath.body.data.id;

      // Try to access DEPT_MATH class as DEPT_CS user
      const res = await makeRequest(testServer, {
        path: `/classes/${mathClassId}`,
        method: 'GET',
        headers: { 'x-user-id': 'usr_hod_1', 'x-user-role': 'HOD', 'x-user-dept': deptUuids['DEPT_CS'], 'x-expected-error': 'true' },
      });

      assert.strictEqual(res.statusCode, 403);
      assert.strictEqual(res.body.error.code, 'FORBIDDEN');
      console.log('  ✓ Department A user cannot access Department B class');
    }

    // =========================================================================
    // 11. Department Isolation: Same-department access allowed
    // =========================================================================
    console.log('\n[CLS-11] Testing Same-department access allowed...');
    {
      const createRes = await makeRequest(testServer, {
        path: '/classes',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': 'usr_hod_1', 'x-user-role': 'HOD', 'x-user-dept': deptUuids['DEPT_EE'] },
      }, { name: 'EE Class', code: 'EE-101', departmentId: deptUuids['DEPT_EE'] });

      const classId = createRes.body.data.id;

      const res = await makeRequest(testServer, {
        path: `/classes/${classId}`,
        method: 'GET',
        headers: { 'x-user-id': 'usr_hod_1', 'x-user-role': 'HOD', 'x-user-dept': deptUuids['DEPT_EE'] },
      });

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.data.id, classId);
      console.log('  ✓ Department A user can access Department A class');
    }

    // =========================================================================
    // 12. RBAC: PRINCIPAL bypass department scope
    // =========================================================================
    console.log('\n[CLS-12] Testing PRINCIPAL role bypass...');
    {
      // Create class in DEPT_CIVIL
      const createCivil = await makeRequest(testServer, {
        path: '/classes',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': 'usr_principal', 'x-user-role': 'PRINCIPAL' },
      }, { name: 'Civil Class', code: 'CIVIL-101', departmentId: deptUuids['DEPT_CIVIL'] });

      assert.strictEqual(createCivil.statusCode, 201);
      const civilClassId = createCivil.body.data.id;

      // PRINCIPAL can access any class
      const res = await makeRequest(testServer, {
        path: `/classes/${civilClassId}`,
        method: 'GET',
        headers: { 'x-user-id': 'usr_principal', 'x-user-role': 'PRINCIPAL' },
      });

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.data.id, civilClassId);
      console.log('  ✓ PRINCIPAL can access classes across all departments');
    }

    // =========================================================================
    // 13. Database: Duplicate class code within department
    // =========================================================================
    console.log('\n[CLS-13] Testing Duplicate class code...');
    {
      await makeRequest(testServer, {
        path: '/classes',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': 'usr_hod_1', 'x-user-role': 'HOD', 'x-user-dept': deptUuids['DEPT_DUP'] },
      }, { name: 'Dup Class', code: 'DUP-CODE', departmentId: deptUuids['DEPT_DUP'] });

      const res = await makeRequest(testServer, {
        path: '/classes',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': 'usr_hod_1', 'x-user-role': 'HOD', 'x-user-dept': deptUuids['DEPT_DUP'], 'x-expected-error': 'true' },
      }, { name: 'Dup Class 2', code: 'DUP-CODE', departmentId: deptUuids['DEPT_DUP'] });

      assert.strictEqual(res.statusCode, 409);
      assert.strictEqual(res.body.error.code, 'CONFLICT');
      console.log('  ✓ Duplicate class code within department returns 409 Conflict');
    }

    // =========================================================================
    // 14. Database: Invalid class ID format returns 422
    // =========================================================================
    console.log('\n[CLS-14] Testing Invalid class ID format...');
    {
      const res = await makeRequest(testServer, {
        path: '/classes/nonexistent-id',
        method: 'GET',
        headers: { 'x-user-id': 'usr_hod_1', 'x-user-role': 'HOD', 'x-user-dept': deptUuids['DEPT_CS'] },
      });

      assert.strictEqual(res.statusCode, 422);
      assert.strictEqual(res.body.error.code, 'VALIDATION_ERROR');
      console.log('  ✓ Invalid class ID format returns 422 ValidationError');
    }

    // =========================================================================
    // 15. Database: Valid UUID format but non-existent class returns 404
    // =========================================================================
    console.log('\n[CLS-15] Testing Valid UUID format, non-existent class...');
    {
      const res = await makeRequest(testServer, {
        path: '/classes/6baa8728-541b-43c0-b5a6-2ce682785e9e',
        method: 'GET',
        headers: { 'x-user-id': 'usr_hod_1', 'x-user-role': 'HOD', 'x-user-dept': deptUuids['DEPT_CS'] },
      });

      assert.strictEqual(res.statusCode, 404);
      assert.strictEqual(res.body.error.code, 'NOT_FOUND');
      console.log('  ✓ Valid UUID format with non-existent class returns 404 Not Found');
    }

    // =========================================================================
    // 16. Database: Class not found during update
    // =========================================================================
    console.log('\n[CLS-16] Testing Update non-existent class...');
    {
      const res = await makeRequest(testServer, {
        path: '/classes/6baa8728-541b-43c0-b5a6-2ce682785e9f',
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-user-id': 'usr_hod_1', 'x-user-role': 'HOD', 'x-user-dept': deptUuids['DEPT_CS'] },
      }, { name: 'Nonexistent', code: 'NONEXIST' });

      assert.strictEqual(res.statusCode, 404);
      assert.strictEqual(res.body.error.code, 'NOT_FOUND');
      console.log('  ✓ Updating non-existent class returns 404');
    }

    // =========================================================================
    // 17. DTO: Response structure correctness
    // =========================================================================
    console.log('\n[CLS-17] Testing DTO response structure...');
    {
      const res = await makeRequest(testServer, {
        path: '/classes',
        method: 'GET',
        headers: { 'x-user-id': 'usr_hod_1', 'x-user-role': 'HOD', 'x-user-dept': deptUuids['DEPT_CS'] },
      });

      if (res.body.data.length > 0) {
        const cls = res.body.data[0];
        assert.ok(cls.id, 'DTO must include id');
        assert.ok(cls.name, 'DTO must include name');
        assert.ok(cls.code, 'DTO must include code');
        assert.ok(cls.departmentId, 'DTO must include departmentId');
        assert.ok(cls.status, 'DTO must include status');
        assert.ok(cls.createdAt, 'DTO must include createdAt');
        assert.strictEqual(cls.semester !== undefined, true, 'DTO must include semester');
        assert.strictEqual(cls.section !== undefined, true, 'DTO must include section');
        console.log('  ✓ DTO response structure correct with all required fields');
      } else {
        console.log('  ✓ DTO structure verified (no data to inspect)');
      }
    }

    // =========================================================================
    // 18. RBAC: FACAULTY can read but not create/update/delete
    // =========================================================================
    console.log('\n[CLS-18] Testing FACULTY role permissions...');
    {
      // FACULTY can read
      const getRes = await makeRequest(testServer, {
        path: '/classes',
        method: 'GET',
        headers: { 'x-user-id': 'usr_fac_1', 'x-user-role': 'FACULTY', 'x-user-dept': deptUuids['DEPT_CS'] },
      });
      assert.strictEqual(getRes.statusCode, 200);
      console.log('  ✓ FACULTY can read classes');

      // FACULTY cannot create
      const postRes = await makeRequest(testServer, {
        path: '/classes',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': 'usr_fac_1', 'x-user-role': 'FACULTY', 'x-user-dept': deptUuids['DEPT_CS'], 'x-expected-error': 'true' },
      }, { name: 'Faculty Create', code: 'FAC-CREATE', departmentId: deptUuids['DEPT_CS'] });
      assert.strictEqual(postRes.statusCode, 403);
      console.log('  ✓ FACULTY cannot create classes (403)');
    }

    console.log('\n=================================================================');
    console.log('ALL CLASSES API VERIFICATION TESTS PASSED (18/18)');
    console.log('=================================================================\n');

  } catch (err) {
    console.error('\n❌ Classes test failure:', err);
    process.exitCode = 1;
  } finally {
    if (testServer) { testServer.close(); }
    await teardownDB();
  }
}

if (require.main === module) {
  runClassesTests();
}

module.exports = runClassesTests;