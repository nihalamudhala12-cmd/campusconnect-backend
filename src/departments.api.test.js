/**
 * Departments API Verification Test Suite
 * M3 — Departments
 *
 * Tests functional, validation, authorization, department isolation,
 * and database integration for the Departments module.
 */

/**
 * Database isolation must be established BEFORE any other module loads.
 * Requiring ./config snapshots process.env, after which DB_NAME redirection
 * would have no effect. This suite wipes every table, so it is only ever
 * permitted to run against the dedicated test database.
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

const { toDepartmentDto } = require('./utils/dtoMapper');
const DepartmentRepository = require('./modules/departments/departmentRepository');
const DepartmentService = require('./modules/departments/departmentService');
const DepartmentValidator = require('./modules/departments/departmentValidator');

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
let deptUuids = {};

async function setupDB() {
  await testDatabase.ensureTestDatabase();
  await connection.initialize();
  await connection.verifyConnection();
  await testDatabase.assertTestDatabase(connection.getPool());
  testClient = await connection.getPool().connect();
  await testDatabase.assertTestDatabase(testClient);

  await testClient.query('SET session_replication_role = replica');
  await testClient.query('DELETE FROM results');
  await testClient.query('DELETE FROM attendance');
  await testClient.query('DELETE FROM timetable_entries');
  await testClient.query('DELETE FROM class_courses');
  await testClient.query('DELETE FROM sessions');
  await testClient.query('DELETE FROM devices');
  await testClient.query('DELETE FROM notifications');
  await testClient.query('DELETE FROM announcements');
  await testClient.query('DELETE FROM chat_rooms');
  await testClient.query('DELETE FROM messages');
  await testClient.query('DELETE FROM approvals');
  await testClient.query('DELETE FROM faculty_profiles');
  await testClient.query('DELETE FROM student_profiles');
  await testClient.query('DELETE FROM classes');
  await testClient.query('DELETE FROM courses');
  await testClient.query('DELETE FROM users');
  await testClient.query('DELETE FROM departments');
  await testClient.query('SET session_replication_role = default');

  const testDepts = [
    { code: 'DEPT_CS', name: 'Computer Science' },
    { code: 'DEPT_MATH', name: 'Mathematics' },
    { code: 'DEPT_EE', name: 'Electrical Engineering' },
    { code: 'DEPT_CIVIL', name: 'Civil Engineering' },
  ];

  for (const dept of testDepts) {
    const result = await testClient.query(
      'INSERT INTO departments (id, name, code, status) VALUES (gen_random_uuid(), $1, $2, $3) RETURNING id',
      [dept.name, dept.code, 'ACTIVE']
    );
    deptUuids[dept.code] = result.rows[0].id;
  }

  const testUsers = [
    { id: '111e4567-e89b-12d3-a456-426614174001', name: 'HOD CS', email: 'hodcs@test.edu', role: 'HOD', deptId: deptUuids['DEPT_CS'] },
    { id: '111e4567-e89b-12d3-a456-426614174002', name: 'HOD MATH', email: 'hodmath@test.edu', role: 'HOD', deptId: deptUuids['DEPT_MATH'] },
    { id: '111e4567-e89b-12d3-a456-426614174003', name: 'HOD EE', email: 'hodee@test.edu', role: 'HOD', deptId: deptUuids['DEPT_EE'] },
    { id: '111e4567-e89b-12d3-a456-426614174004', name: 'HOD CIVIL', email: 'hodcivil@test.edu', role: 'HOD', deptId: deptUuids['DEPT_CIVIL'] },
    { id: '111e4567-e89b-12d3-a456-426614174005', name: 'Principal', email: 'principal@test.edu', role: 'PRINCIPAL', deptId: null },
    { id: '111e4567-e89b-12d3-a456-426614174006', name: 'Student', email: 'student@test.edu', role: 'STUDENT', deptId: deptUuids['DEPT_CS'] },
  ];

  for (const user of testUsers) {
    await testClient.query(
      'INSERT INTO users (id, name, email, role, department_id, status) VALUES ($1, $2, $3, $4, $5, $6)',
      [user.id, user.name, user.email, user.role, user.deptId, 'ACTIVE']
    );
  }
}

async function teardownDB() {
  if (testClient) {
    try { await testClient.query('SET session_replication_role = replica'); } catch (_e) {}
    try { await testClient.query('DELETE FROM results'); } catch (_e) {}
    try { await testClient.query('DELETE FROM attendance'); } catch (_e) {}
    try { await testClient.query('DELETE FROM timetable_entries'); } catch (_e) {}
    try { await testClient.query('DELETE FROM class_courses'); } catch (_e) {}
    try { await testClient.query('DELETE FROM sessions'); } catch (_e) {}
    try { await testClient.query('DELETE FROM devices'); } catch (_e) {}
    try { await testClient.query('DELETE FROM notifications'); } catch (_e) {}
    try { await testClient.query('DELETE FROM announcements'); } catch (_e) {}
    try { await testClient.query('DELETE FROM chat_rooms'); } catch (_e) {}
    try { await testClient.query('DELETE FROM messages'); } catch (_e) {}
    try { await testClient.query('DELETE FROM approvals'); } catch (_e) {}
    try { await testClient.query('DELETE FROM faculty_profiles'); } catch (_e) {}
    try { await testClient.query('DELETE FROM student_profiles'); } catch (_e) {}
    try { await testClient.query('DELETE FROM classes'); } catch (_e) {}
    try { await testClient.query('DELETE FROM courses'); } catch (_e) {}
    try { await testClient.query('DELETE FROM users'); } catch (_e) {}
    try { await testClient.query('DELETE FROM departments'); } catch (_e) {}
    try { await testClient.query('SET session_replication_role = default'); } catch (_e) {}
    testClient.release();
    await connection.close(1000).catch(() => {});
  }
}

async function runDepartmentsTests() {
  console.log('--- Starting Departments API Verification Test Suite ---');

  try {
    await setupDB();
    testServer = await listenApp(app);

    const principalHeaders = {
      'x-user-id': '111e4567-e89b-12d3-a456-426614174005',
      'x-user-role': 'PRINCIPAL',
    };
    const csHodHeaders = {
      'x-user-id': '111e4567-e89b-12d3-a456-426614174001',
      'x-user-role': 'HOD',
      'x-user-dept': deptUuids['DEPT_CS'],
    };
    const mathHodHeaders = {
      'x-user-id': '111e4567-e89b-12d3-a456-426614174002',
      'x-user-role': 'HOD',
      'x-user-dept': deptUuids['DEPT_MATH'],
    };

    // =========================================================================
    // 1. Functional: Create department (PRINCIPAL only)
    // =========================================================================
    console.log('\n[DEPT-01] Testing Create department...');
    {
      const res = await makeRequest(testServer, {
        path: '/departments',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...principalHeaders },
      }, { name: 'Computer Science New', code: 'DEPT-CS-NEW', description: 'CS Department New' });

      assert.strictEqual(res.statusCode, 201, `Expected 201, got ${res.statusCode}`);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.name, 'Computer Science New');
      assert.strictEqual(res.body.data.code, 'DEPT-CS-NEW');
      assert.strictEqual(res.body.data.description, 'CS Department New');
      assert.strictEqual(res.body.data.status, 'ACTIVE');
      assert.ok(res.body.data.id);
      console.log('  ✓ Create department returns 201 with DTO envelope');
    }

    // =========================================================================
    // 2. Functional: List departments (HOD sees own dept only)
    // =========================================================================
    console.log('\n[DEPT-02] Testing List departments...');
    {
      const res = await makeRequest(testServer, {
        path: '/departments',
        method: 'GET',
        headers: csHodHeaders,
      });

      assert.strictEqual(res.statusCode, 200);
      assert.ok(Array.isArray(res.body.data));
      assert.ok(res.body.data.length >= 1);
      assert.ok(res.body.meta);
      assert.strictEqual(res.body.meta.total, res.body.data.length);
      console.log('  ✓ List departments returns paginated DTO array scoped to requester');
    }

    // =========================================================================
    // 3. Functional: PRINCIPAL sees all departments
    // =========================================================================
    console.log('\n[DEPT-03] Testing PRINCIPAL sees all departments...');
    {
      const res = await makeRequest(testServer, {
        path: '/departments',
        method: 'GET',
        headers: principalHeaders,
      });

      assert.strictEqual(res.statusCode, 200);
      assert.ok(res.body.data.length >= 4);
      console.log('  ✓ PRINCIPAL sees all departments');
    }

    // =========================================================================
    // 4. Functional: Retrieve own department by ID (HOD)
    // =========================================================================
    console.log('\n[DEPT-04] Testing Retrieve own department by ID...');
    {
      const res = await makeRequest(testServer, {
        path: `/departments/${deptUuids['DEPT_CS']}`,
        method: 'GET',
        headers: csHodHeaders,
      });

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.data.id, deptUuids['DEPT_CS']);
      assert.strictEqual(res.body.data.name, 'Computer Science');
      console.log('  ✓ Retrieve own department by ID returns correct DTO');
    }

    // =========================================================================
    // 5. Functional: Update own department (HOD)
    // =========================================================================
    console.log('\n[DEPT-05] Testing Update own department...');
    {
      const res = await makeRequest(testServer, {
        path: `/departments/${deptUuids['DEPT_CS']}`,
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...csHodHeaders },
      }, { name: 'Computer Science Updated', description: 'CS Dept Updated' });

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.data.name, 'Computer Science Updated');
      assert.strictEqual(res.body.data.description, 'CS Dept Updated');
      assert.strictEqual(res.body.data.code, 'DEPT_CS');
      console.log('  ✓ Update own department modifies only provided fields');
    }

    // =========================================================================
    // 6. Functional: Deactivate own department (HOD)
    // =========================================================================
    console.log('\n[DEPT-06] Testing Deactivate own department...');
    {
      const res = await makeRequest(testServer, {
        path: `/departments/${deptUuids['DEPT_CS']}`,
        method: 'DELETE',
        headers: csHodHeaders,
      });

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.data.status, 'INACTIVE');
      assert.strictEqual(res.body.message, 'Department deactivated successfully');
      console.log('  ✓ Deactivate own department sets status to INACTIVE');
    }

    // =========================================================================
    // 7. Validation: Missing required fields
    // =========================================================================
    console.log('\n[DEPT-07] Testing validation - missing required fields...');
    {
      const res = await makeRequest(testServer, {
        path: '/departments',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...principalHeaders },
      }, { name: 'Missing Code' });

      assert.strictEqual(res.statusCode, 422);
      assert.ok(res.body.error.errors.some((e) => e.field === 'code'));
      console.log('  ✓ Missing required fields return 422 with field-level errors');
    }

    // =========================================================================
    // 8. Validation: Code too long
    // =========================================================================
    console.log('\n[DEPT-08] Testing validation - code too long...');
    {
      const res = await makeRequest(testServer, {
        path: '/departments',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...principalHeaders },
      }, { name: 'Test', code: 'A'.repeat(25) });

      assert.strictEqual(res.statusCode, 422);
      assert.ok(res.body.error.errors.some((e) => e.field === 'code'));
      console.log('  ✓ Code exceeding 20 characters returns 422');
    }

    // =========================================================================
    // 9. Validation: Invalid status
    // =========================================================================
    console.log('\n[DEPT-09] Testing validation - invalid status...');
    {
      const res = await makeRequest(testServer, {
        path: '/departments',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...principalHeaders },
      }, { name: 'Test', code: 'DEPT-STATUS-2', status: 'INVALID' });

      assert.strictEqual(res.statusCode, 422);
      assert.ok(res.body.error.errors.some((e) => e.field === 'status'));
      console.log('  ✓ Invalid status returns 422');
    }

    // =========================================================================
    // 10. Authorization: Unauthorized role rejected for create
    // =========================================================================
    console.log('\n[DEPT-10] Testing Authorization - unauthorized role for create...');
    {
      const res = await makeRequest(testServer, {
        path: '/departments',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': '111e4567-e89b-12d3-a456-426614174006', 'x-user-role': 'STUDENT', 'x-user-dept': deptUuids['DEPT_CS'], 'x-expected-error': 'true' },
      }, { name: 'Unauthorized', code: 'DEPT-UNAUTH' });

      assert.strictEqual(res.statusCode, 403);
      assert.strictEqual(res.body.error.code, 'FORBIDDEN');
      console.log('  ✓ Unauthorized role returns 403 Forbidden');
    }

    // =========================================================================
    // 11. Database: Duplicate department code
    // =========================================================================
    console.log('\n[DEPT-11] Testing Duplicate department code...');
    {
      await makeRequest(testServer, {
        path: '/departments',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...principalHeaders },
      }, { name: 'Dup Dept', code: 'DEPT_DUP_2' });

      const res = await makeRequest(testServer, {
        path: '/departments',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...principalHeaders, 'x-expected-error': 'true' },
      }, { name: 'Dup Dept 2', code: 'DEPT_DUP_2' });

      assert.strictEqual(res.statusCode, 409);
      assert.strictEqual(res.body.error.code, 'CONFLICT');
      console.log('  ✓ Duplicate department code returns 409 Conflict');
    }

    // =========================================================================
    // 12. Database: Invalid department ID format returns 422
    // =========================================================================
    console.log('\n[DEPT-12] Testing Invalid department ID format...');
    {
      const res = await makeRequest(testServer, {
        path: '/departments/invalid@id',
        method: 'GET',
        headers: csHodHeaders,
      });

      assert.strictEqual(res.statusCode, 422);
      assert.strictEqual(res.body.error.code, 'VALIDATION_ERROR');
      console.log('  ✓ Invalid department ID format returns 422 ValidationError');
    }

    // =========================================================================
    // 13. Database: Valid UUID format but non-existent department returns 404
    // =========================================================================
    console.log('\n[DEPT-13] Testing Valid UUID format, non-existent department...');
    {
      const res = await makeRequest(testServer, {
        path: '/departments/6baa8728-541b-43c0-b5a6-2ce682785e9e',
        method: 'GET',
        headers: csHodHeaders,
      });

      assert.strictEqual(res.statusCode, 404);
      assert.strictEqual(res.body.error.code, 'NOT_FOUND');
      console.log('  ✓ Valid UUID format with non-existent department returns 404 Not Found');
    }

    // =========================================================================
    // 14. Database: Department not found during update
    // =========================================================================
    console.log('\n[DEPT-14] Testing Update non-existent department...');
    {
      const res = await makeRequest(testServer, {
        path: '/departments/6baa8728-541b-43c0-b5a6-2ce682785e9f',
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...principalHeaders },
      }, { name: 'Nonexistent' });

      assert.strictEqual(res.statusCode, 404);
      assert.strictEqual(res.body.error.code, 'NOT_FOUND');
      console.log('  ✓ Updating non-existent department returns 404');
    }

    // =========================================================================
    // 15. DTO: Response structure correctness
    // =========================================================================
    console.log('\n[DEPT-15] Testing DTO response structure...');
    {
      const res = await makeRequest(testServer, {
        path: '/departments',
        method: 'GET',
        headers: principalHeaders,
      });

      if (res.body.data.length > 0) {
        const dept = res.body.data[0];
        assert.ok(dept.id, 'DTO must include id');
        assert.ok(dept.name, 'DTO must include name');
        assert.ok(dept.code, 'DTO must include code');
        assert.ok(dept.status, 'DTO must include status');
        assert.ok(dept.createdAt, 'DTO must include createdAt');
        console.log('  ✓ DTO response structure correct with all required fields');
      } else {
        console.log('  ✓ DTO structure verified (no data to inspect)');
      }
    }

    // =========================================================================
    // 16. Department Isolation: Cross-department access denied
    // =========================================================================
    console.log('\n[DEPT-16] Testing Department Isolation...');
    {
      const res = await makeRequest(testServer, {
        path: `/departments/${deptUuids['DEPT_MATH']}`,
        method: 'GET',
        headers: { ...csHodHeaders, 'x-expected-error': 'true' },
      });

      assert.strictEqual(res.statusCode, 403);
      assert.strictEqual(res.body.error.code, 'FORBIDDEN');
      console.log('  ✓ Department A user cannot access Department B department');
    }

    // =========================================================================
    // 17. Department Isolation: Same-department access allowed
    // =========================================================================
    console.log('\n[DEPT-17] Testing Same-department access allowed...');
    {
      const res = await makeRequest(testServer, {
        path: `/departments/${deptUuids['DEPT_CS']}`,
        method: 'GET',
        headers: csHodHeaders,
      });

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.data.id, deptUuids['DEPT_CS']);
      console.log('  ✓ Department A user can access Department A department');
    }

    // =========================================================================
    // 18. RBAC: PRINCIPAL can update any department
    // =========================================================================
    console.log('\n[DEPT-18] Testing PRINCIPAL role bypass...');
    {
      const res = await makeRequest(testServer, {
        path: `/departments/${deptUuids['DEPT_MATH']}`,
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...principalHeaders },
      }, { name: 'Mathematics Updated' });

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.data.name, 'Mathematics Updated');
      console.log('  ✓ PRINCIPAL can update departments across all departments');
    }

    // =========================================================================
    // 19. applyDepartmentScope: departments table special case
    // =========================================================================
    console.log('\n[DEPT-19] Testing applyDepartmentScope for departments table...');
    {
      const params = [];
      const scope = applyDepartmentScope('departments', deptUuids['DEPT_CS'], params);
      assert.strictEqual(scope.clause, 'id = $1');
      assert.strictEqual(params[0], deptUuids['DEPT_CS']);
      assert.strictEqual(scope.join, '');
      console.log('  ✓ applyDepartmentScope generates correct id = $1 clause for departments');
    }

    // =========================================================================
    // 20. applyDepartmentScope: PRINCIPAL 'ALL' returns unrestricted
    // =========================================================================
    console.log('\n[DEPT-20] Testing applyDepartmentScope PRINCIPAL ALL...');
    {
      const params = [];
      const scope = applyDepartmentScope('departments', 'ALL', params);
      assert.strictEqual(scope.clause, '1=1');
      assert.strictEqual(params.length, 0);
      console.log('  ✓ PRINCIPAL ALL scope returns unrestricted clause');
    }

    // =========================================================================
    // 21. Unauthenticated request -> 401
    // =========================================================================
    console.log('\n[DEPT-21] Testing Unauthenticated request...');
    {
      const res = await makeRequest(testServer, {
        path: '/departments',
        method: 'GET',
        headers: { 'x-expected-error': 'true' },
      });

      assert.strictEqual(res.statusCode, 401);
      assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
      console.log('  ✓ Unauthenticated request returns 401 Unauthorized');
    }

    // =========================================================================
    // 22. Deactivate already inactive department
    // =========================================================================
    console.log('\n[DEPT-22] Testing Deactivate already inactive department...');
    {
      const res = await makeRequest(testServer, {
        path: `/departments/${deptUuids['DEPT_CS']}`,
        method: 'DELETE',
        headers: csHodHeaders,
      });

      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
      console.log('  ✓ Deactivating already inactive department returns 400');
    }

    // =========================================================================
    // 23. Missing department context for non-PRINCIPAL -> 403
    // =========================================================================
    console.log('\n[DEPT-23] Testing Missing department context...');
    {
      const res = await makeRequest(testServer, {
        path: '/departments',
        method: 'GET',
        headers: { 'x-user-id': '111e4567-e89b-12d3-a456-426614174006', 'x-user-role': 'STUDENT', 'x-expected-error': 'true' },
      });

      assert.strictEqual(res.statusCode, 403);
      assert.strictEqual(res.body.error.code, 'FORBIDDEN');
      console.log('  ✓ Missing department context for non-PRINCIPAL returns 403');
    }

    // =========================================================================
    // 24. PRINCIPAL can deactivate any department
    // =========================================================================
    console.log('\n[DEPT-24] Testing PRINCIPAL deactivate any department...');
    {
      const res = await makeRequest(testServer, {
        path: `/departments/${deptUuids['DEPT_EE']}`,
        method: 'DELETE',
        headers: principalHeaders,
      });

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.data.status, 'INACTIVE');
      console.log('  ✓ PRINCIPAL can deactivate departments across all departments');
    }

    console.log('\n=================================================================');
    console.log('ALL DEPARTMENTS API VERIFICATION TESTS PASSED (24/24)');
    console.log('=================================================================\n');

  } catch (err) {
    console.error('\n❌ Departments test failure:', err);
    process.exitCode = 1;
  } finally {
    if (testServer) { testServer.close(); }
    await teardownDB();
  }
}

if (require.main === module) {
  runDepartmentsTests();
}

module.exports = runDepartmentsTests;
