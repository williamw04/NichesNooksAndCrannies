import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import * as path from 'path';
import * as fs from 'fs';

chromium.use(StealthPlugin());

async function debug() {
  const browser = await chromium.launch({
    headless: false,
    slowMo: 100,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-infobars',
      '--disable-extensions',
      '--no-first-run',
      '--disable-features=IsolateOrigins,site-per-process'
    ]
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
    locale: 'en-US',
    timezoneId: 'America/New_York',
    colorScheme: 'light',
    hasTouch: false,
    isMobile: false
  });

  await context.addInitScript(`
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
    });
    Object.defineProperty(navigator, 'plugins', {
      get: () => [1, 2, 3, 4, 5],
    });
    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-US', 'en'],
    });
    window.chrome = { runtime: {} };
  `);

  const page = await context.newPage();

  const searchUrl = 'https://www.tiktok.com/search?q=best+coffee+NYC';
  console.log(`Navigating to: ${searchUrl}`);

  await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

  console.log('Page loaded, waiting for content...');
  await page.waitForTimeout(5000);

  console.log('Scrolling to trigger lazy load...');
  for (let i = 0; i < 5; i++) {
    await page.mouse.wheel(0, 800);
    await page.waitForTimeout(1500);
  }

  await page.waitForTimeout(3000);

  const screenshotPath = path.join(process.cwd(), 'debug-screenshot.png');
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`Screenshot saved to: ${screenshotPath}`);

  const htmlPath = path.join(process.cwd(), 'debug-page.html');
  const html = await page.content();
  fs.writeFileSync(htmlPath, html);
  console.log(`HTML saved to: ${htmlPath}`);

  console.log('\nChecking for elements...');
  
  const selectors = [
    '[data-e2e="search_video-item"]',
    '[data-e2e="search_video_item"]',
    'div[data-e2e="search-video-item"]',
    '[class*="DivItemContainer"]',
    '[class*="ItemContainer"]',
    'a[href*="/video/"]'
  ];

  for (const sel of selectors) {
    const count = await page.locator(sel).count();
    console.log(`${sel}: ${count} elements`);
  }

  const bodyText = await page.locator('body').textContent();
  console.log('\nPage body preview (first 800 chars):');
  console.log(bodyText?.substring(0, 800));

  if (bodyText?.includes('Sign up') || bodyText?.includes('Log in')) {
    console.log('\n⚠️  Login wall detected!');
  }

  console.log('\nBrowser will stay open for 60 seconds. Press Ctrl+C to close...');
  
  await page.waitForTimeout(30000);

  await browser.close();
}

debug().catch(console.error);