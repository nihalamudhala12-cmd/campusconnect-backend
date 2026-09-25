const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') console.log('[CONSOLE ERROR]', msg.text().substring(0, 200));
    if (msg.type() === 'log') console.log('[CONSOLE LOG]', msg.text().substring(0, 200));
  });
  page.on('pageerror', err => console.log('[PAGE ERROR]', err.message));
  page.on('response', resp => {
    if (resp.url().includes('localhost:3000') && resp.status() >= 400) {
      resp.text().then(t => console.log('[API ERROR]', resp.url(), resp.status(), t.substring(0, 200)));
    }
    if (resp.url().includes('localhost:3000/auth/login')) {
      resp.text().then(t => console.log('[LOGIN RESP]', resp.status(), t.substring(0, 300)));
    }
  });

  await page.goto('http://localhost:8080/log_in.html');
  await page.waitForLoadState('networkidle');
  console.log('Page loaded:', page.url());

  await page.fill('#identifier', 'principal@test.com');
  await page.fill('#loginPassword', 'AdminPass123!');
  console.log('Fields filled');

  await page.waitForTimeout(500);

  const submitResult = await page.evaluate(() => {
    const form = document.getElementById('loginForm');
    if (form && form.requestSubmit) {
      form.requestSubmit();
      return 'submitted';
    }
    const btn = document.getElementById('loginSubmitBtn');
    if (btn) { btn.click(); return 'clicked'; }
    return 'no form/button';
  });
  console.log('Submit:', submitResult);

  try {
    await page.waitForURL('**/dashboard2.html', { timeout: 10000 });
    console.log('Redirected to:', page.url());
  } catch(e) {
    console.log('No redirect after 10s. Current URL:', page.url());
    await page.waitForTimeout(2000);
    console.log('Still at:', page.url());
  }

  await browser.close();
})();
