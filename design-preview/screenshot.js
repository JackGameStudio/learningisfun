const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('http://localhost:8080/style-1-pixel.html', { waitUntil: 'networkidle' });
  await page.screenshot({ path: 'preview.png', fullPage: true });
  await browser.close();
  console.log('Screenshot saved: preview.png');
})();