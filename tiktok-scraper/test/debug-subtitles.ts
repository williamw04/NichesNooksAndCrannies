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
  await page.goto(TEST_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(5000);

  // Hover over video to reveal controls
  console.log('Hovering over video...');
  const videoEl = page.locator('[data-e2e="feed-video"]').first();
  await videoEl.hover();
  await page.waitForTimeout(2000);

  // Dump the entire player controls area - look for buttons with SVGs
  console.log('\n--- All buttons on page ---');
  const buttons = await page.locator('button').all();
  for (let i = 0; i < buttons.length; i++) {
    const btn = buttons[i];
    const ariaLabel = await btn.getAttribute('aria-label').catch(() => '') || '';
    const title = await btn.getAttribute('title').catch(() => '') || '';
    const e2e = await btn.getAttribute('data-e2e').catch(() => '') || '';
    const text = await btn.textContent().catch(() => '') || '';
    const outerHtml = await btn.evaluate(el => el.outerHTML.substring(0, 200)).catch(() => '') || '';
    if (ariaLabel || title) {
      console.log(`  [${i}] aria="${ariaLabel}" title="${title}" e2e="${e2e}" text="${text.trim().substring(0, 30)}"`);
    }
  }

  // Also check for elements with role="button" that aren't <button>
  console.log('\n--- role=button elements ---');
  const roleBtns = await page.locator('[role="button"]').all();
  for (let i = 0; i < roleBtns.length; i++) {
    const el = roleBtns[i];
    const ariaLabel = await el.getAttribute('aria-label').catch(() => '') || '';
    const title = await el.getAttribute('title').catch(() => '') || '';
    const e2e = await el.getAttribute('data-e2e').catch(() => '') || '';
    const tag = await el.evaluate(e => e.tagName).catch(() => '') || '';
    if (ariaLabel || title) {
      console.log(`  [${i}] <${tag}> aria="${ariaLabel}" title="${title}" e2e="${e2e}"`);
    }
  }

  // Check for the settings/gear icon in the player
  console.log('\n--- Looking for player settings gear icon ---');
  const settingsSelectors = [
    '[aria-label*="Settings"]',
    '[aria-label*="settings"]',
    '[aria-label*="Options"]',
    '[aria-label*="options"]',
    '[aria-label*="More"]',
    '[aria-label*="CC"]',
    '[aria-label*="cc"]',
    'button[class*="Setting"]',
    'button[class*="setting"]',
    '[class*="SettingIcon"]',
    '[class*="settingIcon"]',
    'svg[class*="setting"]',
    'svg[class*="Setting"]',
  ];
  for (const sel of settingsSelectors) {
    const c = await page.locator(sel).count();
    if (c > 0) {
      const outerHtml = await page.locator(sel).first().evaluate(el => el.outerHTML.substring(0, 400)).catch(() => '');
      console.log(`  ✓ ${sel}: ${c}`);
      console.log(`    ${outerHtml}`);
    }
  }

  // Dump the video player's internal structure
  console.log('\n--- feed-video inner structure (first 2000 chars) ---');
  const playerHtml = await page.locator('[data-e2e="feed-video"]').first().evaluate(el => {
    return el.innerHTML.substring(0, 2000);
  }).catch(() => '');
  console.log(playerHtml);

  // Take a screenshot of current state
  await page.screenshot({ path: 'debug-captions-state.png' });
  console.log('\nScreenshot saved: debug-captions-state.png');

  console.log('\nBrowser open 30s for manual inspection.');
  await page.waitForTimeout(30000);
  await browser.close();
}

debug().catch(console.error);
