const https = require('http');
const { URL } = require('url');

const tokens = JSON.parse(require('fs').readFileSync('C:/Users/sadbh/AppData/Local/Temp/kilo/role_tokens.json', 'utf8'));
const DEPT_CSE = '7f81c42a-d6b4-419f-833c-19ca04518114';
const DEPT_MATH = 'e5522267-0e50-4c42-98e5-d6120cebb50e';

async function api(path, token, method = 'GET', body = null) {
  const url = new URL('http://localhost:3000' + path);
  return new Promise((resolve) => {
    const opts = { method, headers: {} };
    if (token) opts.headers['Authorization'] = 'Bearer ' + token;
    if (body) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    const req = https.request(url, opts, (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => {
        let parsed; try { parsed = JSON.parse(data); } catch (e) { parsed = { raw: data }; }
        resolve({ status: res.statusCode, body: parsed });
      });
    });
    req.on('error', (e) => resolve({ status: 0, error: e.message }));
    req.end();
  });
}

async function main() {
  const results = [];

  // === RBAC: Allowed operations ===
  // PRINCIPAL can access /users
  let r = await api('/users', tokens.PRINCIPAL);
  results.push(['PRINCIPAL GET /users (allowed)', r.status === 200 ? 'PASS' : 'FAIL', `status=${r.status}`]);

  // HOD_CSE can access /users
  r = await api('/users', tokens.HOD_CSE);
  results.push(['HOD_CSE GET /users (allowed)', r.status === 200 ? 'PASS' : 'FAIL', `status=${r.status}`]);

  // HOD_MATH can access /users
  r = await api('/users', tokens.HOD_MATH);
  results.push(['HOD_MATH GET /users (allowed)', r.status === 200 ? 'PASS' : 'FAIL', `status=${r.status}`]);

  // FACULTY can access /users
  r = await api('/users', tokens.FACULTY);
  results.push(['FACULTY GET /users (allowed)', r.status === 200 ? 'PASS' : 'FAIL', `status=${r.status}`]);

  // STUDENT cannot access /users (unauthorized)
  r = await api('/users', tokens.STUDENT2);
  results.push(['STUDENT GET /users (denied)', r.status === 403 ? 'PASS' : 'FAIL', `status=${r.status}`]);

  // PARENT cannot access /users (unauthorized)
  r = await api('/users', tokens.PARENT);
  results.push(['PARENT GET /users (denied)', r.status === 403 ? 'PASS' : 'FAIL', `status=${r.status}`]);

  // === RBAC: Department scoping ===
  // HOD_CSE (CSE dept) should see only CSE users
  r = await api('/users', tokens.HOD_CSE);
  let cseCount = 0;
  if (r.status === 200 && r.body.data) {
    cseCount = r.body.data.filter(u => u.departmentId === DEPT_CSE).length;
    let mathDeptCount = r.body.data.filter(u => u.departmentId === DEPT_MATH).length;
    results.push(['HOD_CSE sees CSE users (allowed)', cseCount > 0 ? 'PASS' : 'FAIL', `cse=${cseCount}`]);
    results.push(['HOD_CSE does NOT see MATH users (denied)', mathDeptCount === 0 ? 'PASS' : 'FAIL', `math=${mathDeptCount}`]);
  } else {
    results.push(['HOD_CSE dept scope', 'FAIL', `status=${r.status}`]);
  }

  // HOD_MATH (MATH dept) should see only MATH users, not CSE
  r = await api('/users', tokens.HOD_MATH);
  if (r.status === 200 && r.body.data) {
    let cseSeenByMath = r.body.data.filter(u => u.departmentId === DEPT_CSE).length;
    let mathSeen = r.body.data.filter(u => u.departmentId === DEPT_MATH).length;
    results.push(['HOD_MATH sees MATH users (allowed)', mathSeen > 0 ? 'PASS' : 'FAIL', `math=${mathSeen}`]);
    results.push(['HOD_MATH does NOT see CSE users (denied)', cseSeenByMath === 0 ? 'PASS' : 'FAIL', `cse=${cseSeenByMath}`]);
  }

  // PRINCIPAL sees ALL users (institution-wide)
  r = await api('/users', tokens.PRINCIPAL);
  if (r.status === 200 && r.body.data) {
    let totalUsers = r.body.meta.total;
    results.push(['PRINCIPAL sees all 11 users (institution-wide)', totalUsers === 11 ? 'PASS' : 'FAIL', `total=${totalUsers}`]);
  }

  // === Department cross-access on student data ===
  // Student2 (CSE) GET /students/me should work (own scope)
  r = await api('/students/me', tokens.STUDENT2);
  results.push(['STUDENT2 GET /students/me (own scope)', r.status === 200 ? 'PASS' : 'FAIL', `status=${r.status}`]);

  // Student2 (CSE) trying GET /students (HOD+ only, so denied by role)
  r = await api('/students', tokens.STUDENT2);
  results.push(['STUDENT2 GET /students (denied by role)', r.status === 403 ? 'PASS' : 'FAIL', `status=${r.status}`]);

  // Faculty (CSE dept) GET /faculties - should see CSE faculty only
  r = await api('/faculties', tokens.FACULTY);
  if (r.status === 200 && r.body.data) {
    let cseFac = r.body.data.length;
    results.push(['FACULTY GET /faculties (allowed)', cseFac > 0 ? 'PASS' : 'FAIL', `count=${cseFac}`]);
  }

  // Faculty (CSE) trying to access math dept faculty data via /faculties/:id would need math faculty id
  // PRINCIPAL creates a user in MATH dept — should be allowed (ALL scope)
  const newUser = { name: 'Test RBAC User', email: 'rbactest@test.com', role: 'STUDENT', departmentId: DEPT_MATH };
  r = await api('/users', tokens.PRINCIPAL, 'POST', newUser);
  // Note: HOD creating across-dept user should fail
  const crossDeptUser = { name: 'Cross Dept', email: 'cross@test.com', role: 'STUDENT', departmentId: DEPT_MATH };
  r = await api('/users', tokens.HOD_CSE, 'POST', crossDeptUser);
  results.push(['HOD_CSE POST user in MATH dept (denied)', r.status === 403 ? 'PASS' : 'FAIL', `status=${r.status}`]);

  // Cleanup: delete the RBAC test user via PRINCIPAL
  if (global.rbactestId) {}

  // Print summary
  console.log('\n=== RBAC MATRIX RESULTS ===');
  let pass = 0, fail = 0;
  results.forEach(([name, status, detail]) => {
    console.log(`  ${status}: ${name} — ${detail}`);
    if (status === 'PASS') pass++; else fail++;
  });
  console.log(`\nRBAC TOTAL: ${results.length} | PASS: ${pass} | FAIL: ${fail}`);
}

main().catch(e => { console.error(e); process.exit(1); });
