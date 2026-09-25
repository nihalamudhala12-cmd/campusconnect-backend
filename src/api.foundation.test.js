/**
 * API Foundation Verification Test Suite
 * Step 6.7 — API Foundation Verification
 *
 * Verifies all 8 foundation areas:
 *   1. Route → middleware → controller flow
 *   2. Authentication → RBAC flow
 *   3. Department isolation
 *   4. UUID/business-ID mapping
 *   5. Transaction usage
 *   6. Validation
 *   7. Canonical success/error responses
 *   8. Async error handling
 */

const assert = require('assert');
const http = require('http');
const express = require('express');
const { app } = require('./app');
const connection = require('./infrastructure/database/connection');
const { errorHandler } = require('./middleware/errorHandler');
const asyncHandler = require('./middleware/asyncHandler');
const validateRequest = require('./middleware/validateRequest');
const { authenticate, optionalAuthenticate } = require('./middleware/authMiddleware');
const { authorize } = require('./middleware/rbacMiddleware');
const BaseController = require('./controllers/baseController');
const { parseIdOrCode, validateUUID, validateCode } = require('./utils/idMapper');
const { toResponseEnvelope } = require('./utils/dtoMapper');
const { applyDepartmentScope } = require('./repositories/departmentScope');
const { BadRequestError, NotFoundError, ValidationError, ForbiddenError } = require('./errors');

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

function createDummyJwt(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = 'dummy_sig';
  return `${header}.${body}.${signature}`;
}

async function runFoundationTests() {
  console.log('--- Starting API Foundation Verification Test Suite ---');
  let testServer = null;

  try {
    testServer = await listenApp(app);

    // =========================================================================
    // 1. Route → middleware → controller flow
    // =========================================================================
    console.log('\n[FOUND-01] Testing Route → middleware → controller flow...');
    {
      const flowApp = express();
      flowApp.use(express.json());

      const ctrl = {
        handle: (req, res) => {
          res.json({ success: true, message: 'flow-ok', params: req.params, body: req.body });
        },
      };

      flowApp.post('/test-flow/:id',
        validateRequest({
          params: (params) => {
            const errors = [];
            if (!params.id) errors.push({ field: 'id', message: 'id is required' });
            return errors;
          },
        }),
        authenticate,
        authorize(['HOD']),
        asyncHandler(async (req, res) => {
          ctrl.handle(req, res);
        })
      );
      flowApp.use(errorHandler);

      const flowServer = await listenApp(flowApp);

      const res = await makeRequest(flowServer, {
        path: '/test-flow/abc123',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': 'usr_hod_1',
          'x-user-role': 'HOD',
          'x-user-dept': 'DEPT001',
        },
      }, { foo: 'bar' });

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.message, 'flow-ok');
      assert.strictEqual(res.body.params.id, 'abc123');
      assert.strictEqual(res.body.body.foo, 'bar');

      flowServer.close();
      console.log('  ✓ Route passes through validation → auth → RBAC → controller → response');
    }

    // =========================================================================
    // 2. Authentication → RBAC flow
    // =========================================================================
    console.log('\n[FOUND-02] Testing Authentication → RBAC flow...');
    {
      const secApp = express();
      secApp.use(express.json());
      secApp.get('/test-sec', authenticate, authorize(['FACULTY', 'HOD']), (req, res) => {
        res.json({ success: true, role: req.user.role, departmentId: req.departmentId });
      });
      secApp.use(errorHandler);

      const secServer = await listenApp(secApp);

      const resUnauth = await makeRequest(secServer, { path: '/test-sec', method: 'GET', headers: { 'x-expected-error': 'true' } });
      assert.strictEqual(resUnauth.statusCode, 401);
      assert.strictEqual(resUnauth.body.error.code, 'UNAUTHORIZED');

      const resForbidden = await makeRequest(secServer, {
        path: '/test-sec',
        method: 'GET',
        headers: { 'x-user-id': 'usr_student_1', 'x-user-role': 'STUDENT', 'x-user-dept': 'D1', 'x-expected-error': 'true' },
      });
      assert.strictEqual(resForbidden.statusCode, 403);
      assert.strictEqual(resForbidden.body.error.code, 'FORBIDDEN');

      const resOk = await makeRequest(secServer, {
        path: '/test-sec',
        method: 'GET',
        headers: { 'x-user-id': 'usr_hod_1', 'x-user-role': 'HOD', 'x-user-dept': 'D1' },
      });
      assert.strictEqual(resOk.statusCode, 200);
      assert.strictEqual(resOk.body.role, 'HOD');
      assert.strictEqual(resOk.body.departmentId, 'D1');

      secServer.close();
      console.log('  ✓ Unauthenticated → 401, wrong role → 403, correct role → 200 with context');
    }

    // =========================================================================
    // 3. Department isolation
    // =========================================================================
    console.log('\n[FOUND-03] Testing Department isolation...');
    {
      const deptApp = express();
      deptApp.use(express.json());
      deptApp.get('/test-dept', authenticate, authorize(['FACULTY']), (req, res) => {
        res.json({ success: true, departmentId: req.departmentId });
      });
      deptApp.use(errorHandler);

      const deptServer = await listenApp(deptApp);

      const resPrincipal = await makeRequest(deptServer, {
        path: '/test-dept',
        method: 'GET',
        headers: { 'x-user-id': 'usr_principal_1', 'x-user-role': 'PRINCIPAL' },
      });
      assert.strictEqual(resPrincipal.statusCode, 200);
      assert.strictEqual(resPrincipal.body.departmentId, 'ALL');

      const resFaculty = await makeRequest(deptServer, {
        path: '/test-dept',
        method: 'GET',
        headers: { 'x-user-id': 'usr_faculty_1', 'x-user-role': 'FACULTY', 'x-user-dept': 'DEPT42' },
      });
      assert.strictEqual(resFaculty.statusCode, 200);
      assert.strictEqual(resFaculty.body.departmentId, 'DEPT42');

      deptServer.close();
      console.log('  ✓ PRINCIPAL gets ALL, non-PRINCIPAL gets their department scoped');
    }

    // =========================================================================
    // 4. UUID/business-ID mapping
    // =========================================================================
    console.log('\n[FOUND-04] Testing UUID/business-ID mapping...');
    {
      const validUuid = '123e4567-e89b-12d3-a456-426614174000';
      const validCode = 'DEPT-CS';

      assert.strictEqual(validateUUID(validUuid), true);
      assert.strictEqual(validateUUID('not-a-uuid'), false);

      assert.strictEqual(validateCode(validCode), true);
      assert.strictEqual(validateCode('bad code!'), false);

      const parsedUuid = parseIdOrCode(validUuid, 'Resource');
      assert.strictEqual(parsedUuid.type, 'UUID');
      assert.strictEqual(parsedUuid.value, validUuid);

      const parsedCode = parseIdOrCode(validCode, 'Resource');
      assert.strictEqual(parsedCode.type, 'CODE');
      assert.strictEqual(parsedCode.value, validCode);

      assert.throws(
        () => parseIdOrCode('invalid@id', 'Resource'),
        (err) => err instanceof BadRequestError && err.statusCode === 400
      );

      console.log('  ✓ UUID validation, code validation, and parseIdOrCode work correctly');
    }

    // =========================================================================
    // 5. Transaction usage
    // =========================================================================
    console.log('\n[FOUND-05] Testing Transaction usage...');
    {
      await connection.initialize();
      await connection.verifyConnection();

      const repo = {
        async count(client) {
          const runner = client || connection.getPool();
          const res = await runner.query('SELECT COUNT(*)::int as count FROM departments');
          return res.rows[0].count;
        },
      };

      const beforeCount = await repo.count();

      await connection.withTransaction(async (client) => {
        await client.query("INSERT INTO departments (id, name, code, status) VALUES (gen_random_uuid(), 'TxTest', 'TX_FOUND', 'ACTIVE')");
        const insideCount = await repo.count(client);
        assert.ok(insideCount > beforeCount, 'Count should increase inside transaction');
      });

      const afterCommitCount = await repo.count();
      assert.strictEqual(afterCommitCount, beforeCount + 1);

      try {
        await connection.withTransaction(async (client) => {
          await client.query("INSERT INTO departments (id, name, code, status) VALUES (gen_random_uuid(), 'TxFail', 'TX_FAIL_FOUND', 'ACTIVE')");
          throw new Error('Simulated failure');
        });
      } catch (_err) {
        // expected
      }

      const afterRollbackCount = await repo.count();
      assert.strictEqual(afterRollbackCount, afterCommitCount);

      await connection.getPool().query("DELETE FROM departments WHERE code = 'TX_FOUND'");
      console.log('  ✓ Transaction commit persists, rollback cleans up on failure');
    }

    // =========================================================================
    // 6. Validation
    // =========================================================================
    console.log('\n[FOUND-06] Testing Validation...');
    {
      const valApp = express();
      valApp.use(express.json());

      const userSchema = {
        body: (body) => {
          const errors = [];
          if (!body || typeof body.name !== 'string' || body.name.trim() === '') {
            errors.push({ field: 'name', message: 'Name is required' });
          }
          if (!body || !body.email) {
            errors.push({ field: 'email', message: 'Email is required' });
          }
          if (body && body.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
            errors.push({ field: 'email', message: 'Email format is invalid' });
          }
          return errors;
        },
      };

      valApp.post('/users', validateRequest(userSchema), (req, res) => {
        res.json({ success: true, data: req.body });
      });
      valApp.use(errorHandler);

      const valServer = await listenApp(valApp);

      const resInvalid = await makeRequest(valServer, {
        path: '/users',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }, {});

      assert.strictEqual(resInvalid.statusCode, 422);
      assert.strictEqual(resInvalid.body.success, false);
      assert.strictEqual(resInvalid.body.error.code, 'VALIDATION_ERROR');
      assert.ok(resInvalid.body.error.errors.some((e) => e.field === 'name'));
      assert.ok(resInvalid.body.error.errors.some((e) => e.field === 'email'));

      const resBadEmail = await makeRequest(valServer, {
        path: '/users',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }, { name: 'Test', email: 'bad' });

      assert.strictEqual(resBadEmail.statusCode, 422);
      assert.ok(resBadEmail.body.error.errors.some((e) => e.field === 'email' && e.message === 'Email format is invalid'));

      valServer.close();
      console.log('  ✓ validateRequest returns 422 with structured field-level errors');
    }

    // =========================================================================
    // 7. Canonical success/error responses
    // =========================================================================
    console.log('\n[FOUND-07] Testing Canonical success/error responses...');
    {
      class TestCtrl extends BaseController {}
      const ctrl = new TestCtrl({});

      const mockRes = {
        statusCode: 0,
        jsonData: null,
        status(code) { this.statusCode = code; return this; },
        json(data) { this.jsonData = data; return this; },
      };

      ctrl.ok(mockRes, { id: 1 });
      assert.strictEqual(mockRes.jsonData.success, true);
      assert.strictEqual(mockRes.jsonData.message, 'Success');

      ctrl.created(mockRes, { id: 2 });
      assert.strictEqual(mockRes.statusCode, 201);
      assert.strictEqual(mockRes.jsonData.success, true);
      assert.strictEqual(mockRes.jsonData.message, 'Created');

      ctrl.notFound(mockRes, 'Missing', { id: 99 });
      assert.strictEqual(mockRes.statusCode, 404);
      assert.strictEqual(mockRes.jsonData.success, false);
      assert.strictEqual(mockRes.jsonData.error.code, 'NOT_FOUND');
      assert.strictEqual(mockRes.jsonData.error.message, 'Missing');
      assert.deepStrictEqual(mockRes.jsonData.error.details, { id: 99 });

      const envelope = toResponseEnvelope({ id: 1 }, 'Found');
      assert.strictEqual(envelope.success, true);
      assert.strictEqual(envelope.message, 'Found');
      assert.strictEqual(envelope.data.id, 1);

      console.log('  ✓ BaseController and toResponseEnvelope produce canonical envelopes');
    }

    // =========================================================================
    // 8. Async error handling
    // =========================================================================
    console.log('\n[FOUND-08] Testing Async error handling...');
    {
      const asyncApp = express();
      asyncApp.use(express.json());

      asyncApp.get('/async-ok', asyncHandler(async (req, res) => {
        res.json({ success: true, data: 'ok' });
      }));

      asyncApp.get('/async-err', asyncHandler(async (_req, _res) => {
        throw new NotFoundError('Async not found');
      }));

      asyncApp.get('/async-unhandled', asyncHandler(async (_req, _res) => {
        throw new Error('Unexpected async crash');
      }));

      asyncApp.use(errorHandler);

      const asyncServer = await listenApp(asyncApp);

      const resOk = await makeRequest(asyncServer, { path: '/async-ok', method: 'GET' });
      assert.strictEqual(resOk.statusCode, 200);
      assert.strictEqual(resOk.body.success, true);

      const resAppErr = await makeRequest(asyncServer, { path: '/async-err', method: 'GET' });
      assert.strictEqual(resAppErr.statusCode, 404);
      assert.strictEqual(resAppErr.body.error.code, 'NOT_FOUND');

      const resUnhandled = await makeRequest(asyncServer, { path: '/async-unhandled', method: 'GET' });
      assert.strictEqual(resUnhandled.statusCode, 500);
      assert.strictEqual(resUnhandled.body.error.code, 'INTERNAL_SERVER_ERROR');

      asyncServer.close();
      console.log('  ✓ asyncHandler forwards resolved, AppError, and unhandled errors to errorHandler');
    }

    console.log('\n=================================================================');
    console.log('ALL API FOUNDATION VERIFICATION TESTS PASSED SUCCESSFULLY! (8/8)');
    console.log('=================================================================\n');
  } catch (err) {
    console.error('\n❌ Foundation verification failure:', err);
    process.exitCode = 1;
  } finally {
    if (testServer) {
      testServer.close();
    }
    await connection.close(1000).catch(() => {});
  }
}

if (require.main === module) {
  runFoundationTests();
}

module.exports = runFoundationTests;
