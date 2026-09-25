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
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const config = require('./config');
const { app } = require('./app');
const connection = require('./infrastructure/database/connection');

const uuidv4 = () => crypto.randomUUID();

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

function createDummyJwt(payload) {
  const secret = config.security.jwtSecret;
  if (!secret) {
    throw new Error('JWT_SECRET is not configured. Cannot create test JWT.');
  }
  return jwt.sign(payload, secret, { algorithm: 'HS256', expiresIn: '1h' });
}

async function runModuleSecurityTests() {
  console.log('--- Starting Module Security Verification Test Suite ---\n');
  let passed = 0;
  let failed = 0;
  let testServer = null;
  let testClient = null;

  try {
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

    testServer = await listenApp(app);

    // Create test departments
    const dept1Id = uuidv4();
    const dept2Id = uuidv4();
    await testClient.query(
      'INSERT INTO departments (id, name, code, status) VALUES ($1, $2, $3, $4)',
      [dept1Id, 'Computer Science', 'CS', 'ACTIVE']
    );
    await testClient.query(
      'INSERT INTO departments (id, name, code, status) VALUES ($1, $2, $3, $4)',
      [dept2Id, 'Mathematics', 'MATH', 'ACTIVE']
    );

    // Create test users
    const principalId = uuidv4();
    const hodId = uuidv4();
    const facultyId = uuidv4();
    const studentId = uuidv4();
    const hod2Id = uuidv4();

    await testClient.query(
      'INSERT INTO users (id, name, email, role, department_id, status, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [principalId, 'Principal', 'principal@test.com', 'PRINCIPAL', null, 'ACTIVE', '2024-01-01']
    );
    await testClient.query(
      'INSERT INTO users (id, name, email, role, department_id, status, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [hodId, 'HOD CS', 'hod@test.com', 'HOD', dept1Id, 'ACTIVE', '2024-01-01']
    );
    await testClient.query(
      'INSERT INTO users (id, name, email, role, department_id, status, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [facultyId, 'Faculty', 'faculty@test.com', 'FACULTY', dept1Id, 'ACTIVE', '2024-01-01']
    );
    await testClient.query(
      'INSERT INTO users (id, name, email, role, department_id, status, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [studentId, 'Student', 'student@test.com', 'STUDENT', dept1Id, 'ACTIVE', '2024-01-01']
    );
    await testClient.query(
      'INSERT INTO users (id, name, email, role, department_id, status, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [hod2Id, 'HOD Math', 'hod2@test.com', 'HOD', dept2Id, 'ACTIVE', '2024-01-01']
    );

    // Create faculty and student profiles
    await testClient.query(
      'INSERT INTO faculty_profiles (id, user_id, designation, status) VALUES ($1, $2, $3, $4)',
      [uuidv4(), facultyId, 'Professor', 'ACTIVE']
    );
    await testClient.query(
      'INSERT INTO student_profiles (id, user_id, roll_number, status) VALUES ($1, $2, $3, $4)',
      [uuidv4(), studentId, 'STU001', 'ACTIVE']
    );

    // Create course and class
    const courseId = uuidv4();
    const classId = uuidv4();
    await testClient.query(
      'INSERT INTO courses (id, name, code, department_id, status) VALUES ($1, $2, $3, $4, $5)',
      [courseId, 'Data Structures', 'CS101', dept1Id, 'ACTIVE']
    );
    await testClient.query(
      'INSERT INTO classes (id, name, code, department_id, status) VALUES ($1, $2, $3, $4, $5)',
      [classId, 'CS Section A', 'CS-A', dept1Id, 'ACTIVE']
    );

    const principal = { id: principalId, role: 'PRINCIPAL', department_id: null };
    const hod = { id: hodId, role: 'HOD', department_id: dept1Id };
    const faculty = { id: facultyId, role: 'FACULTY', department_id: dept1Id };
    const student = { id: studentId, role: 'STUDENT', department_id: dept1Id };
    const hod2 = { id: hod2Id, role: 'HOD', department_id: dept2Id };

    function headersFor(user) {
      return {
        'x-user-id': user.id,
        'x-user-role': user.role,
        'x-user-dept': user.department_id || 'ALL',
      };
    }

    async function api(method, path, body, headers, expectedStatus) {
      const requestHeaders = { 'Content-Type': 'application/json', ...headers };
      if (expectedStatus) {
        requestHeaders['x-expected-error'] = 'true';
      }
      return makeRequest(testServer, {
        method,
        path,
        headers: requestHeaders,
      }, body);
    }

    // ==================== SESSIONS MODULE ====================
    console.log('--- Sessions Module Security Tests ---\n');

    const allSessions = await api('GET', '/sessions', null, headersFor(principal));
    if (allSessions.statusCode === 200 && Array.isArray(allSessions.body?.data)) {
      passed++;
      console.log('[SESSION-01] PASS: PRINCIPAL can list all sessions');
    } else {
      failed++;
      console.log(`[SESSION-01] FAIL: PRINCIPAL could not list sessions (status=${allSessions.statusCode})`);
    }

    const hodSessions = await api('GET', '/sessions', null, headersFor(hod));
    if (hodSessions.statusCode === 200 && Array.isArray(hodSessions.body?.data)) {
      const allOwn = hodSessions.body.data.every(s => s.user_id === hod.id);
      if (allOwn) {
        passed++;
        console.log('[SESSION-02] PASS: HOD can only list own sessions');
      } else {
        failed++;
        console.log('[SESSION-02] FAIL: HOD listed sessions belonging to other users');
      }
    } else {
      failed++;
      console.log(`[SESSION-02] FAIL: HOD could not list sessions (status=${hodSessions.statusCode})`);
    }

    const unauthSessions = await api('GET', '/sessions', null, {}, 401);
    if (unauthSessions.statusCode === 401) {
      passed++;
      console.log('[SESSION-03] PASS: Unauthenticated blocked from sessions');
    } else {
      failed++;
      console.log(`[SESSION-03] FAIL: Unauthenticated access to sessions (status=${unauthSessions.statusCode})`);
    }

    // ==================== STUDENTS MODULE ====================
    console.log('\n--- Students Module Security Tests ---\n');

    const students = await api('GET', '/students', null, headersFor(hod));
    if (students.statusCode === 200 && Array.isArray(students.body?.data)) {
      passed++;
      console.log('[STUDENT-01] PASS: HOD can list students');
    } else {
      failed++;
      console.log(`[STUDENT-01] FAIL: HOD could not list students (status=${students.statusCode})`);
    }

    const myProfile = await api('GET', '/students/me', null, headersFor(student));
    if (myProfile.statusCode === 200) {
      passed++;
      console.log('[STUDENT-02] PASS: Student can view own profile');
    } else {
      failed++;
      console.log(`[STUDENT-02] FAIL: Student could not view own profile (status=${myProfile.statusCode})`);
    }

    const unauthStudents = await api('GET', '/students', null, {}, 401);
    if (unauthStudents.statusCode === 401) {
      passed++;
      console.log('[STUDENT-03] PASS: Unauthenticated blocked from students');
    } else {
      failed++;
      console.log(`[STUDENT-03] FAIL: Unauthenticated access to students (status=${unauthStudents.statusCode})`);
    }

    // ==================== FACULTY MODULE ====================
    console.log('\n--- Faculty Module Security Tests ---\n');

    const faculties = await api('GET', '/faculties', null, headersFor(hod));
    if (faculties.statusCode === 200 && Array.isArray(faculties.body?.data)) {
      passed++;
      console.log('[FACULTY-01] PASS: HOD can list faculty');
    } else {
      failed++;
      console.log(`[FACULTY-01] FAIL: HOD could not list faculty (status=${faculties.statusCode})`);
    }

    const myFaculty = await api('GET', '/faculties/me', null, headersFor(faculty));
    if (myFaculty.statusCode === 200) {
      passed++;
      console.log('[FACULTY-02] PASS: Faculty can view own profile');
    } else {
      failed++;
      console.log(`[FACULTY-02] FAIL: Faculty could not view own profile (status=${myFaculty.statusCode})`);
    }

    const unauthFaculty = await api('GET', '/faculties', null, {}, 401);
    if (unauthFaculty.statusCode === 401) {
      passed++;
      console.log('[FACULTY-03] PASS: Unauthenticated blocked from faculty');
    } else {
      failed++;
      console.log(`[FACULTY-03] FAIL: Unauthenticated access to faculty (status=${unauthFaculty.statusCode})`);
    }

    // ==================== RESULTS MODULE ====================
    console.log('\n--- Results Module Security Tests ---\n');

    const results = await api('GET', '/results', null, headersFor(hod));
    if (results.statusCode === 200 && Array.isArray(results.body?.data)) {
      passed++;
      console.log('[RESULT-01] PASS: HOD can list results');
    } else {
      failed++;
      console.log(`[RESULT-01] FAIL: HOD could not list results (status=${results.statusCode})`);
    }

    const unauthResults = await api('GET', '/results', null, {}, 401);
    if (unauthResults.statusCode === 401) {
      passed++;
      console.log('[RESULT-02] PASS: Unauthenticated blocked from results');
    } else {
      failed++;
      console.log(`[RESULT-02] FAIL: Unauthenticated access to results (status=${unauthResults.statusCode})`);
    }

    const studentCreateResult = await api('POST', '/results', {
      studentId: student.id,
      courseId: courseId,
      assessmentType: 'ASSIGNMENT',
      semester: 1,
      academicYear: '2025-2026',
      maxMarks: 100
    }, headersFor(student), 403);
    if (studentCreateResult.statusCode === 403) {
      passed++;
      console.log('[RESULT-03] PASS: Student blocked from creating results');
    } else {
      failed++;
      console.log(`[RESULT-03] FAIL: Student could create results (status=${studentCreateResult.statusCode})`);
    }

    // ==================== APPROVALS MODULE ====================
    console.log('\n--- Approvals Module Security Tests ---\n');

    const createApproval = await api('POST', '/approvals', {
      type: 'LEAVE',
      departmentId: dept1Id,
      description: 'Test approval'
    }, headersFor(student));
    if (createApproval.statusCode === 201 && createApproval.body?.data?.id) {
      const approvalId = createApproval.body.data.id;
      passed++;
      console.log('[APPROVAL-01] PASS: Student can create approval');

      const myApproval = await api('GET', `/approvals/${approvalId}`, null, headersFor(student));
      if (myApproval.statusCode === 200) {
        passed++;
        console.log('[APPROVAL-02] PASS: User can view own approval');
      } else {
        failed++;
        console.log(`[APPROVAL-02] FAIL: User could not view own approval (status=${myApproval.statusCode})`);
      }

      const otherApproval = await api('GET', `/approvals/${approvalId}`, null, headersFor(hod2), 403);
      if (otherApproval.statusCode === 403 || otherApproval.statusCode === 404) {
        passed++;
        console.log('[APPROVAL-03] PASS: Cross-department user blocked from approval');
      } else {
        failed++;
        console.log(`[APPROVAL-03] FAIL: Cross-department user accessed approval (status=${otherApproval.statusCode})`);
      }

      const principalApproval = await api('GET', `/approvals/${approvalId}`, null, headersFor(principal));
      if (principalApproval.statusCode === 200) {
        passed++;
        console.log('[APPROVAL-04] PASS: PRINCIPAL can view any approval');
      } else {
        failed++;
        console.log(`[APPROVAL-04] FAIL: PRINCIPAL could not view approval (status=${principalApproval.statusCode})`);
      }

      await testClient.query('DELETE FROM approvals WHERE id = $1', [approvalId]).catch(() => {});
    } else {
      failed++;
      console.log(`[APPROVAL-01] FAIL: Student could not create approval (status=${createApproval.statusCode})`);
    }

    const unauthApprovals = await api('GET', '/approvals/me', null, {}, 401);
    if (unauthApprovals.statusCode === 401) {
      passed++;
      console.log('[APPROVAL-05] PASS: Unauthenticated blocked from approvals');
    } else {
      failed++;
      console.log(`[APPROVAL-05] FAIL: Unauthenticated access to approvals (status=${unauthApprovals.statusCode})`);
    }

    // ==================== DEVICES MODULE ====================
    console.log('\n--- Devices Module Security Tests ---\n');

    const devices = await api('GET', '/devices', null, headersFor(principal));
    if (devices.statusCode === 200 && Array.isArray(devices.body?.data)) {
      passed++;
      console.log('[DEVICE-01] PASS: PRINCIPAL can list devices');
    } else {
      failed++;
      console.log(`[DEVICE-01] FAIL: PRINCIPAL could not list devices (status=${devices.statusCode})`);
    }

    const createDevice = await api('POST', '/devices', {
      userId: student.id,
      deviceName: 'Test Device',
      deviceType: 'MOBILE'
    }, headersFor(student));
    if (createDevice.statusCode === 201 && createDevice.body?.data?.id) {
      const deviceId = createDevice.body.data.id;
      passed++;
      console.log('[DEVICE-02] PASS: User can register device');

      const myDevice = await api('GET', `/devices/${deviceId}`, null, headersFor(student));
      if (myDevice.statusCode === 200) {
        passed++;
        console.log('[DEVICE-03] PASS: User can view own device');
      } else {
        failed++;
        console.log(`[DEVICE-03] FAIL: User could not view own device (status=${myDevice.statusCode})`);
      }

      const otherDevice = await api('GET', `/devices/${deviceId}`, null, headersFor(faculty), 403);
      if (otherDevice.statusCode === 403 || otherDevice.statusCode === 404) {
        passed++;
        console.log('[DEVICE-04] PASS: Other user blocked from device');
      } else {
        failed++;
        console.log(`[DEVICE-04] FAIL: Other user accessed device (status=${otherDevice.statusCode})`);
      }

      await testClient.query('DELETE FROM devices WHERE id = $1', [deviceId]).catch(() => {});
    } else {
      failed++;
      console.log(`[DEVICE-02] FAIL: User could not register device (status=${createDevice.statusCode})`);
    }

    const unauthDevices = await api('GET', '/devices', null, {}, 401);
    if (unauthDevices.statusCode === 401) {
      passed++;
      console.log('[DEVICE-05] PASS: Unauthenticated blocked from devices');
    } else {
      failed++;
      console.log(`[DEVICE-05] FAIL: Unauthenticated access to devices (status=${unauthDevices.statusCode})`);
    }

    // ==================== ANALYTICS MODULE ====================
    console.log('\n--- Analytics Module Security Tests ---\n');

    const analytics = await api('GET', '/analytics/student-performance', null, headersFor(hod));
    if (analytics.statusCode === 200 && Array.isArray(analytics.body?.data)) {
      passed++;
      console.log('[ANALYTICS-01] PASS: HOD can access analytics');
    } else {
      failed++;
      console.log(`[ANALYTICS-01] FAIL: HOD could not access analytics (status=${analytics.statusCode})`);
    }

    const studentAnalytics = await api('GET', '/analytics/student-performance', null, headersFor(student), 403);
    if (studentAnalytics.statusCode === 403) {
      passed++;
      console.log('[ANALYTICS-02] PASS: Student blocked from analytics');
    } else {
      failed++;
      console.log(`[ANALYTICS-02] FAIL: Student accessed analytics (status=${studentAnalytics.statusCode})`);
    }

    const crossDomain = await api('GET', '/analytics/cross-domain', null, headersFor(principal));
    if (crossDomain.statusCode === 200) {
      passed++;
      console.log('[ANALYTICS-03] PASS: PRINCIPAL can access cross-domain analytics');
    } else {
      failed++;
      console.log(`[ANALYTICS-03] FAIL: PRINCIPAL could not access cross-domain analytics (status=${crossDomain.statusCode})`);
    }

    const hodCrossDomain = await api('GET', '/analytics/cross-domain', null, headersFor(hod), 403);
    if (hodCrossDomain.statusCode === 403) {
      passed++;
      console.log('[ANALYTICS-04] PASS: HOD blocked from cross-domain analytics');
    } else {
      failed++;
      console.log(`[ANALYTICS-04] FAIL: HOD accessed cross-domain analytics (status=${hodCrossDomain.statusCode})`);
    }

    // ==================== SYSTEM CONFIG MODULE ====================
    console.log('\n--- System Config Module Security Tests ---\n');

    const sysConfig = await api('GET', '/system-config', null, headersFor(principal));
    if (sysConfig.statusCode === 200) {
      passed++;
      console.log('[SYSConfig-01] PASS: PRINCIPAL can view system config');
    } else {
      failed++;
      console.log(`[SYSConfig-01] FAIL: PRINCIPAL could not view system config (status=${sysConfig.statusCode})`);
    }

    const hodConfig = await api('GET', '/system-config', null, headersFor(hod), 403);
    if (hodConfig.statusCode === 403) {
      passed++;
      console.log('[SYSConfig-02] PASS: HOD blocked from system config');
    } else {
      failed++;
      console.log(`[SYSConfig-02] FAIL: HOD accessed system config (status=${hodConfig.statusCode})`);
    }

    const health = await api('GET', '/system-config/health', null, headersFor(faculty));
    if (health.statusCode === 200) {
      passed++;
      console.log('[SYSConfig-03] PASS: Faculty can access system health');
    } else {
      failed++;
      console.log(`[SYSConfig-03] FAIL: Faculty could not access system health (status=${health.statusCode})`);
    }

    testClient.release();
  } catch (err) {
    console.error('Test execution error:', err.message);
    failed++;
  }

  if (testServer) {
    testServer.close();
  }

  try {
    await connection.close(5000);
  } catch (_) {}

  console.log(`\n=== Module Security Test Summary ===`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(failed === 0 ? '\nALL MODULE SECURITY TESTS PASSED!' : '\nSOME TESTS FAILED');

  process.exit(failed > 0 ? 1 : 0);
}

runModuleSecurityTests().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
