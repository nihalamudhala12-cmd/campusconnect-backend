const http = require('http');
const { app } = require('./src/app');
const connection = require('./src/infrastructure/database/connection');

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

async function test() {
  await connection.initialize();
  await connection.verifyConnection();
  
  const server = app.listen(0, async () => {
    const port = server.address().port;
    
    // Test 1: Unauthenticated access to /notifications
    console.log('=== TEST 1: Unauthenticated access ===');
    const res1 = await makeRequest(server, { path: '/notifications', method: 'GET' }, null);
    console.log('Status:', res1.statusCode, 'Expected: 401');
    console.log('Body:', JSON.stringify(res1.body));
    
    // Test 2: User A accessing User B's notification via /notifications/:id
    console.log('\n=== TEST 2: User A accessing User B notification ===');
    const res2 = await makeRequest(server, { 
      path: '/notifications/211e4567-e89b-12d3-a456-426614174001', 
      method: 'GET',
      headers: { 'x-user-id': '211e4567-e89b-12d3-a456-426614174003', 'x-user-role': 'FACULTY', 'x-user-dept': 'cb704881-e676-44ce-864b-4cc11e93e41f' }
    }, null);
    console.log('Status:', res2.statusCode, 'Expected: 404 or 403');
    console.log('Body:', JSON.stringify(res2.body));
    
    // Test 3: User A accessing /users/UserB/notifications
    console.log('\n=== TEST 3: User A accessing /users/UserB/notifications ===');
    const res3 = await makeRequest(server, { 
      path: '/users/211e4567-e89b-12d3-a456-426614174001/notifications', 
      method: 'GET',
      headers: { 'x-user-id': '211e4567-e89b-12d3-a456-426614174003', 'x-user-role': 'FACULTY', 'x-user-dept': 'cb704881-e676-44ce-864b-4cc11e93e41f' }
    }, null);
    console.log('Status:', res3.statusCode, 'Expected: 403');
    console.log('Body:', JSON.stringify(res3.body));
    
    // Test 4: User A creating notification for User B
    console.log('\n=== TEST 4: User A creating notification for User B ===');
    const res4 = await makeRequest(server, { 
      path: '/notifications', 
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': '211e4567-e89b-12d3-a456-426614174003', 'x-user-role': 'FACULTY', 'x-user-dept': 'cb704881-e676-44ce-864b-4cc11e93e41f' }
    }, {
      userId: '211e4567-e89b-12d3-a456-426614174001',
      type: 'SYSTEM',
      title: 'Test',
      message: 'Test message'
    });
    console.log('Status:', res4.statusCode, 'Expected: 403');
    console.log('Body:', JSON.stringify(res4.body));
    
    // Test 5: SQL injection attempt
    console.log('\n=== TEST 5: SQL injection attempt ===');
    const res5 = await makeRequest(server, { 
      path: '/notifications/211e4567-e89b-12d3-a456-426614174001%27%20OR%20%271=1', 
      method: 'GET',
      headers: { 'x-user-id': '211e4567-e89b-12d3-a456-426614174003', 'x-user-role': 'FACULTY', 'x-user-dept': 'cb704881-e676-44ce-864b-4cc11e93e41f' }
    }, null);
    console.log('Status:', res5.statusCode, 'Expected: 422 (VALIDATION_ERROR — app contract for malformed input)');
    console.log('Body:', JSON.stringify(res5.body));
    
    server.close();
    await connection.close(1000).catch(() => {});
    console.log('\n=== Tests Complete ===');
  });
}

test().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});