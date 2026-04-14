import { chromium } from 'playwright';
import * as fs from 'fs';

async function debug() {
  const browser = await chromium.launch({
    headless: false,
    args: ['--disable-blink-features=AutomationControlled']
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
    locale: 'en-US',
  });

  await context.addInitScript(`
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
    });
  `);

  const page = await context.newPage();

  const searchPages = [
    'https://www.tiktok.com/discover/coffee-shops-in-nyc',
    'https://www.tiktok.com/tag/nyccoffeespot',
    'https://www.tiktok.com/tag/nyccoffeeshops',
  ];

  for (const url of searchPages) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Navigating to: ${url}`);
    console.log('='.repeat(60));

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(5000);

      const screenshotName = `debug-search-${url.split('/').pop()}.png`;
      await page.screenshot({ path: screenshotName, fullPage: true });
      console.log(`Screenshot saved: ${screenshotName}`);

      const htmlName = `debug-search-${url.split('/').pop()}.html`;
      const html = await page.content();
      fs.writeFileSync(htmlName, html);
      console.log(`HTML saved: ${htmlName}`);

      const bodyText = await page.locator('body').textContent() || '';
      const isLoginWall = bodyText.includes('Sign up') || bodyText.includes('Log in');
      const hasVideos = await page.locator('a[href*="/video/"]').count() > 0;
      const hasContent = await page.locator('div').count() > 50;

      console.log(`\n--- Page Status ---`);
      console.log(`  Login wall detected: ${isLoginWall}`);
      console.log(`  Video links found: ${await page.locator('a[href*="/video/"]').count()}`);
      console.log(`  Total links: ${await page.locator('a').count()}`);
      console.log(`  Total divs: ${await page.locator('div').count()}`);
      console.log(`  Body text (first 300 chars):`);
      console.log(`  ${bodyText.substring(0, 300).replace(/\n/g, ' ')}`);

      console.log('\n--- Checking key selectors ---');
      const selectors = [
        '[data-e2e="search_video-item"]',
        '[data-e2e="search_video_item"]',
        '[data-e2e="search-top"]',
        '[data-e2e="explore-item"]',
        '[data-e2e="challenge-item"]',
        '[data-e2e="discover-item"]',
        'a[href*="/video/"]',
        'a[href*="/@"]',
        'img[src*="tiktokcdn"]',
        'div[class*="DivItemContainer"]',
        'div[class*="ItemCard"]',
        'div[class*="FeedItem"]',
        'video',
      ];

      for (const sel of selectors) {
        const count = await page.locator(sel).count();
        if (count > 0) console.log(`  ✓ ${sel}: ${count}`);
      }

    } catch (error) {
      console.error(`Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  console.log('\n\nBrowser stays open 30s. Press Ctrl+C to exit.');
  await page.waitForTimeout(30000);
  await browser.close();
}

debug().catch(console.error);