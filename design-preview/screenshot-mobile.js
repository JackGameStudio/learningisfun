const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  // 手机屏幕比例
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://localhost:8080/style-1-pixel.html', { waitUntil: 'networkidle' });
  await page.screenshot({ path: 'preview-mobile.png' });
  await browser.close();
  console.log('Mobile screenshot saved');
})();