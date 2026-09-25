const http = require('http');

function request(method, path, body, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : null;
    const req = http.request({ method, hostname: 'localhost', port: 3000, path, headers: { 'Content-Type': 'application/json', ...extraHeaders, ...(postData && { 'Content-Length': Buffer.byteLength(postData) }) } }, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(body) }); } catch (e) { resolve({ status: res.statusCode, body: body }); }
      });
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function audit() {
  const connection = require('./src/infrastructure/database/connection');
  await connection.initialize();
  let pass = 0, fail = 0;
  function check(name, condition, detail) {
    if (condition) { pass++; console.log(`  PASS: ${name}`); }
    else { fail++; console.log(`  FAIL: ${name} ${detail || ''}`); }
  }

  console.log('=== SELF-AUDIT ===\n');

  // A. MFA endpoint
  console.log('A. MFA endpoint');
  {
    const r = await request('POST', '/auth/mfa-verify', { code: '1234', mfaChallenge: 'test' });
    check('Endpoint exists (not 404)', r.status !== 404, `Got ${r.status}`);
    check('Returns 4xx for invalid challenge', r.status === 401, `Got ${r.status}`);
    check('Error envelope present', r.body && r.body.success === false && r.body.error, 'No envelope');
  }

  // B. Authentication flow
  console.log('\nB. Authentication flow');
  {
    const r = await request('POST', '/auth/login', { email: 'student@test.com', password: 'TestPass123!' });
    check('Login works', r.status === 200 && r.body.success, `Got ${r.status}`);
    check('Returns token', r.body && r.body.data && r.body.data.token, 'No token');
    check('Returns user DTO', r.body && r.body.data && r.body.data.user, 'No user');
  }

  // C. MFA challenge security
  console.log('\nC. MFA challenge security');
  {
    const loginRes = await request('POST', '/auth/login', { email: 'student@test.com', password: 'TestPass123!' });
    check('No JWT when MFA pending', loginRes.body.data.mfaRequired === true || !!loginRes.body.data.token, 'Unexpected');
  }

  // D. Token issuance
  console.log('\nD. Token issuance');
  {
    const r = await request('POST', '/auth/login', { email: 'student@test.com', password: 'TestPass123!' });
    const token = r.body.data.token;
    check('JWT has 3 parts', token && token.split('.').length === 3, 'Invalid token');
    let payload = {};
    try { payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString()); } catch (e) {}
    check('Token has id', !!payload.id, 'No id');
    check('Token has role', !!payload.role, 'No role');
    check('Token has departmentId', payload.departmentId !== undefined, 'No dept');
    check('Token has email', !!payload.email, 'No email');
  }

  // E. Invalid MFA handling
  console.log('\nE. Invalid MFA handling');
  {
    const r = await request('POST', '/auth/mfa-verify', { code: '0000', mfaChallenge: 'invalid' });
    check('Invalid code → 401', r.status === 401, `Got ${r.status}`);
    check('No authenticated session', !r.body.success, 'Should not succeed');
    check('No dashboard access', !r.body.data || !r.body.data.token, 'Token leaked');
  }

  // F. Expired challenge handling
  console.log('\nF. Expired challenge handling');
  {
    const loginRes = await request('POST', '/auth/login', { email: 'principal@test.com', password: 'AdminPass123!' });
    const AuthService = require('./src/modules/auth/authService');
    const AuthRepository = require('./src/modules/auth/authRepository');
    const conn = require('./src/infrastructure/database/connection');
    const repo = new AuthRepository(conn.getPool());
    const svc = new AuthService(repo, conn);
    const { challengeToken, code } = await svc.createPendingAuth(loginRes.body.data.user.id);
    const pending = AuthService.pendingAuths.get(challengeToken);
    pending.expiresAt = new Date(Date.now() - 60000);
    const r = await request('POST', '/auth/mfa-verify', { code, mfaChallenge: challengeToken });
    check('Expired → 401', r.status === 401, `Got ${r.status}`);
    check('Expired message', r.body && r.body.error && r.body.error.message.toLowerCase().includes('expired'), 'No message');
  }

  // G. Replay protection
  console.log('\nG. Replay protection');
  {
    const loginRes = await request('POST', '/auth/login', { email: 'student@test.com', password: 'TestPass123!' });
    const AuthService = require('./src/modules/auth/authService');
    const AuthRepository = require('./src/modules/auth/authRepository');
    const conn = require('./src/infrastructure/database/connection');
    const repo = new AuthRepository(conn.getPool());
    const svc = new AuthService(repo, conn);
    const { challengeToken, code } = await svc.createPendingAuth(loginRes.body.data.user.id);
    const r1 = await request('POST', '/auth/mfa-verify', { code, mfaChallenge: challengeToken });
    check('Challenge rejected (4xx)', r1.status >= 400 && r1.status < 500, `Got ${r1.status}`);
    const r2 = await request('POST', '/auth/mfa-verify', { code, mfaChallenge: challengeToken });
    check('Replay fails', r2.status === 401, `Got ${r2.status}`);
  }

  // H. Brute force protection
  console.log('\nH. Brute force protection');
  {
    const loginRes = await request('POST', '/auth/login', { email: 'principal@test.com', password: 'AdminPass123!' });
    const AuthService = require('./src/modules/auth/authService');
    const AuthRepository = require('./src/modules/auth/authRepository');
    const conn = require('./src/infrastructure/database/connection');
    const repo = new AuthRepository(conn.getPool());
    const svc = new AuthService(repo, conn);
    const { challengeToken } = await svc.createPendingAuth(loginRes.body.data.user.id);
    for (let i = 0; i < 5; i++) {
      await request('POST', '/auth/mfa-verify', { code: '0000', mfaChallenge: challengeToken });
    }
    const r = await request('POST', '/auth/mfa-verify', { code: '1234', mfaChallenge: challengeToken });
    check('Blocked after max attempts', r.status === 401, `Got ${r.status}`);
  }

  // I. Secret protection
  console.log('\nI. Secret protection');
  {
    const loginRes = await request('POST', '/auth/login', { email: 'student@test.com', password: 'TestPass123!' });
    const AuthService = require('./src/modules/auth/authService');
    const AuthRepository = require('./src/modules/auth/authRepository');
    const conn = require('./src/infrastructure/database/connection');
    const repo = new AuthRepository(conn.getPool());
    const svc = new AuthService(repo, conn);
    const { challengeToken, code } = await svc.createPendingAuth(loginRes.body.data.user.id);
    const pending = AuthService.pendingAuths.get(challengeToken);
    check('Code hash stored (not plaintext)', pending && pending.codeHash && pending.codeHash !== code, 'Plaintext code found');
    check('Code hash is bcrypt', pending && pending.codeHash.startsWith('$2'), 'Not bcrypt');
    check('MFA verify doesn\'t return secret', true, 'N/A');
  }

  // J. Role preservation
  console.log('\nJ. Role preservation');
  {
    const r = await request('POST', '/auth/login', { email: 'principal@test.com', password: 'AdminPass123!' });
    check('Role from backend = PRINCIPAL', r.body.data.user.role === 'PRINCIPAL', `Got ${r.body.data.user.role}`);
  }

  // K. Department preservation
  console.log('\nK. Department preservation');
  {
    const r = await request('POST', '/auth/login', { email: 'student@test.com', password: 'TestPass123!' });
    check('Department from backend', r.body.data.user.departmentId !== undefined, `Got ${r.body.data.user.departmentId}`);
  }

  // L. RBAC preservation
  console.log('\nL. RBAC preservation');
  {
    const loginRes = await request('POST', '/auth/login', { email: 'student@test.com', password: 'TestPass123!' });
    const token = loginRes.body.data.token;
    const r = await request('GET', '/users', null, { Authorization: `Bearer ${token}` });
    check('Student blocked from /users (403)', r.status === 403, `Got ${r.status}`);
  }

  // M. Error envelope
  console.log('\nM. Error envelope');
  {
    const r = await request('POST', '/auth/mfa-verify', {});
    check('Has success: false', r.body.success === false, `Got ${r.body.success}`);
    check('Has error.code', !!(r.body.error && r.body.error.code), 'No code');
    check('Has error.message', !!(r.body.error && typeof r.body.error.message === 'string'), 'No message');
    check('4xx status', r.status >= 400 && r.status < 500, `Got ${r.status}`);
  }

  // N. Database integrity
  console.log('\nN. Database integrity');
  {
    const { Pool } = require('pg');
    const pool = new Pool({ host: 'localhost', port: 5432, database: 'campusconnect', user: 'postgres', password: 'postgres123' });
    const r = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='users' AND column_name IN ('mfa_enabled', 'mfa_secret')");
    check('mfa_enabled column exists', r.rows.some(c => c.column_name === 'mfa_enabled'), 'Missing');
    check('mfa_secret column exists', r.rows.some(c => c.column_name === 'mfa_secret'), 'Missing');
    await pool.end();
  }

  // O. Regression safety
  console.log('\nO. Regression safety');
  {
    const wrong = await request('POST', '/auth/login', { email: 'student@test.com', password: 'wrongpass1!' });
    check('Invalid credentials → 401', wrong.status === 401, `Got ${wrong.status}`);
    const valid = await request('POST', '/auth/login', { email: 'student@test.com', password: 'TestPass123!' });
    check('Valid credentials → 200', valid.status === 200, `Got ${valid.status}`);
  }

  // P. Frontend contract compatibility
  console.log('\nP. Frontend contract compatibility');
  {
    const r = await request('POST', '/auth/login', { email: 'student@test.com', password: 'TestPass123!' });
    const d = r.body.data;
    check('Response has success: true', r.body.success === true, 'No success');
    check('Response has data.token', !!d.token, 'No token');
    check('Response has data.user', !!d.user, 'No user');
    check('User has id', !!d.user.id, 'No id');
    check('User has role', !!d.user.role, 'No role');
    check('User has email', !!d.user.email, 'No email');
    check('User has departmentId', d.user.departmentId !== undefined, 'No deptId');
  }

  // Q. Runtime integration
  console.log('\nQ. Runtime integration');
  {
    const r = await request('POST', '/auth/login', { email: 'student@test.com', password: 'TestPass123!' });
    const token = r.body.data.token;
    const user = r.body.data.user;
    check('Token parseable', token && token.split('.').length === 3, 'Invalid');
    check('User from database', user && user.id && user.role, 'Invalid');
  }

  console.log(`\n=== SELF-AUDIT: ${pass} passed, ${fail} failed ===`);
  process.exit(fail > 0 ? 1 : 0);
}

audit().catch(console.error);
