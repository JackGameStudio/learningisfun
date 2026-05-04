const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  // iPhone 标准分辨率 (iPhone 12/13/14/15)
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto('http://localhost:8080/style-1-pixel.html', { waitUntil: 'networkidle' });
  await page.screenshot({ path: 'preview-iphone.png' });
  await browser.close();
  console.log('iPhone screenshot saved (393x852)');
})();