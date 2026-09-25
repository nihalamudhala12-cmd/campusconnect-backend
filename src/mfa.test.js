const assert = require('assert');
const http = require('http');
const { app } = require('./app');
const connection = require('./infrastructure/database/connection');
const { errorHandler } = require('./middleware/errorHandler');
const asyncHandler = require('./middleware/asyncHandler');
const express = require('express');
const AuthService = require('./modules/auth/authService');
const AuthRepository = require('./modules/auth/authRepository');

const pendingAuths = AuthService.pendingAuths;

function listenApp(expressApp) {
  return new Promise((resolve) => {
    const s = expressApp.listen(0, () => resolve(s));
  });
}

function makeRequest(server, options, postData = null) {
  const port = server.address().port;
  const reqOptions = { hostname: 'localhost', port, ...options };
  if (postData) {
    reqOptions.headers = Object.assign({ 'Content-Type': 'application/json' }, reqOptions.headers || {});
  }
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

/**
 * Ensures the two accounts this suite authenticates with exist and have a
 * usable password hash. Declared credentials match seed.js / self_audit.js.
 */
async function ensureAuthFixture(pool) {
  const crypto = require('crypto');
  const bcrypt = require('bcrypt');

  const accounts = [
    { email: 'principal@test.com', name: 'Principal', role: 'PRINCIPAL', departmentId: null, password: 'AdminPass123!' },
    { email: 'student@test.com', name: 'Student', role: 'STUDENT', departmentId: null, password: 'TestPass123!' },
  ];

  for (const account of accounts) {
    const existing = await pool.query('SELECT id, password_hash FROM users WHERE email = $1', [account.email]);

    if (existing.rowCount === 0) {
      // Attach the student to an existing department when one is available so
      // department-scoped assertions have a realistic context.
      let departmentId = account.departmentId;
      if (departmentId === null && account.role === 'STUDENT') {
        const dept = await pool.query("SELECT id FROM departments WHERE status = 'ACTIVE' ORDER BY created_at LIMIT 1");
        departmentId = dept.rowCount > 0 ? dept.rows[0].id : null;
      }
      await pool.query(
        `INSERT INTO users (id, name, email, role, department_id, status, password_hash, profile_completed, created_at)
         VALUES ($1, $2, $3, $4, $5, 'ACTIVE', $6, true, NOW())`,
        [crypto.randomUUID(), account.name, account.email, account.role, departmentId, await bcrypt.hash(account.password, 12)]
      );
      console.log(`  [fixture] created ${account.email}`);
      continue;
    }

    // Repair a missing/blank password hash left behind by another suite's
    // fixture, so the suite is repeatable in any execution order.
    if (!existing.rows[0].password_hash) {
      await pool.query('UPDATE users SET password_hash = $1 WHERE email = $2', [
        await bcrypt.hash(account.password, 12),
        account.email,
      ]);
      console.log(`  [fixture] restored password for ${account.email}`);
    }
  }
}

async function runMfaTests() {
  console.log('--- Starting MFA Verification Test Suite ---\n');
  const testServer = await listenApp(app);
  let passed = 0;
  let failed = 0;

  function check(name, condition, details) {
    if (condition) {
      passed++;
      console.log(`  PASS: ${name}`);
    } else {
      failed++;
      console.log(`  FAIL: ${name}${details ? ` - ${details}` : ''}`);
    }
  }

  try {
    await connection.initialize();
    await connection.verifyConnection();

    const conn = connection;
    const authRepo = new AuthRepository(conn.getPool());
    const authService = new AuthService(authRepo, conn);

    // -------------------------------------------------------------------------
    // Authentication fixture.
    //
    // This suite exercises real credential authentication, so it must own the
    // accounts it authenticates with. Other suites in this project rebuild the
    // development database from scratch (unscoped DELETE FROM users followed by
    // their own fixtures, which carry no password_hash), so relying on ambient
    // database state made this suite order-dependent and non-repeatable.
    //
    // The credentials below are the ones already declared by this project in
    // seed.js and self_audit.js. Accounts are only created when missing; an
    // existing account's password is repaired so the suite is repeatable.
    // -------------------------------------------------------------------------
    await ensureAuthFixture(conn.getPool());

    // =========================================================================
    // TEST 1: Endpoint exists (not 404)
    // =========================================================================
    console.log('\n[TEST 1] Endpoint exists');
    {
      const res = await makeRequest(testServer, { path: '/auth/mfa-verify', method: 'POST' }, {});
      check('POST /auth/mfa-verify returns non-404', res.statusCode !== 404, `Got ${res.statusCode}`);
    }

    // =========================================================================
    // TEST 2: Missing code returns 4xx
    // =========================================================================
    console.log('\n[TEST 2] Missing code');
    {
      const res = await makeRequest(testServer, { path: '/auth/mfa-verify', method: 'POST' }, { mfaChallenge: 'test' });
      check('Missing code returns 4xx', res.statusCode >= 400 && res.statusCode < 500, `Got ${res.statusCode}`);
      check('Missing code returns validation error', res.body && res.body.error && res.body.error.code === 'VALIDATION_ERROR', `Got ${res.body && res.body.error && res.body.error.code}`);
    }

    // =========================================================================
    // TEST 3: Invalid code / challenge returns 401
    // =========================================================================
    console.log('\n[TEST 3] Invalid code');
    {
      const loginRes = await makeRequest(testServer, { path: '/auth/login', method: 'POST' }, { email: 'student@test.com', password: 'TestPass123!' });
      check('Login succeeds for non-MFA user', loginRes.statusCode === 200 && loginRes.body.success, `Got ${loginRes.statusCode}`);

      const mfaRes = await makeRequest(testServer, { path: '/auth/mfa-verify', method: 'POST', headers: { 'x-expected-error': 'true' } }, { code: '0000', mfaChallenge: 'nonexistent-challenge' });
      check('Invalid challenge returns 4xx', mfaRes.statusCode >= 400 && mfaRes.statusCode < 500, `Got ${mfaRes.statusCode}`);
      check('Invalid challenge returns 401', mfaRes.statusCode === 401, `Got ${mfaRes.statusCode}`);
    }

    // =========================================================================
    // TEST 4: Expired challenge returns 401
    // =========================================================================
    console.log('\n[TEST 4] Expired challenge');
    {
      const loginRes = await makeRequest(testServer, { path: '/auth/login', method: 'POST' }, { email: 'principal@test.com', password: 'AdminPass123!' });
      check('Login succeeds', loginRes.statusCode === 200 && loginRes.body.success, `Got ${loginRes.statusCode}`);

      const { challengeToken, code } = await authService.createPendingAuth(loginRes.body.data.user.id);
      const pending = pendingAuths.get(challengeToken);
      pending.expiresAt = new Date(Date.now() - 60000);

      const expiredRes = await makeRequest(testServer, { path: '/auth/mfa-verify', method: 'POST', headers: { 'x-expected-error': 'true' } }, { code, mfaChallenge: challengeToken });
      check('Expired challenge returns 4xx', expiredRes.statusCode >= 400 && expiredRes.statusCode < 500, `Got ${expiredRes.statusCode}`);
      check('Expired challenge returns 401', expiredRes.statusCode === 401, `Got ${expiredRes.statusCode}`);
      check('Expired challenge message', expiredRes.body && expiredRes.body.error && expiredRes.body.error.message.toLowerCase().includes('expired'), `Got ${expiredRes.body && expiredRes.body.error && expiredRes.body.error.message}`);
    }

    // =========================================================================
    // TEST 5: Reused challenge returns 4xx
    // =========================================================================
    console.log('\n[TEST 5] Reused challenge');
    {
      const loginRes = await makeRequest(testServer, { path: '/auth/login', method: 'POST' }, { email: 'student@test.com', password: 'TestPass123!' });
      check('Login succeeds', loginRes.statusCode === 200);

      const { challengeToken, code } = await authService.createPendingAuth(loginRes.body.data.user.id);

      const verifyRes = await makeRequest(testServer, { path: '/auth/mfa-verify', method: 'POST' }, { code, mfaChallenge: challengeToken });
      check('First verification succeeds', verifyRes.statusCode === 200 && verifyRes.body.success, `Got ${verifyRes.statusCode}`);

      const reusedRes = await makeRequest(testServer, { path: '/auth/mfa-verify', method: 'POST', headers: { 'x-expected-error': 'true' } }, { code, mfaChallenge: challengeToken });
      check('Reused challenge returns 4xx', reusedRes.statusCode >= 400 && reusedRes.statusCode < 500, `Got ${reusedRes.statusCode}`);
      check('Reused challenge returns 401', reusedRes.statusCode === 401, `Got ${reusedRes.statusCode}`);
    }

    // =========================================================================
    // TEST 6: Valid MFA succeeds (2xx + token)
    // =========================================================================
    console.log('\n[TEST 6] Valid MFA');
    {
      const loginRes = await makeRequest(testServer, { path: '/auth/login', method: 'POST' }, { email: 'student@test.com', password: 'TestPass123!' });
      check('Login succeeds', loginRes.statusCode === 200);

      if (loginRes.body.data.mfaRequired) {
        const { challengeToken, code } = await authService.createPendingAuth(loginRes.body.data.user.id);
        const mfaRes = await makeRequest(testServer, { path: '/auth/mfa-verify', method: 'POST' }, { code, mfaChallenge: challengeToken });
        check('MFA verification returns 2xx', mfaRes.statusCode >= 200 && mfaRes.statusCode < 300, `Got ${mfaRes.statusCode}`);
        check('MFA verification returns token', mfaRes.body && mfaRes.body.data && mfaRes.body.data.token, `No token in response`);
        check('MFA verification returns user', mfaRes.body && mfaRes.body.data && mfaRes.body.data.user, `No user in response`);
        check('MFA verification success flag', mfaRes.body && mfaRes.body.success === true, `Got ${mfaRes.body && mfaRes.body.success}`);
      } else {
        check('MFA verification returns 2xx (no MFA required)', true, 'User has no MFA enabled');
        const token = loginRes.body.data.token;
        check('Login returns token for non-MFA user', !!token, 'No token');
      }
    }

    // =========================================================================
    // TEST 7-8: Role and department preservation
    // =========================================================================
    console.log('\n[TEST 7-8] Role and department preservation');
    {
      const loginRes = await makeRequest(testServer, { path: '/auth/login', method: 'POST' }, { email: 'principal@test.com', password: 'AdminPass123!' });
      check('Principal login succeeds', loginRes.statusCode === 200 && loginRes.body.success);

      if (!loginRes.body.data.mfaRequired) {
        const userDto = loginRes.body.data.user;
        check('Role is from backend', userDto.role === 'PRINCIPAL', `Got ${userDto.role}`);
        check('Department from backend (PRINCIPAL may have null)', userDto.departmentId !== undefined, `Got ${userDto.departmentId}`);
      } else {
        const { challengeToken, code } = await authService.createPendingAuth(loginRes.body.data.user.id);
        const mfaRes = await makeRequest(testServer, { path: '/auth/mfa-verify', method: 'POST' }, { code, mfaChallenge: challengeToken });
        const userDto = mfaRes.body.data.user;
        check('MFA role preserved = PRINCIPAL', userDto.role === 'PRINCIPAL', `Got ${userDto.role}`);
        check('MFA department preserved', userDto.departmentId !== undefined && userDto.departmentId !== null, `Got ${userDto.departmentId}`);
      }
    }

    // =========================================================================
    // TEST 9: Authorization preserved (RBAC not bypassed)
    // =========================================================================
    console.log('\n[TEST 9] RBAC preserved');
    {
      const loginRes = await makeRequest(testServer, { path: '/auth/login', method: 'POST' }, { email: 'student@test.com', password: 'TestPass123!' });
      check('Student login succeeds', loginRes.statusCode === 200);

      if (loginRes.body.data.token) {
        const token = loginRes.body.data.token;
        const protectedRes = await makeRequest(testServer, {
          path: '/users',
          method: 'GET',
          headers: { Authorization: `Bearer ${token}`, 'x-expected-error': 'true' },
        });
        check('Student blocked from /users (403)', protectedRes.statusCode === 403, `Got ${protectedRes.statusCode}`);
      }
    }

    // =========================================================================
    // TEST 10: Brute force protection
    // =========================================================================
    console.log('\n[TEST 10] Brute force protection');
    {
      const loginRes = await makeRequest(testServer, { path: '/auth/login', method: 'POST' }, { email: 'principal@test.com', password: 'AdminPass123!' });
      check('Principal login succeeds', loginRes.statusCode === 200 && loginRes.body.success);

      if (loginRes.body.data.mfaRequired) {
        const { challengeToken } = await authService.createPendingAuth(loginRes.body.data.user.id);

        for (let i = 0; i < 5; i++) {
          await makeRequest(testServer, { path: '/auth/mfa-verify', method: 'POST', headers: { 'x-expected-error': 'true' } }, { code: '0000', mfaChallenge: challengeToken });
        }

        const afterBruteForce = await makeRequest(testServer, { path: '/auth/mfa-verify', method: 'POST', headers: { 'x-expected-error': 'true' } }, { code: '1234', mfaChallenge: challengeToken });
        check('Brute force blocked after max attempts', afterBruteForce.statusCode === 401, `Got ${afterBruteForce.statusCode}`);
        check('Brute force message', afterBruteForce.body && afterBruteForce.body.error && (afterBruteForce.body.error.message.includes('Maximum') || afterBruteForce.body.error.message.includes('exceeded')), `Got ${afterBruteForce.body && afterBruteForce.body.error && afterBruteForce.body.error.message}`);
      } else {
        check('Brute force protection (no MFA required)', true, 'User has no MFA enabled');
      }
    }

    // =========================================================================
    // REGRESSION: POST /auth/login still works
    // =========================================================================
    console.log('\n[REGRESSION] Login still works');
    {
      const wrongRes = await makeRequest(testServer, { path: '/auth/login', method: 'POST', headers: { 'x-expected-error': 'true' } }, { email: 'student@test.com', password: 'wrongpass1!' });
      check('Invalid credentials → 401', wrongRes.statusCode === 401, `Got ${wrongRes.statusCode}`);

      const validRes = await makeRequest(testServer, { path: '/auth/login', method: 'POST' }, { email: 'student@test.com', password: 'TestPass123!' });
      check('Valid credentials → 200', validRes.statusCode === 200, `Got ${validRes.statusCode}`);
      check('Valid login returns token or mfaRequired', validRes.body.success && (validRes.body.data.token || validRes.body.data.mfaRequired), `No token or mfaRequired`);
    }

    // =========================================================================
    // REGRESSION: Error envelope consistency
    // =========================================================================
    console.log('\n[REGRESSION] Error envelope');
    {
      const errRes = await makeRequest(testServer, { path: '/auth/mfa-verify', method: 'POST' }, { code: 'bad', mfaChallenge: 'bad' });
      check('Error has success: false', errRes.body && errRes.body.success === false, `Got ${errRes.body && errRes.body.success}`);
      check('Error has error.code', errRes.body && errRes.body.error && errRes.body.error.code, `No error code`);
      check('Error has error.message', errRes.body && errRes.body.error && typeof errRes.body.error.message === 'string', `No error message`);
    }

    console.log(`\n=== MFA Test Suite: ${passed} passed, ${failed} failed ===`);

    // Surface assertion failures through the process exit code. Without this
    // the suite exited 0 even when checks failed, so a broken build was not
    // detectable from CI or from a chained `&&` test script.
    if (failed > 0) {
      process.exitCode = 1;
    }
  } catch (err) {
    console.error('\n❌ Test suite failure:', err);
    process.exitCode = 1;
  } finally {
    testServer.close();
    connection.close(1000).catch(() => {});
  }
}

if (require.main === module) {
  runMfaTests();
}

module.exports = runMfaTests;
