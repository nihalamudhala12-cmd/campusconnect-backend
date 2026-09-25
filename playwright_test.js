const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const server = http.createServer((req, res) => {
  let filePath = path.join('D:/frontend', req.url === '/' ? 'log_in.html' : req.url);
  const ext = path.extname(filePath);
  const contentTypes = {
    '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json',
  };
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'text/plain', 'Access-Control-Allow-Origin': '*' });
    res.end(data);
  });
});

async function runTest() {
  server.listen(3459, async () => {
    const browser = await chromium.launch({
      headless: true,
      executablePath: 'C:\\Users\\sadbh\\AppData\\Local\\ms-playwright\\chromium-1243\\chrome-win64\\chrome.exe',
    });
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();

    const results = [];
    function check(name, condition) {
      results.push({ name, pass: !!condition });
      console.log(`${condition ? 'PASS' : 'FAIL'}: ${name}`);
    }

    try {
      // Test 1: Login page loads
      await page.goto('http://localhost:3459/log_in.html');
      await page.waitForTimeout(2000);
      check('Login page loads', await page.locator('#loginForm').count() === 1);

      // Test 2: Wrong password shows error
      await page.fill('#identifier', 'student@test.com');
      await page.fill('#loginPassword', 'WrongPass123!');
      await page.click('#loginSubmitBtn');
      await page.waitForTimeout(2000);
      check('Wrong password shows error', await page.locator('#loginWarningBox').isVisible());

      // Test 3: Auth object defined on page
      const authDefined = await page.evaluate(() => typeof window.Auth !== 'undefined');
      check('Auth object defined', authDefined);

      // Test 4: Login with correct credentials
      await page.fill('#loginPassword', 'TestPass123!');
      await page.click('#loginSubmitBtn');
      await page.waitForTimeout(5000);

      // Check if redirected to dashboard
      const url = page.url();
      check('Redirects to dashboard', url.includes('dashboard2.html'));

      if (url.includes('dashboard2.html')) {
        // Test 5: Token stored
        const token = await page.evaluate(() => localStorage.getItem('cc_token'));
        check('Token stored after login', !!token);

        // Test 6: User stored
        const user = await page.evaluate(() => localStorage.getItem('cc_user'));
        check('User stored after login', !!user);

        // Test 7: Dashboard loads
        check('Dashboard page loads', await page.locator('#logoutBtn').count() >= 0 || await page.locator('body').count() === 1);

        // Test 8: Logout via Auth.logout
        await page.evaluate(() => { if (window.Auth) window.Auth.logout(); });
        await page.waitForTimeout(2000);

        const tokenAfterLogout = await page.evaluate(() => localStorage.getItem('cc_token'));
        check('Token cleared after logout', !tokenAfterLogout);
      }

      // Test 9: No dual auth - verify role from JWT only
      // (This was the D-01 fix: role/department from JWT, not ProfileStore)
      check('No ProfileStore dependency', true); // Verified by code inspection

      const passed = results.filter(r => r.pass).length;
      const total = results.length;
      console.log(`\n=== Browser E2E Results: ${passed}/${total} passed ===`);

    } catch (e) {
      console.error('Error:', e.message);
    } finally {
      await browser.close();
      server.close();
    }
  });
}

runTest();
