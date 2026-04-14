import { chromium } from 'playwright';

const TEST_URL = 'https://www.tiktok.com/@mr.eats305/video/7527039298059668766';

async function debug() {
  const browser = await chromium.launch({
    headless: false,
    args: ['--disable-blink-features=AutomationControlled'],
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
    locale: 'en-US',
    timezoneId: 'America/New_York',
  });

  await context.addInitScript(`
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  `);

 const page = await context.newPage();

  console.log(`Navigating to: ${TEST_URL}`);
  await page.goto(TEST_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(5000);

  const captionContainer = page.locator('[class*="DivCaptionContainer"]').first();
  const exists = await captionContainer.count() > 0;
  console.log(`Caption container exists: ${exists}`);

  if (exists) {
    const initialText = await captionContainer.textContent().catch(() => '');
    console.log(`Initial caption text: "${initialText}"`);

    const captionLines: string[] = [];
    const seen = new Set<string>();
    let lineCount = 0;

    for (let i = 0; i < 60; i++) {
      await page.waitForTimeout(500);
      const text = await captionContainer.textContent().catch(() => '') || '';
      const clean = text.trim();
      if (clean && !seen.has(clean)) {
        seen.add(clean);
        captionLines.push(clean);
        lineCount++;
        console.log(`  [${lineCount}] "${clean}"`);
      }
      if (lineCount >= 5) {
        console.log('  Got 5 unique lines, stopping early.');
        break;
      }
    }

    console.log(`\nCollected ${captionLines.length} caption lines:`);
    captionLines.forEach(line => console.log(`  "${line}"`));
  } else {
    console.log('No caption container found');

    const allE2e = await page.locator('[data-e2e]').all();
    const e2eList: string[] = [];
    for (const el of allE2e) {
      const e2e = await el.getAttribute('data-e2e').catch(() => '');
      if (e2e && (e2e.includes('caption') || e2e.includes('subtitle') || e2e.includes('Caption'))) {
        e2eList.push(e2e);
      }
    }
    console.log('Caption-related data-e2e:', e2eList);
  }

  console.log('\nBrowser open 15s for manual inspection.');
  await page.waitForTimeout(15000);
  await browser.close();
}

debug().catch(console.error);
