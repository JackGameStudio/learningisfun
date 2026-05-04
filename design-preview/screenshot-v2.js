const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto('file:///C:/Users/jack/.qclaw/workspace/learningisfun/design-preview/style-1-pixel.html', { waitUntil: 'networkidle' });
  await page.screenshot({ path: 'preview-iphone-v2.png' });
  await browser.close();
  console.log('Done');
})();