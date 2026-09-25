/**
 * API Foundation Blockers Automated Test Suite
 * Step 6.1 Backend Foundation Audit Fix Verification
 *
 * Tests AUD-01 through AUD-05 fixes for:
 *   - CORS preflight (OPTIONS) handling
 *   - Error response envelope standardization
 *   - Database-aware health check (healthy 200 vs degraded 503)
 *   - Request validation middleware (422 ValidationError)
 *   - Authentication and RBAC fail-closed middleware
 */

const assert = require('assert');
const http = require('http');
const express = require('express');
const config = require('./config');
const { app } = require('./app');
const connection = require('./infrastructure/database/connection');
const {
  AppError,
  BadRequestError,
  NotFoundError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
} = require('./errors');
const { errorHandler } = require('./middleware/errorHandler');
const BaseController = require('./controllers/baseController');
const validateRequest = require('./middleware/validateRequest');
const { authenticate } = require('./middleware/authMiddleware');
const { authorize } = require('./middleware/rbacMiddleware');

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

async function runTests() {
  console.log('--- Starting CampusConnect API Foundation Blocker Test Suite ---');
  let testServer = null;

  try {
    testServer = await listenApp(app);

    // =========================================================================
    // AUD-01: CORS Preflight Handling Tests
    // =========================================================================
    console.log('\n[AUD-01] Testing CORS OPTIONS Preflight Handling...');
    {
      const res = await makeRequest(testServer, {
        path: '/health',
        method: 'OPTIONS',
        headers: {
          Origin: 'http://localhost:3000',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'Content-Type,Authorization',
        },
      });

      assert.strictEqual(res.statusCode, 204, 'CORS preflight OPTIONS must return 204 No Content');
      assert.strictEqual(res.headers['access-control-allow-origin'], 'http://localhost:3000');
      assert.strictEqual(res.headers['access-control-allow-credentials'], 'true');
      assert.ok(res.headers['access-control-allow-methods'].includes('OPTIONS'));
      console.log('✓ AUD-01 PASS: CORS OPTIONS preflight returns HTTP 204 with credentials header');
    }

    // =========================================================================
    // AUD-02: Error Response Envelope Standardization Tests
    // =========================================================================
    console.log('\n[AUD-02] Testing Error Response Envelope Standardization...');
    {
      // 1. Test 404 Route Error (via errorHandler middleware)
      const res404 = await makeRequest(testServer, {
        path: '/non-existent-route-for-testing',
        method: 'GET',
      });

      assert.strictEqual(res404.statusCode, 404);
      assert.strictEqual(res404.body.success, false);
      assert.ok(res404.body.error, 'Error envelope must contain root "error" object');
      assert.strictEqual(res404.body.error.code, 'NOT_FOUND');
      assert.ok(typeof res404.body.error.message === 'string');

      // 2. Test BaseController Response Helper Envelope
      class TestController extends BaseController {
        testBadRequest(res) {
          return this.badRequest(res, 'Custom bad request message', { field: 'email' });
        }
      }
      const testCtrl = new TestController({});
      const mockRes = {
        status(code) {
          this.statusCode = code;
          return this;
        },
        json(data) {
          this.jsonData = data;
          return this;
        },
      };
      testCtrl.testBadRequest(mockRes);

      assert.strictEqual(mockRes.statusCode, 400);
      assert.strictEqual(mockRes.jsonData.success, false);
      assert.ok(mockRes.jsonData.error);
      assert.strictEqual(mockRes.jsonData.error.code, 'BAD_REQUEST');
      assert.strictEqual(mockRes.jsonData.error.message, 'Custom bad request message');
      assert.deepStrictEqual(mockRes.jsonData.error.details, { field: 'email' });

      console.log('✓ AUD-02 PASS: Error responses across middleware and controllers use unified envelope shape');
    }

    // =========================================================================
    // AUD-03: Database-Aware Health Check Tests
    // =========================================================================
    console.log('\n[AUD-03] Testing Database-Aware Health Check Route...');
    {
      // 1. Test Degraded Health Check (when database is NOT initialized/connected)
      const resDegraded = await makeRequest(testServer, {
        path: '/health',
        method: 'GET',
      });

      assert.strictEqual(resDegraded.statusCode, 503, 'Unconnected DB must return HTTP 503');
      assert.strictEqual(resDegraded.body.status, 'degraded');
      assert.strictEqual(resDegraded.body.database.status, 'disconnected');

      // 2. Test Healthy Health Check (when database is initialized)
      await connection.initialize();
      await connection.verifyConnection();

      const resHealthy = await makeRequest(testServer, {
        path: '/health',
        method: 'GET',
      });

      assert.strictEqual(resHealthy.statusCode, 200, 'Connected DB must return HTTP 200');
      assert.strictEqual(resHealthy.body.status, 'ok');
      assert.strictEqual(resHealthy.body.database.status, 'connected');

      console.log('✓ AUD-03 PASS: Health check reflects database connectivity (503 disconnected vs 200 connected)');
    }

    // =========================================================================
    // AUD-04: Request Validation Infrastructure Tests
    // =========================================================================
    console.log('\n[AUD-04] Testing Request Validation Infrastructure...');
    {
      const dummyApp = express();
      dummyApp.use(express.json());

      const sampleSchema = {
        body: (data) => {
          const errors = [];
          if (!data.name) errors.push({ field: 'name', message: 'Name is required' });
          return errors;
        },
      };

      dummyApp.post('/test-val', validateRequest(sampleSchema), (req, res) => {
        res.json({ success: true });
      });
      dummyApp.use(errorHandler);

      const dummyServer = await listenApp(dummyApp);

      // Test invalid validation submission
      const resInvalid = await makeRequest(dummyServer, {
        path: '/test-val',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }, {});

      assert.strictEqual(resInvalid.statusCode, 422, 'Validation failure must return 422 Unprocessable Entity');
      assert.strictEqual(resInvalid.body.success, false);
      assert.strictEqual(resInvalid.body.error.code, 'VALIDATION_ERROR');
      assert.strictEqual(resInvalid.body.error.errors[0].field, 'name');

      dummyServer.close();
      console.log('✓ AUD-04 PASS: Request validation middleware catches errors and formats 422 ValidationError envelope');
    }

    // =========================================================================
    // AUD-05: Authentication & RBAC Fail-Closed Middleware Tests
    // =========================================================================
    console.log('\n[AUD-05] Testing Authentication & RBAC Fail-Closed Middleware...');
    {
      const secApp = express();
      secApp.use(express.json());

      // Endpoint requiring authentication & HOD role
      secApp.get('/test-protected', authenticate, authorize(['HOD']), (req, res) => {
        res.json({
          success: true,
          user: req.user,
          departmentId: req.departmentId,
        });
      });
      secApp.use(errorHandler);

      const secServer = await listenApp(secApp);

      // 1. Unauthenticated Request -> 401 Unauthorized (FAIL-CLOSED)
      const resUnauth = await makeRequest(secServer, {
        path: '/test-protected',
        method: 'GET',
        headers: { 'x-expected-error': 'true' },
      });
      assert.strictEqual(resUnauth.statusCode, 401, 'Unauthenticated request must return 401');
      assert.strictEqual(resUnauth.body.error.code, 'UNAUTHORIZED');

      // 2. Unauthorized Role Request (STUDENT) -> 403 Forbidden (FAIL-CLOSED)
      const resForbidden = await makeRequest(secServer, {
        path: '/test-protected',
        method: 'GET',
        headers: {
          'x-user-id': 'usr_stu_1',
          'x-user-role': 'STUDENT',
          'x-user-dept': 'DEPT001',
          'x-expected-error': 'true',
        },
      });
      assert.strictEqual(resForbidden.statusCode, 403, 'Unauthorized role must return 403');
      assert.strictEqual(resForbidden.body.error.code, 'FORBIDDEN');

      // 3. Authorized Role Request (HOD) -> 200 OK + req.user & req.departmentId attached
      const resAuthorized = await makeRequest(secServer, {
        path: '/test-protected',
        method: 'GET',
        headers: {
          'x-user-id': 'usr_hod_1',
          'x-user-role': 'HOD',
          'x-user-dept': 'DEPT001',
        },
      });
      assert.strictEqual(resAuthorized.statusCode, 200);
      assert.strictEqual(resAuthorized.body.success, true);
      assert.strictEqual(resAuthorized.body.user.role, 'HOD');
      assert.strictEqual(resAuthorized.body.departmentId, 'DEPT001');

      // 4. PRINCIPAL Role Bypass Test
      const resPrincipal = await makeRequest(secServer, {
        path: '/test-protected',
        method: 'GET',
        headers: {
          'x-user-id': 'usr_principal',
          'x-user-role': 'PRINCIPAL',
        },
      });
      assert.strictEqual(resPrincipal.statusCode, 200);
      assert.strictEqual(resPrincipal.body.departmentId, 'ALL');

      secServer.close();
      console.log('✓ AUD-05 PASS: Auth and RBAC middleware enforce fail-closed security (401/403) and attach user/department context');
    }

    console.log('\n=================================================================');
    console.log('ALL API FOUNDATION BLOCKER TESTS PASSED SUCCESSFULLY! (5/5)');
    console.log('=================================================================\n');
  } catch (err) {
    console.error('\n❌ Test failure:', err);
    process.exitCode = 1;
  } finally {
    if (testServer) {
      testServer.close();
    }
    await connection.close(1000).catch(() => {});
  }
}

if (require.main === module) {
  runTests();
}

module.exports = runTests;
