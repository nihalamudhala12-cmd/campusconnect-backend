/**
 * API Foundation Security Verification Test Suite
 * READ/TEST-ONLY Security Audit for CampusConnect Backend
 *
 * Verifies:
 *   1. Dev Auth Headers disabled in production (NODE_ENV=production)
 *   2. CORS Credentials & Origin restrictions
 *   3. RBAC Fail-Closed & Department Context Isolation
 *   4. Uniform Error Envelope across 401, 403, 422, 404, 500 errors
 */

const assert = require('assert');
const http = require('http');
const express = require('express');
const jwt = require('jsonwebtoken');
const { app } = require('./app');
const connection = require('./infrastructure/database/connection');
const { errorHandler } = require('./middleware/errorHandler');
const validateRequest = require('./middleware/validateRequest');
const { authenticate } = require('./middleware/authMiddleware');
const { authorize } = require('./middleware/rbacMiddleware');
const { BadRequestError, ConflictError } = require('./errors');

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
        try {
          parsed = JSON.parse(body);
        } catch (_e) {
          parsed = body;
        }
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

const config = require('./config');

function createDummyJwt(payload) {
  const secret = config.security.jwtSecret;
  if (!secret) {
    throw new Error('JWT_SECRET is not configured. Cannot create test JWT.');
  }
  return jwt.sign(payload, secret, { algorithm: 'HS256', expiresIn: '1h' });
}

async function runSecurityTests() {
  console.log('--- Starting API Foundation Security Verification Suite ---');
  const originalNodeEnv = process.env.NODE_ENV;

  try {
    // Initialize database connection before running tests
    try {
      await connection.initialize();
      await connection.verifyConnection();
    } catch (dbError) {
      console.error('[security.test] Database initialization failed:', dbError.message);
      process.exit(1);
    }

    // Fetch test users from the database for JWT-based tests
    let testUserId = null;
    let testUserRole = null;
    let testDeptId = null;
    let studentUserId = null;
    let studentRole = null;
    let studentDeptId = null;
    let principalUserId = null;
    let principalRole = null;
    // A deterministically non-PRINCIPAL active user.
    // authorize() intentionally grants PRINCIPAL an institution-wide bypass
    // (asserted by SEC-03 above), so a 403 assertion is only meaningful for a
    // user whose role is NOT PRINCIPAL. Using an arbitrary "first active user"
    // made SEC-04/SEC-05 pass or fail depending on row order in the database.
    let nonPrincipalUserId = null;
    let nonPrincipalUserRole = null;
    let nonPrincipalDeptId = null;
    try {
      const pool = connection.getPool();
      const activeUsers = await pool.query(
        'SELECT id, role, department_id FROM users WHERE status = $1 ORDER BY id LIMIT 3',
        ['ACTIVE']
      );
      if (activeUsers.rowCount === 0) {
        throw new Error('No active users found in database');
      }
      testUserId = activeUsers.rows[0].id;
      testUserRole = activeUsers.rows[0].role;
      testDeptId = activeUsers.rows[0].department_id;
      if (activeUsers.rowCount >= 2) {
        studentUserId = activeUsers.rows[1].id;
        studentRole = activeUsers.rows[1].role;
        studentDeptId = activeUsers.rows[1].department_id;
      }
      if (activeUsers.rowCount >= 3) {
        principalUserId = activeUsers.rows[2].id;
        principalRole = activeUsers.rows[2].role;
      }

      const nonPrincipalUser = await pool.query(
        `SELECT id, role, department_id FROM users
         WHERE status = $1 AND role <> 'PRINCIPAL'
         ORDER BY id LIMIT 1`,
        ['ACTIVE']
      );
      if (nonPrincipalUser.rowCount === 0) {
        throw new Error('No active non-PRINCIPAL user found in database');
      }
      nonPrincipalUserId = nonPrincipalUser.rows[0].id;
      nonPrincipalUserRole = nonPrincipalUser.rows[0].role;
      nonPrincipalDeptId = nonPrincipalUser.rows[0].department_id;
    } catch (dbError) {
      console.error('[security.test] Failed to fetch test users:', dbError.message);
      await connection.close(5000);
      process.exit(1);
    }

    // =========================================================================
    // SECTION 1: Development Authentication Headers in Production
    // =========================================================================
    console.log('\n[SEC-01] Verifying Dev Auth Headers in Production Mode...');
    {
      // Force NODE_ENV to production
      process.env.NODE_ENV = 'production';

      const prodApp = express();
      prodApp.use(express.json());
      prodApp.get('/test-auth', authenticate, (req, res) => {
        res.json({ success: true, user: req.user });
      });
      prodApp.use(errorHandler);

      const prodServer = await listenApp(prodApp);

      // Test 1.1: X-User-Role / X-User-Dept headers in production -> MUST FAIL (401)
      const resDevHeaderInProd = await makeRequest(prodServer, {
        path: '/test-auth',
        method: 'GET',
        headers: {
          'x-user-id': 'u1',
          'x-user-role': 'PRINCIPAL',
          'x-user-dept': 'ALL',
        },
      });

      assert.strictEqual(
        resDevHeaderInProd.statusCode,
        401,
        'Dev auth headers MUST NOT authenticate in production mode'
      );
      assert.strictEqual(resDevHeaderInProd.body.error.code, 'UNAUTHORIZED');
      console.log('  ✓ Dev headers (X-User-*) are completely ignored when NODE_ENV=production');

      // Test 1.2: Valid Bearer JWT in production -> MUST PASS (200)
      const validJwt = createDummyJwt({ id: testUserId, role: testUserRole, departmentId: testDeptId });
      const resJwtInProd = await makeRequest(prodServer, {
        path: '/test-auth',
        method: 'GET',
        headers: {
          Authorization: `Bearer ${validJwt}`,
        },
      });

      assert.strictEqual(resJwtInProd.statusCode, 200);
      assert.strictEqual(resJwtInProd.body.user.role, testUserRole);
      assert.strictEqual(resJwtInProd.body.user.departmentId, testDeptId);
      console.log('  ✓ Valid Bearer JWT authenticates correctly in production mode');

      // Test 1.3: Malformed / missing JWT in production -> MUST FAIL (401)
      const resBadJwtInProd = await makeRequest(prodServer, {
        path: '/test-auth',
        method: 'GET',
        headers: {
          Authorization: 'Bearer invalid.token.here',
        },
      });

      assert.strictEqual(resBadJwtInProd.statusCode, 401);
      console.log('  ✓ Malformed Bearer JWT fails closed with 401 in production mode');

      prodServer.close();
    }

    // Restore NODE_ENV for remaining tests
    process.env.NODE_ENV = 'test';

    // =========================================================================
    // SECTION 2: CORS Security Verification
    // =========================================================================
    console.log('\n[SEC-02] Verifying CORS Credentials & Origin Isolation...');
    {
      const corsServer = await listenApp(app);

      // Test 2.1: Verify Access-Control-Allow-Credentials is true
      const resCors = await makeRequest(corsServer, {
        path: '/health',
        method: 'OPTIONS',
        headers: {
          Origin: 'http://localhost:3000',
        },
      });

      assert.strictEqual(resCors.statusCode, 204);
      assert.strictEqual(resCors.headers['access-control-allow-credentials'], 'true');
      // Ensure Access-Control-Allow-Origin is NOT literal '*' when credentials are true
      assert.notStrictEqual(resCors.headers['access-control-allow-origin'], '*');
      console.log('  ✓ Access-Control-Allow-Credentials is never combined with wildcard origin "*"');

      corsServer.close();
    }

      // =========================================================================
    // SECTION 3: RBAC & Department Scope Isolation Verification
    // =========================================================================
    console.log('\n[SEC-03] Verifying RBAC & Department Context Isolation...');
    {
      const pool = connection.getPool();

      // Fetch a valid department ID for test users
      const deptResult = await pool.query('SELECT id FROM departments ORDER BY id LIMIT 1');
      if (deptResult.rowCount === 0) {
        throw new Error('No departments found in database');
      }
      const testDeptId = deptResult.rows[0].id;

      // Insert deterministic test users with known roles for RBAC testing
      const testUsers = [
        { id: '00000000-0000-4000-8000-000000000001', role: 'FACULTY', departmentId: testDeptId, status: 'ACTIVE' },
        { id: '00000000-0000-4000-8000-000000000002', role: 'STUDENT', departmentId: testDeptId, status: 'ACTIVE' },
        { id: '00000000-0000-4000-8000-000000000003', role: 'PRINCIPAL', departmentId: null, status: 'ACTIVE' },
      ];
      for (const u of testUsers) {
        await pool.query(
          `INSERT INTO users (id, name, email, role, department_id, status) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO UPDATE SET name = $2, email = $3, role = $4, department_id = $5, status = $6`,
          [u.id, `Security Test ${u.role}`, `sec-${u.role.toLowerCase()}@security.test`, u.role, u.departmentId, u.status]
        );
      }

      const deptApp = express();
      deptApp.use(express.json());
      deptApp.get('/test-dept', authenticate, authorize(['FACULTY']), (req, res) => {
        res.json({
          success: true,
          role: req.user.role,
          departmentId: req.departmentId,
        });
      });
      deptApp.use(errorHandler);

      const deptServer = await listenApp(deptApp);

      // Test 3.1: Untrusted header override attempt on authenticated request
      const facultyJwt = createDummyJwt({ id: '00000000-0000-4000-8000-000000000001', role: 'FACULTY', departmentId: testDeptId });
      const resTamperedDept = await makeRequest(deptServer, {
        path: '/test-dept',
        method: 'GET',
        headers: {
          Authorization: `Bearer ${facultyJwt}`,
          'x-user-dept': 'd99_untrusted_override_attempt',
        },
      });

      assert.strictEqual(resTamperedDept.statusCode, 200);
      assert.strictEqual(resTamperedDept.body.departmentId, testDeptId, 'Department context MUST originate from authenticated JWT');
      console.log('  ✓ Department context is strictly isolated from JWT payload (untrusted headers ignored)');

      // Test 3.2: Disallowed Role -> 403 Forbidden
      const studentJwt = createDummyJwt({ id: '00000000-0000-4000-8000-000000000002', role: 'STUDENT', departmentId: testDeptId });
      const resForbiddenRole = await makeRequest(deptServer, {
        path: '/test-dept',
        method: 'GET',
        headers: {
          Authorization: `Bearer ${studentJwt}`,
          'x-expected-error': 'true',
        },
      });

      assert.strictEqual(resForbiddenRole.statusCode, 403);
      assert.strictEqual(resForbiddenRole.body.error.code, 'FORBIDDEN');
      console.log('  ✓ Disallowed roles are rejected with 403 Forbidden (FAIL-CLOSED)');

      // Test 3.3: PRINCIPAL Institution-Wide Scope ('ALL')
      const principalJwt = createDummyJwt({ id: '00000000-0000-4000-8000-000000000003', role: 'PRINCIPAL', departmentId: null });
      const resPrincipal = await makeRequest(deptServer, {
        path: '/test-dept',
        method: 'GET',
        headers: {
          Authorization: `Bearer ${principalJwt}`,
        },
      });

      assert.strictEqual(resPrincipal.statusCode, 200);
      assert.strictEqual(resPrincipal.body.role, 'PRINCIPAL');
      assert.strictEqual(resPrincipal.body.departmentId, 'ALL');
      console.log('  ✓ PRINCIPAL receives institution-wide scope ("ALL")');

      // Clean up test users
      for (const u of testUsers) {
        await pool.query('DELETE FROM users WHERE id = $1', [u.id]);
      }

      deptServer.close();
    }

    // =========================================================================
    // SECTION 4: Uniform Error Envelope Verification
    // =========================================================================
    console.log('\n[SEC-04] Verifying Uniform Error Envelope Across All Error Types...');
    {
      const errApp = express();
      errApp.use(express.json());
      errApp.get('/e401', authenticate, (_req, res) => res.json({ ok: true }));
      errApp.get('/e403', authenticate, authorize(['ADMIN']), (_req, res) => res.json({ ok: true }));
      errApp.post('/e422', validateRequest({ body: () => [{ field: 'x', message: 'invalid' }] }), (_req, res) => res.json({ ok: true }));
      errApp.get('/e500', (_req, _res) => { throw new Error('Unexpected crash'); });
      errApp.use(errorHandler);

      const errServer = await listenApp(errApp);

      // Always close the listener, including on assertion failure. Leaving it
      // open kept the Node process alive indefinitely after a failed check.
      try {
        const checkEnvelope = (res, expectedStatus, expectedCode) => {
          assert.strictEqual(res.statusCode, expectedStatus);
          assert.strictEqual(res.body.success, false);
          assert.ok(res.body.error, 'Response must contain root "error" object');
          assert.strictEqual(res.body.error.code, expectedCode);
          assert.ok(typeof res.body.error.message === 'string');
        };

        const res401 = await makeRequest(errServer, { path: '/e401', method: 'GET', headers: { 'x-expected-error': 'true' } });
        checkEnvelope(res401, 401, 'UNAUTHORIZED');

        const facultyJwt403 = createDummyJwt({ id: nonPrincipalUserId, role: nonPrincipalUserRole, departmentId: nonPrincipalDeptId });
        const res403 = await makeRequest(errServer, { path: '/e403', method: 'GET', headers: { Authorization: `Bearer ${facultyJwt403}`, 'x-expected-error': 'true' } });
        checkEnvelope(res403, 403, 'FORBIDDEN');

        const res422 = await makeRequest(errServer, { path: '/e422', method: 'POST', headers: { 'Content-Type': 'application/json' } }, {});
        checkEnvelope(res422, 422, 'VALIDATION_ERROR');

        const res500 = await makeRequest(errServer, { path: '/e500', method: 'GET' });
        checkEnvelope(res500, 500, 'INTERNAL_SERVER_ERROR');
      } finally {
        errServer.close();
      }

      console.log('  ✓ 401, 403, 422, 500 error responses all adhere strictly to canonical error envelope');
    }

    // =========================================================================
    // SECTION 5: Test-Only Expected Error Logging
    // =========================================================================
    console.log('\n[SEC-05] Verifying expected-error log filtering...');
    {
      const logApp = express();
      logApp.use(express.json());
      logApp.get('/expected-401', authenticate, (_req, res) => res.json({ ok: true }));
      logApp.get('/unexpected-401', authenticate, (_req, res) => res.json({ ok: true }));
      logApp.get('/expected-403', authenticate, authorize(['ADMIN']), (_req, res) => res.json({ ok: true }));
      logApp.get('/unexpected-403', authenticate, authorize(['ADMIN']), (_req, res) => res.json({ ok: true }));
      logApp.get('/expected-409', (_req, _res, next) => next(new ConflictError('Duplicate test resource')));
      logApp.get('/unexpected-409', (_req, _res, next) => next(new ConflictError('Duplicate test resource')));
      logApp.get('/expected-500', (_req, _res) => { throw new Error('Unexpected test crash'); });
      logApp.get('/expected-400', (_req, _res, next) => next(new BadRequestError('Unexpected validation error')));
      logApp.use(errorHandler);

      const logServer = await listenApp(logApp);
      const originalConsoleError = console.error;
      const logMessages = [];
      console.error = (...args) => logMessages.push(args.join(' '));

      try {
        const expected401 = await makeRequest(logServer, { path: '/expected-401', method: 'GET', headers: { 'x-expected-error': 'true' } });
        const unexpected401 = await makeRequest(logServer, { path: '/unexpected-401', method: 'GET' });
        const facultyJwtLog = createDummyJwt({ id: nonPrincipalUserId, role: nonPrincipalUserRole, departmentId: nonPrincipalDeptId });
        const expected403 = await makeRequest(logServer, { path: '/expected-403', method: 'GET', headers: { Authorization: `Bearer ${facultyJwtLog}`, 'x-expected-error': 'true' } });
        const unexpected403 = await makeRequest(logServer, { path: '/unexpected-403', method: 'GET', headers: { Authorization: `Bearer ${facultyJwtLog}` } });
        const expected409 = await makeRequest(logServer, { path: '/expected-409', method: 'GET', headers: { 'x-expected-error': 'true' } });
        const unexpected409 = await makeRequest(logServer, { path: '/unexpected-409', method: 'GET' });
        const expected500 = await makeRequest(logServer, { path: '/expected-500', method: 'GET', headers: { 'x-expected-error': 'true' } });
        const expected400 = await makeRequest(logServer, { path: '/expected-400', method: 'GET', headers: { 'x-expected-error': 'true' } });

        assert.strictEqual(expected401.statusCode, 401);
        assert.strictEqual(unexpected401.statusCode, 401);
        assert.strictEqual(expected403.statusCode, 403);
        assert.strictEqual(unexpected403.statusCode, 403);
        assert.strictEqual(expected409.statusCode, 409);
        assert.strictEqual(unexpected409.statusCode, 409);
        assert.strictEqual(expected500.statusCode, 500);
        assert.strictEqual(expected400.statusCode, 400);
        assert.ok(!logMessages.some((message) => message.includes('/expected-401')));
        assert.ok(!logMessages.some((message) => message.includes('/expected-403')));
        assert.ok(!logMessages.some((message) => message.includes('/expected-409')));
        assert.ok(logMessages.some((message) => message.includes('/unexpected-401')));
        assert.ok(logMessages.some((message) => message.includes('/unexpected-403')));
        assert.ok(logMessages.some((message) => message.includes('/unexpected-409')));
        assert.ok(logMessages.some((message) => message.includes('/expected-500')));
        assert.ok(logMessages.some((message) => message.includes('/expected-400')));
      } finally {
        console.error = originalConsoleError;
        logServer.close();
      }

      console.log('  ✓ Expected 401/403/409 logs are suppressed only when explicitly marked in test mode');
      console.log('  ✓ Unexpected 401/403/409, 400, and 500 logs remain visible');
    }

    console.log('\n=================================================================');
    console.log('ALL SECURITY VERIFICATION CHECKS PASSED (5/5 SECTIONS)');
    console.log('=================================================================\n');
  } catch (err) {
    console.error('\n❌ Security verification failure:', err);
    process.exitCode = 1;
  } finally {
    process.env.NODE_ENV = originalNodeEnv;
    try {
      await connection.close(5000);
    } catch (_e) {
      // Ignore cleanup errors
    }
  }
}

if (require.main === module) {
  runSecurityTests();
}

module.exports = runSecurityTests;
