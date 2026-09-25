const http = require('http');

function makeReq(path, method, headers, postData) {
  return new Promise((resolve, reject) => {
    const options = { hostname: 'localhost', port: 3000, path, method, headers };
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(body) }); }
        catch(e) { resolve({ status: res.statusCode, body: body }); }
      });
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function run() {
  console.log('=== Full Login Flow with MFA ===\n');

  // Step 1: Login
  const loginRes = await makeReq('/auth/login', 'POST', { 'Content-Type': 'application/json' },
    JSON.stringify({ email: 'student@test.com', password: 'TestPass123!' }));

  console.log('Login status:', loginRes.status);
  console.log('Login success:', loginRes.body.success);
  console.log('MFA required:', loginRes.body.data.mfaRequired);
  console.log('MFA challenge present:', !!loginRes.body.data.mfaChallenge);
  console.log('Debug code (dev only):', loginRes.body.data._debugCode);
  console.log('User role:', loginRes.body.data.user.role);
  console.log('User departmentId:', loginRes.body.data.user.departmentId);

  // Step 2: MFA Verify
  const mfaRes = await makeReq('/auth/mfa-verify', 'POST', { 'Content-Type': 'application/json' },
    JSON.stringify({ code: loginRes.body.data._debugCode, mfaChallenge: loginRes.body.data.mfaChallenge }));

  console.log('\nMFA Verify status:', mfaRes.status);
  console.log('MFA success:', mfaRes.body.success);
  console.log('Token present:', !!mfaRes.body.data.token);
  console.log('Token preview:', mfaRes.body.data.token ? mfaRes.body.data.token.substring(0, 40) + '...' : 'none');
  console.log('User role:', mfaRes.body.data.user.role);

  const token = mfaRes.body.data.token;

  // Step 3: Test AI health with real Bearer token
  console.log('\n=== AI Health Check (with Bearer JWT) ===\n');
  const healthRes = await makeReq('/api/ai/health', 'GET', { 'Authorization': 'Bearer ' + token });
  console.log('Health status:', healthRes.status);
  console.log('Health body:', JSON.stringify(healthRes.body, null, 2));
  if (!JSON.stringify(healthRes.body).includes('Bearer') && !JSON.stringify(healthRes.body).includes(token)) {
    console.log('PASS: No token leaked in health response');
  }

  // Step 4: Test AI config with real Bearer token
  console.log('\n=== AI Config (with Bearer JWT) ===\n');
  const configRes = await makeReq('/api/ai/config', 'GET', { 'Authorization': 'Bearer ' + token });
  console.log('Config status:', configRes.status);
  console.log('Config body:', JSON.stringify(configRes.body, null, 2));
  if (!JSON.stringify(configRes.body).includes('your-api-key') && !JSON.stringify(configRes.body).includes(token)) {
    console.log('PASS: No API key or token leaked in config response');
  }

  // Step 5: Test AI chat with real Bearer token
  console.log('\n=== AI Chat (with Bearer JWT) ===\n');
  const chatRes = await makeReq('/api/ai/chat', 'POST', { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    JSON.stringify({ message: 'Hello, what is my role?' }));
  console.log('Chat status:', chatRes.status);
  console.log('Chat body:', JSON.stringify(chatRes.body, null, 2));
  if (!JSON.stringify(chatRes.body).includes('your-api-key') && !JSON.stringify(chatRes.body).includes(token)) {
    console.log('PASS: No API key or token leaked in chat response');
  }

  // Step 6: Test unauthorized (no token)
  console.log('\n=== Unauthorized Access Test ===\n');
  const unauthRes = await makeReq('/api/ai/chat', 'POST', { 'Content-Type': 'application/json' },
    JSON.stringify({ message: 'Hello' }));
  console.log('Unauth status:', unauthRes.status);
  console.log('Unauth body:', JSON.stringify(unauthRes.body, null, 2));
  if (unauthRes.status === 401) {
    console.log('PASS: Unauthenticated request returns 401');
  }

  console.log('\n=== ALL AUTH FLOW TESTS COMPLETE ===');
}

run().catch(e => console.error('Error:', e));
