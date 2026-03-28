import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

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

  const page = await context.newPage();

  const query = 'best coffee spots NYC tiktok';
  const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
  console.log(`Navigating to: ${url}`);

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);

  await page.screenshot({ path: 'debug-google.png', fullPage: true });
  console.log('Screenshot saved: debug-google.png');

  const html = await page.content();
  fs.writeFileSync('debug-google.html', html);
  console.log('HTML saved: debug-google.html');

  console.log('\n=== Checking selectors ===');

  const selectors = {
    'div.g': await page.locator('div.g').count(),
    'div[data-sokoban-container]': await page.locator('div[data-sokoban-container]').count(),
    'div[data-attrid]': await page.locator('div[data-attrid]').count(),
    'a[href]': await page.locator('a[href]').count(),
    'a[href*="tiktok"]': await page.locator('a[href*="tiktok"]').count(),
    'a[href*="tiktok.com"]': await page.locator('a[href*="tiktok.com"]').count(),
    'h3': await page.locator('h3').count(),
    'div.rc': await page.locator('div.rc').count(),
    'div.yuRUbf': await page.locator('div.yuRUbf').count(),
    'div[lang] a': await page.locator('div[lang] a').count(),
  };

  for (const [sel, count] of Object.entries(selectors)) {
    console.log(`  ${sel}: ${count}`);
  }

  console.log('\n=== All links with tiktok ===');
  const allLinks = await page.locator('a').all();
  let tiktokCount = 0;
  for (const link of allLinks) {
    const href = await link.getAttribute('href') || '';
    if (href.toLowerCase().includes('tiktok')) {
      tiktokCount++;
      const text = await link.textContent() || '';
      console.log(`  ${tiktokCount}. "${text.substring(0, 60)}"`);
      console.log(`     href: ${href.substring(0, 120)}`);
    }
  }

  if (tiktokCount === 0) {
    console.log('\n=== No tiktok links found. Sample of all links: ===');
    let shown = 0;
    for (const link of allLinks) {
      const href = await link.getAttribute('href') || '';
      const text = await link.textContent() || '';
      if (text.trim() && href.startsWith('http') && shown < 20) {
        shown++;
        console.log(`  ${shown}. "${text.substring(0, 60)}"`);
        console.log(`     href: ${href.substring(0, 120)}`);
      }
    }
  }

  console.log('\n\nBrowser stays open 30s. Press Ctrl+C to exit.');
  await page.waitForTimeout(30000);
  await browser.close();
}

debug().catch(console.error);