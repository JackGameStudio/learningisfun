const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto('file:///C:/Users/jack/.qclaw/workspace/learningisfun/design-preview/style-2-modern.html', { waitUntil: 'networkidle' });
  await page.screenshot({ path: 'preview-style2.png' });
  await browser.close();
  console.log('Done');
})();