/**
 * Attendance API Verification Test Suite
 * M6 — Attendance
 *
 * Tests functional, validation, authorization, department isolation,
 * duplicate handling, and database integration for the Attendance module.
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

const { toAttendanceDto } = require('./utils/dtoMapper');
const AttendanceRepository = require('./modules/attendance/attendanceRepository');
const AttendanceService = require('./modules/attendance/attendanceService');
const AttendanceValidator = require('./modules/attendance/attendanceValidator');

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

let testServer = null;
let testClient = null;
let deptUuids = {};
let classUuids = {};
let courseUuids = {};
let studentUuids = {};
let facultyUuids = {};

async function setupDB() {
  await testDatabase.ensureTestDatabase();
  await connection.initialize();
  await connection.verifyConnection();
  await testDatabase.assertTestDatabase(connection.getPool());
  testClient = connection.getPool();
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
    { id: '211e4567-e89b-12d3-a456-426614174001', name: 'HOD CS', email: 'hodcs@test.edu', role: 'HOD', deptId: deptUuids['DEPT_CS'] },
    { id: '211e4567-e89b-12d3-a456-426614174002', name: 'HOD MATH', email: 'hodmath@test.edu', role: 'HOD', deptId: deptUuids['DEPT_MATH'] },
    { id: '211e4567-e89b-12d3-a456-426614174003', name: 'Faculty CS', email: 'facultycs@test.edu', role: 'FACULTY', deptId: deptUuids['DEPT_CS'] },
    { id: '211e4567-e89b-12d3-a456-426614174004', name: 'Principal', email: 'principal@test.edu', role: 'PRINCIPAL', deptId: null },
    { id: '211e4567-e89b-12d3-a456-426614174005', name: 'Student CS 1', email: 'student1@test.edu', role: 'STUDENT', deptId: deptUuids['DEPT_CS'] },
    { id: '211e4567-e89b-12d3-a456-426614174006', name: 'Student CS 2', email: 'student2@test.edu', role: 'STUDENT', deptId: deptUuids['DEPT_CS'] },
    { id: '211e4567-e89b-12d3-a456-426614174007', name: 'Student MATH 1', email: 'studentmath@test.edu', role: 'STUDENT', deptId: deptUuids['DEPT_MATH'] },
  ];

  for (const user of testUsers) {
    await testClient.query(
      'INSERT INTO users (id, name, email, role, department_id, status) VALUES ($1, $2, $3, $4, $5, $6)',
      [user.id, user.name, user.email, user.role, user.deptId, 'ACTIVE']
    );
  }

  studentUuids['CS1'] = '211e4567-e89b-12d3-a456-426614174005';
  studentUuids['CS2'] = '211e4567-e89b-12d3-a456-426614174006';
  studentUuids['MATH1'] = '211e4567-e89b-12d3-a456-426614174007';
  facultyUuids['FAC_CS'] = '211e4567-e89b-12d3-a456-426614174003';
  facultyUuids['HOD_CS'] = '211e4567-e89b-12d3-a456-426614174001';
  facultyUuids['PRINCIPAL'] = '211e4567-e89b-12d3-a456-426614174004';

  await testClient.query(
    'INSERT INTO faculty_profiles (id, user_id, employee_id, designation, status) VALUES (gen_random_uuid(), $1, $2, $3, $4)',
    ['211e4567-e89b-12d3-a456-426614174003', 'EMP003', 'Assistant Professor', 'ACTIVE']
  );
  await testClient.query(
    'INSERT INTO faculty_profiles (id, user_id, employee_id, designation, status) VALUES (gen_random_uuid(), $1, $2, $3, $4)',
    ['211e4567-e89b-12d3-a456-426614174001', 'EMP001', 'HOD', 'ACTIVE']
  );

  await testClient.query(
    'INSERT INTO student_profiles (id, user_id, roll_number, admission_number, semester, status) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)',
    ['211e4567-e89b-12d3-a456-426614174005', 'ROLL001', 'ADM001', 3, 'ACTIVE']
  );
  await testClient.query(
    'INSERT INTO student_profiles (id, user_id, roll_number, admission_number, semester, status) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)',
    ['211e4567-e89b-12d3-a456-426614174006', 'ROLL002', 'ADM002', 3, 'ACTIVE']
  );
  await testClient.query(
    'INSERT INTO student_profiles (id, user_id, roll_number, admission_number, semester, status) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)',
    ['211e4567-e89b-12d3-a456-426614174007', 'ROLL003', 'ADM003', 1, 'ACTIVE']
  );

  const classResults = {};
  const classDefs = [
    { name: 'B.Tech CSE', code: 'CSE-BTECH', dept: 'DEPT_CS', semester: 3 },
    { name: 'B.Tech MATH', code: 'MATH-BTECH', dept: 'DEPT_MATH', semester: 1 },
    { name: 'M.Tech CSE', code: 'CSE-MTECH', dept: 'DEPT_CS', semester: 1 },
  ];

  for (const cls of classDefs) {
    const result = await testClient.query(
      'INSERT INTO classes (id, name, code, department_id, semester, status) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5) RETURNING id',
      [cls.name, cls.code, deptUuids[cls.dept], cls.semester, 'ACTIVE']
    );
    classUuids[cls.code] = result.rows[0].id;
  }

  const courseResults = {};
  const courseDefs = [
    { name: 'Data Structures', code: 'DS-CSE', dept: 'DEPT_CS' },
    { name: 'Algorithms', code: 'ALGO-CSE', dept: 'DEPT_CS' },
    { name: 'Calculus', code: 'CALC-MATH', dept: 'DEPT_MATH' },
  ];

  for (const co of courseDefs) {
    const result = await testClient.query(
      'INSERT INTO courses (id, name, code, department_id, status) VALUES (gen_random_uuid(), $1, $2, $3, $4) RETURNING id',
      [co.name, co.code, deptUuids[co.dept], 'ACTIVE']
    );
    courseUuids[co.code] = result.rows[0].id;
  }

  await testClient.query(
    'INSERT INTO class_courses (class_id, course_id) VALUES ($1, $2)',
    [classUuids['CSE-BTECH'], courseUuids['DS-CSE']]
  );
  await testClient.query(
    'INSERT INTO class_courses (class_id, course_id) VALUES ($1, $2)',
    [classUuids['CSE-BTECH'], courseUuids['ALGO-CSE']]
  );
  await testClient.query(
    'INSERT INTO class_courses (class_id, course_id) VALUES ($1, $2)',
    [classUuids['MATH-BTECH'], courseUuids['CALC-MATH']]
  );
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

async function runAttendanceTests() {
  console.log('--- Starting Attendance API Verification Test Suite ---');

  try {
    await setupDB();
    testServer = await listenApp(app);

    const csHodHeaders = {
      'x-user-id': '211e4567-e89b-12d3-a456-426614174001',
      'x-user-role': 'HOD',
      'x-user-dept': deptUuids['DEPT_CS'],
    };
    const csFacultyHeaders = {
      'x-user-id': '211e4567-e89b-12d3-a456-426614174003',
      'x-user-role': 'FACULTY',
      'x-user-dept': deptUuids['DEPT_CS'],
    };
    const principalHeaders = {
      'x-user-id': '211e4567-e89b-12d3-a456-426614174004',
      'x-user-role': 'PRINCIPAL',
    };

    // =========================================================================
    // 1. Functional: Create attendance record
    // =========================================================================
    console.log('\n[ATT-01] Testing Create attendance record...');
    {
      const res = await makeRequest(testServer, {
        path: '/attendance',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...csFacultyHeaders },
      }, {
        studentId: studentUuids['CS1'],
        facultyId: facultyUuids['FAC_CS'],
        classId: classUuids['CSE-BTECH'],
        courseId: courseUuids['DS-CSE'],
        attendanceDate: '2025-09-01',
        status: 'PRESENT',
        remarks: 'On time',
      });

      assert.strictEqual(res.statusCode, 201, `Expected 201, got ${res.statusCode}`);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.studentId, studentUuids['CS1']);
      assert.strictEqual(res.body.data.facultyId, facultyUuids['FAC_CS']);
      assert.strictEqual(res.body.data.classId, classUuids['CSE-BTECH']);
      assert.strictEqual(res.body.data.courseId, courseUuids['DS-CSE']);
      assert.strictEqual(res.body.data.attendanceDate, '2025-09-01');
      assert.strictEqual(res.body.data.status, 'PRESENT');
      assert.strictEqual(res.body.data.remarks, 'On time');
      assert.ok(res.body.data.id);
      console.log('  ✓ Create attendance returns 201 with DTO envelope');
    }

    // =========================================================================
    // 2. Functional: List attendance records
    // =========================================================================
    console.log('\n[ATT-02] Testing List attendance records...');
    {
      const res = await makeRequest(testServer, {
        path: '/attendance',
        method: 'GET',
        headers: csFacultyHeaders,
      });

      assert.strictEqual(res.statusCode, 200);
      assert.ok(Array.isArray(res.body.data));
      assert.ok(res.body.data.length >= 1);
      assert.ok(res.body.meta);
      console.log('  ✓ List attendance returns paginated DTO array');
    }

    // =========================================================================
    // 3. Functional: Retrieve attendance by ID
    // =========================================================================
    console.log('\n[ATT-03] Testing Retrieve attendance by ID...');
    {
      const createRes = await makeRequest(testServer, {
        path: '/attendance',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...csFacultyHeaders },
      }, {
        studentId: studentUuids['CS2'],
        facultyId: facultyUuids['FAC_CS'],
        classId: classUuids['CSE-BTECH'],
        courseId: courseUuids['ALGO-CSE'],
        attendanceDate: '2025-09-02',
        status: 'ABSENT',
      });

      const attendanceId = createRes.body.data.id;

      const res = await makeRequest(testServer, {
        path: `/attendance/${attendanceId}`,
        method: 'GET',
        headers: csFacultyHeaders,
      });

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.data.id, attendanceId);
      assert.strictEqual(res.body.data.status, 'ABSENT');
      console.log('  ✓ Retrieve attendance by ID returns correct DTO');
    }

    // =========================================================================
    // 4. Functional: Update attendance record
    // =========================================================================
    console.log('\n[ATT-04] Testing Update attendance record...');
    {
      const createRes = await makeRequest(testServer, {
        path: '/attendance',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...csFacultyHeaders },
      }, {
        studentId: studentUuids['CS1'],
        facultyId: facultyUuids['FAC_CS'],
        classId: classUuids['CSE-BTECH'],
        courseId: courseUuids['DS-CSE'],
        attendanceDate: '2025-09-03',
        status: 'LATE',
      });

      const attendanceId = createRes.body.data.id;

      const res = await makeRequest(testServer, {
        path: `/attendance/${attendanceId}`,
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...csFacultyHeaders },
      }, { status: 'PRESENT', remarks: 'Late but attended' });

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.data.status, 'PRESENT');
      assert.strictEqual(res.body.data.remarks, 'Late but attended');
      console.log('  ✓ Update attendance modifies only provided fields');
    }

    // =========================================================================
    // 5. Functional: Delete attendance record
    // =========================================================================
    console.log('\n[ATT-05] Testing Delete attendance record...');
    {
      const createRes = await makeRequest(testServer, {
        path: '/attendance',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...csFacultyHeaders },
      }, {
        studentId: studentUuids['CS1'],
        facultyId: facultyUuids['FAC_CS'],
        classId: classUuids['CSE-BTECH'],
        courseId: courseUuids['DS-CSE'],
        attendanceDate: '2025-09-04',
        status: 'PRESENT',
      });

      const attendanceId = createRes.body.data.id;

      const delRes = await makeRequest(testServer, {
        path: `/attendance/${attendanceId}`,
        method: 'DELETE',
        headers: csHodHeaders,
      });

      assert.strictEqual(delRes.statusCode, 200);
      assert.strictEqual(delRes.body.message, 'Attendance record deleted successfully');
      console.log('  ✓ Delete attendance removes record successfully');
    }

    // =========================================================================
    // 6. Database: Duplicate attendance record prevented
    // =========================================================================
    console.log('\n[ATT-06] Testing Duplicate attendance record prevented...');
    {
      await makeRequest(testServer, {
        path: '/attendance',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...csFacultyHeaders },
      }, {
        studentId: studentUuids['CS1'],
        facultyId: facultyUuids['FAC_CS'],
        classId: classUuids['CSE-BTECH'],
        courseId: courseUuids['DS-CSE'],
        attendanceDate: '2025-09-05',
        status: 'PRESENT',
      });

      const res = await makeRequest(testServer, {
        path: '/attendance',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...csFacultyHeaders, 'x-expected-error': 'true' },
      }, {
        studentId: studentUuids['CS1'],
        facultyId: facultyUuids['FAC_CS'],
        classId: classUuids['CSE-BTECH'],
        courseId: courseUuids['DS-CSE'],
        attendanceDate: '2025-09-05',
        status: 'ABSENT',
      });

      assert.strictEqual(res.statusCode, 409);
      assert.strictEqual(res.body.error.code, 'CONFLICT');
      console.log('  ✓ Duplicate attendance record returns 409 Conflict');
    }

    // =========================================================================
    // 7. Validation: Missing required fields
    // =========================================================================
    console.log('\n[ATT-07] Testing validation - missing required fields...');
    {
      const res = await makeRequest(testServer, {
        path: '/attendance',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...csFacultyHeaders },
      }, { studentId: studentUuids['CS1'] });

      assert.strictEqual(res.statusCode, 422);
      assert.ok(res.body.error.errors.some((e) => e.field === 'facultyId'));
      assert.ok(res.body.error.errors.some((e) => e.field === 'classId'));
      assert.ok(res.body.error.errors.some((e) => e.field === 'courseId'));
      assert.ok(res.body.error.errors.some((e) => e.field === 'attendanceDate'));
      assert.ok(res.body.error.errors.some((e) => e.field === 'status'));
      console.log('  ✓ Missing required fields return 422 with field-level errors');
    }

    // =========================================================================
    // 8. Validation: Invalid status
    // =========================================================================
    console.log('\n[ATT-08] Testing validation - invalid status...');
    {
      const res = await makeRequest(testServer, {
        path: '/attendance',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...csFacultyHeaders },
      }, {
        studentId: studentUuids['CS1'],
        facultyId: facultyUuids['FAC_CS'],
        classId: classUuids['CSE-BTECH'],
        courseId: courseUuids['DS-CSE'],
        attendanceDate: '2025-09-06',
        status: 'INVALID',
      });

      assert.strictEqual(res.statusCode, 422);
      assert.ok(res.body.error.errors.some((e) => e.field === 'status'));
      console.log('  ✓ Invalid status returns 422');
    }

    // =========================================================================
    // 9. Validation: Invalid date format
    // =========================================================================
    console.log('\n[ATT-09] Testing validation - invalid date format...');
    {
      const res = await makeRequest(testServer, {
        path: '/attendance',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...csFacultyHeaders },
      }, {
        studentId: studentUuids['CS1'],
        facultyId: facultyUuids['FAC_CS'],
        classId: classUuids['CSE-BTECH'],
        courseId: courseUuids['DS-CSE'],
        attendanceDate: '09-01-2025',
        status: 'PRESENT',
      });

      assert.strictEqual(res.statusCode, 422);
      assert.ok(res.body.error.errors.some((e) => e.field === 'attendanceDate'));
      console.log('  ✓ Invalid date format returns 422');
    }

    // =========================================================================
    // 10. Authorization: Unauthorized role rejected
    // =========================================================================
    console.log('\n[ATT-10] Testing Authorization - unauthorized role...');
    {
      const res = await makeRequest(testServer, {
        path: '/attendance',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': '211e4567-e89b-12d3-a456-426614174005', 'x-user-role': 'STUDENT', 'x-user-dept': deptUuids['DEPT_CS'], 'x-expected-error': 'true' },
      }, {
        studentId: studentUuids['CS1'],
        facultyId: facultyUuids['FAC_CS'],
        classId: classUuids['CSE-BTECH'],
        courseId: courseUuids['DS-CSE'],
        attendanceDate: '2025-09-07',
        status: 'PRESENT',
      });

      assert.strictEqual(res.statusCode, 403);
      assert.strictEqual(res.body.error.code, 'FORBIDDEN');
      console.log('  ✓ Unauthorized role returns 403 Forbidden');
    }

    // =========================================================================
    // 11. Department Isolation: Cross-department access denied
    // =========================================================================
    console.log('\n[ATT-11] Testing Department Isolation...');
    {
      const createRes = await makeRequest(testServer, {
        path: '/attendance',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...csFacultyHeaders },
      }, {
        studentId: studentUuids['CS1'],
        facultyId: facultyUuids['FAC_CS'],
        classId: classUuids['CSE-BTECH'],
        courseId: courseUuids['DS-CSE'],
        attendanceDate: '2025-09-08',
        status: 'PRESENT',
      });

      const attendanceId = createRes.body.data.id;

      const mathHodHeaders = {
        'x-user-id': '211e4567-e89b-12d3-a456-426614174002',
        'x-user-role': 'HOD',
        'x-user-dept': deptUuids['DEPT_MATH'],
      };

      const res = await makeRequest(testServer, {
        path: `/attendance/${attendanceId}`,
        method: 'GET',
        headers: { ...mathHodHeaders, 'x-expected-error': 'true' },
      });

      assert.strictEqual(res.statusCode, 403);
      assert.strictEqual(res.body.error.code, 'FORBIDDEN');
      console.log('  ✓ Department A user cannot access Department B attendance record');
    }

    // =========================================================================
    // 12. Department Isolation: Same-department access allowed
    // =========================================================================
    console.log('\n[ATT-12] Testing Same-department access allowed...');
    {
      const createRes = await makeRequest(testServer, {
        path: '/attendance',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...csFacultyHeaders },
      }, {
        studentId: studentUuids['CS1'],
        facultyId: facultyUuids['FAC_CS'],
        classId: classUuids['CSE-BTECH'],
        courseId: courseUuids['DS-CSE'],
        attendanceDate: '2025-09-09',
        status: 'PRESENT',
      });

      const attendanceId = createRes.body.data.id;

      const res = await makeRequest(testServer, {
        path: `/attendance/${attendanceId}`,
        method: 'GET',
        headers: csFacultyHeaders,
      });

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.data.id, attendanceId);
      console.log('  ✓ Department A user can access Department A attendance record');
    }

    // =========================================================================
    // 13. RBAC: PRINCIPAL bypass department scope
    // =========================================================================
    console.log('\n[ATT-13] Testing PRINCIPAL role bypass...');
    {
      const createRes = await makeRequest(testServer, {
        path: '/attendance',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...principalHeaders },
      }, {
        studentId: studentUuids['CS1'],
        facultyId: facultyUuids['FAC_CS'],
        classId: classUuids['CSE-BTECH'],
        courseId: courseUuids['DS-CSE'],
        attendanceDate: '2025-09-10',
        status: 'PRESENT',
      });

      const attendanceId = createRes.body.data.id;

      const res = await makeRequest(testServer, {
        path: `/attendance/${attendanceId}`,
        method: 'GET',
        headers: principalHeaders,
      });

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.data.id, attendanceId);
      console.log('  ✓ PRINCIPAL can access attendance across all departments');
    }

    // =========================================================================
    // 14. Database: Invalid attendance ID format returns 422
    // =========================================================================
    console.log('\n[ATT-14] Testing Invalid attendance ID format...');
    {
      const res = await makeRequest(testServer, {
        path: '/attendance/nonexistent-id',
        method: 'GET',
        headers: csFacultyHeaders,
      });

      assert.strictEqual(res.statusCode, 422);
      assert.strictEqual(res.body.error.code, 'VALIDATION_ERROR');
      console.log('  ✓ Invalid attendance ID format returns 422 ValidationError');
    }

    // =========================================================================
    // 15. Database: Valid UUID format but non-existent attendance returns 404
    // =========================================================================
    console.log('\n[ATT-15] Testing Valid UUID format, non-existent attendance...');
    {
      const res = await makeRequest(testServer, {
        path: '/attendance/6baa8728-541b-43c0-b5a6-2ce682785e9e',
        method: 'GET',
        headers: csFacultyHeaders,
      });

      assert.strictEqual(res.statusCode, 404);
      assert.strictEqual(res.body.error.code, 'NOT_FOUND');
      console.log('  ✓ Valid UUID format with non-existent attendance returns 404 Not Found');
    }

    // =========================================================================
    // 16. Database: Attendance not found during update
    // =========================================================================
    console.log('\n[ATT-16] Testing Update non-existent attendance...');
    {
      const res = await makeRequest(testServer, {
        path: '/attendance/6baa8728-541b-43c0-b5a6-2ce682785e9f',
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...csFacultyHeaders },
      }, { status: 'PRESENT' });

      assert.strictEqual(res.statusCode, 404);
      assert.strictEqual(res.body.error.code, 'NOT_FOUND');
      console.log('  ✓ Updating non-existent attendance returns 404');
    }

    // =========================================================================
    // 17. Database: Attendance not found during delete
    // =========================================================================
    console.log('\n[ATT-17] Testing Delete non-existent attendance...');
    {
      const res = await makeRequest(testServer, {
        path: '/attendance/6baa8728-541b-43c0-b5a6-2ce682785e9f',
        method: 'DELETE',
        headers: csHodHeaders,
      });

      assert.strictEqual(res.statusCode, 404);
      assert.strictEqual(res.body.error.code, 'NOT_FOUND');
      console.log('  ✓ Deleting non-existent attendance returns 404');
    }

    // =========================================================================
    // 18. Business Rules: Non-student user rejected
    // =========================================================================
    console.log('\n[ATT-18] Testing Business Rules - non-student user rejected...');
    {
      const res = await makeRequest(testServer, {
        path: '/attendance',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...csFacultyHeaders },
      }, {
        studentId: facultyUuids['FAC_CS'],
        facultyId: facultyUuids['FAC_CS'],
        classId: classUuids['CSE-BTECH'],
        courseId: courseUuids['DS-CSE'],
        attendanceDate: '2025-09-11',
        status: 'PRESENT',
      });

      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
      console.log('  ✓ Non-student user is rejected with 400');
    }

    // =========================================================================
    // 19. Business Rules: Non-faculty user rejected
    // =========================================================================
    console.log('\n[ATT-19] Testing Business Rules - non-faculty user rejected...');
    {
      const res = await makeRequest(testServer, {
        path: '/attendance',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...csFacultyHeaders },
      }, {
        studentId: studentUuids['CS1'],
        facultyId: studentUuids['CS1'],
        classId: classUuids['CSE-BTECH'],
        courseId: courseUuids['DS-CSE'],
        attendanceDate: '2025-09-12',
        status: 'PRESENT',
      });

      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
      console.log('  ✓ Non-faculty user is rejected with 400');
    }

    // =========================================================================
    // 20. Business Rules: Non-existent class rejected
    // =========================================================================
    console.log('\n[ATT-20] Testing Business Rules - non-existent class rejected...');
    {
      const res = await makeRequest(testServer, {
        path: '/attendance',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...csFacultyHeaders },
      }, {
        studentId: studentUuids['CS1'],
        facultyId: facultyUuids['FAC_CS'],
        classId: '6baa8728-541b-43c0-b5a6-2ce682785e9e',
        courseId: courseUuids['DS-CSE'],
        attendanceDate: '2025-09-13',
        status: 'PRESENT',
      });

      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
      console.log('  ✓ Non-existent class is rejected with 400');
    }

    // =========================================================================
    // 21. Business Rules: Non-existent course rejected
    // =========================================================================
    console.log('\n[ATT-21] Testing Business Rules - non-existent course rejected...');
    {
      const res = await makeRequest(testServer, {
        path: '/attendance',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...csFacultyHeaders },
      }, {
        studentId: studentUuids['CS1'],
        facultyId: facultyUuids['FAC_CS'],
        classId: classUuids['CSE-BTECH'],
        courseId: '6baa8728-541b-43c0-b5a6-2ce682785e9e',
        attendanceDate: '2025-09-14',
        status: 'PRESENT',
      });

      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
      console.log('  ✓ Non-existent course is rejected with 400');
    }

    // =========================================================================
    // 22. RBAC: FACULTY can read but HOD can also read
    // =========================================================================
    console.log('\n[ATT-22] Testing FACULTY read permissions...');
    {
      const getRes = await makeRequest(testServer, {
        path: '/attendance',
        method: 'GET',
        headers: csFacultyHeaders,
      });
      assert.strictEqual(getRes.statusCode, 200);
      console.log('  ✓ FACULTY can read attendance records');
    }

    // =========================================================================
    // 23. RBAC: FACULTY can create attendance
    // =========================================================================
    console.log('\n[ATT-23] Testing FACULTY create permissions...');
    {
      const res = await makeRequest(testServer, {
        path: '/attendance',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...csFacultyHeaders },
      }, {
        studentId: studentUuids['CS2'],
        facultyId: facultyUuids['FAC_CS'],
        classId: classUuids['CSE-BTECH'],
        courseId: courseUuids['ALGO-CSE'],
        attendanceDate: '2025-09-15',
        status: 'LATE',
      });

      assert.strictEqual(res.statusCode, 201);
      console.log('  ✓ FACULTY can create attendance records');
    }

    // =========================================================================
    // 24. Department Isolation: Cross-department class rejected
    // =========================================================================
    console.log('\n[ATT-24] Testing Cross-department class rejected...');
    {
      const mathHodHeaders = {
        'x-user-id': '211e4567-e89b-12d3-a456-426614174002',
        'x-user-role': 'HOD',
        'x-user-dept': deptUuids['DEPT_MATH'],
      };

      const res = await makeRequest(testServer, {
        path: '/attendance',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...mathHodHeaders, 'x-expected-error': 'true' },
      }, {
        studentId: studentUuids['CS1'],
        facultyId: facultyUuids['FAC_CS'],
        classId: classUuids['CSE-BTECH'],
        courseId: courseUuids['DS-CSE'],
        attendanceDate: '2025-09-16',
        status: 'PRESENT',
      });

      assert.strictEqual(res.statusCode, 403);
      assert.strictEqual(res.body.error.code, 'FORBIDDEN');
      console.log('  ✓ Cross-department class access rejected');
    }

    // =========================================================================
    // 25. DTO: Response structure correctness
    // =========================================================================
    console.log('\n[ATT-25] Testing DTO response structure...');
    {
      const createRes = await makeRequest(testServer, {
        path: '/attendance',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...csFacultyHeaders },
      }, {
        studentId: studentUuids['CS1'],
        facultyId: facultyUuids['FAC_CS'],
        classId: classUuids['CSE-BTECH'],
        courseId: courseUuids['DS-CSE'],
        attendanceDate: '2025-09-17',
        status: 'PRESENT',
      });

      const attendance = createRes.body.data;
      assert.ok(attendance.id, 'DTO must include id');
      assert.ok(attendance.studentId, 'DTO must include studentId');
      assert.ok(attendance.facultyId, 'DTO must include facultyId');
      assert.ok(attendance.classId, 'DTO must include classId');
      assert.ok(attendance.courseId, 'DTO must include courseId');
      assert.ok(attendance.attendanceDate, 'DTO must include attendanceDate');
      assert.ok(attendance.status, 'DTO must include status');
      assert.ok(attendance.createdAt, 'DTO must include createdAt');
      console.log('  ✓ DTO response structure correct with all required fields');
    }

    // =========================================================================
    // 26. applyDepartmentScope: attendance table generates correct JOIN
    // =========================================================================
    console.log('\n[ATT-26] Testing applyDepartmentScope for attendance...');
    {
      const params = [];
      const scope = applyDepartmentScope('attendance', deptUuids['DEPT_CS'], params, 'a');
      assert.strictEqual(scope.clause, 'classes_dept.department_id = $1');
      assert.ok(scope.join.includes('JOIN classes classes_dept ON a.class_id = classes_dept.id'));
      console.log('  ✓ applyDepartmentScope generates correct JOIN for attendance');
    }

    console.log('\n=================================================================');
    console.log('ALL ATTENDANCE API VERIFICATION TESTS PASSED (26/26)');
    console.log('=================================================================\n');

  } catch (err) {
    console.error('\n❌ Attendance test failure:', err);
    process.exitCode = 1;
  } finally {
    if (testServer) { testServer.close(); }
    await teardownDB();
  }
}

if (require.main === module) {
  runAttendanceTests();
}

module.exports = runAttendanceTests;



