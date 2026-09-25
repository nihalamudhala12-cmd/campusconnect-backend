const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const server = http.createServer((req, res) => {
  let filePath = path.join('D:/frontend', req.url === '/' ? 'log_in.html' : decodeURIComponent(req.url));
  const ext = path.extname(filePath);
  const contentTypes = {
    '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json',
  };
  fs.readFile(filePath, (err, data) => {
    if (err) {
      console.log('404:', filePath);
      res.writeHead(404); res.end('Not found'); return;
    }
    res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'text/plain', 'Access-Control-Allow-Origin': '*' });
    res.end(data);
  });
});

async function runTest() {
  server.listen(3460, async () => {
    const browser = await chromium.launch({
      headless: true,
      executablePath: 'C:\\Users\\sadbh\\AppData\\Local\\ms-playwright\\chromium-1243\\chrome-win64\\chrome.exe',
    });
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();

    page.on('console', msg => console.log('[console]', msg.type(), msg.text()));
    page.on('pageerror', err => console.log('[pageerror]', err.message));
    page.on('requestfailed', req => console.log('[reqfail]', req.url(), req.failure().errorText));

    try {
      await page.goto('http://localhost:3460/log_in.html');
      await page.waitForTimeout(3000);

      // Check if services loaded
      const apiLoaded = await page.evaluate(() => typeof window.API !== 'undefined');
      const authLoaded = await page.evaluate(() => typeof window.Auth !== 'undefined');
      console.log('API loaded:', apiLoaded);
      console.log('Auth loaded:', authLoaded);

      // Check login warning box state
      const warningHidden = await page.evaluate(() => {
        const box = document.getElementById('loginWarningBox');
        return box ? box.classList.contains('hidden') : 'not found';
      });
      console.log('Warning hidden:', warningHidden);

      // Try login with wrong password
      await page.fill('#identifier', 'student@test.com');
      await page.fill('#loginPassword', 'WrongPass123!');
      await page.click('#loginSubmitBtn');
      await page.waitForTimeout(3000);

      const warningHiddenAfter = await page.evaluate(() => {
        const box = document.getElementById('loginWarningBox');
        return box ? { hidden: box.classList.contains('hidden'), text: box.textContent } : 'not found';
      });
      console.log('After wrong password:', JSON.stringify(warningHiddenAfter));

      const url = page.url();
      console.log('URL after wrong login:', url);

      const token = await page.evaluate(() => localStorage.getItem('cc_token'));
      console.log('Token:', token);

    } catch (e) {
      console.error('Error:', e.message);
    } finally {
      await browser.close();
      server.close();
    }
  });
}

runTest();
