import { chromium } from 'playwright';
import * as fs from 'fs';

const TEST_URLS = [
  'https://www.tiktok.com/@mr.eats305/video/7527039298059668766',
  'https://www.tiktok.com/@nycfoodiegirll/video/7557061631943937311',
  'https://www.tiktok.com/@two_scoops_of_home/video/7491081454500465966',
];

async function debugVideoPage(page: any, url: string) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`TESTING: ${url}`);
  console.log('='.repeat(80));

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(5000);

  const screenshotName = url.match(/@([\w.]+)\/video\/(\d+)/);
  const slug = screenshotName ? `${screenshotName[1]}_${screenshotName[2]}` : 'unknown';
  await page.screenshot({ path: `debug-video-${slug}.png`, fullPage: true });
  console.log(`  Screenshot: debug-video-${slug}.png`);

  const html = await page.content();
  fs.writeFileSync(`debug-video-${slug}.html`, html);
  console.log(`  HTML: debug-video-${slug}.html (${html.length} chars)`);

  // 1. Check __NEXT_DATA__ (TikTok is Next.js — may embed all video data here)
  console.log('\n--- __NEXT_DATA__ ---');
  const nextData = await page.evaluate(() => {
    const el = document.getElementById('__NEXT_DATA__');
    return el ? el.textContent : null;
  });
  if (nextData) {
    fs.writeFileSync(`debug-nextdata-${slug}.json`, nextData);
    console.log(`  FOUND! Saved to debug-nextdata-${slug}.json (${nextData.length} chars)`);
    try {
      const parsed = JSON.parse(nextData);
      const videoData = parsed?.props?.pageProps?.itemInfo?.itemStruct;
      if (videoData) {
        console.log('  videoData keys:', Object.keys(videoData));
        console.log('  desc:', videoData.desc);
        console.log('  author:', JSON.stringify(videoData.author, null, 2)?.substring(0, 300));
        console.log('  stats:', JSON.stringify(videoData.stats, null, 2));
        console.log('  locationCreated:', videoData.locationCreated);
        console.log('  challenges:', JSON.stringify(videoData.challenges?.map((c: any) => c.title), null, 2));
      } else {
        console.log('  No itemInfo.itemStruct found. Top-level keys:', Object.keys(parsed?.props?.pageProps || {}));
        const pp = parsed?.props?.pageProps;
        if (pp) {
          console.log('  pageProps keys:', Object.keys(pp));
          for (const key of Object.keys(pp)) {
            const val = pp[key];
            if (val && typeof val === 'object') {
              console.log(`    ${key} keys:`, Object.keys(val).slice(0, 20));
            } else {
              console.log(`    ${key}: ${String(val).substring(0, 100)}`);
            }
          }
        }
      }
    } catch (e) {
      console.log('  JSON parse error:', (e as Error).message);
    }
  } else {
    console.log('  NOT FOUND');
  }

  // 2. Check SIGI_STATE or other embedded data
  console.log('\n--- Other embedded JSON ---');
  const embeddedData = await page.evaluate(() => {
    const results: Record<string, string> = {};
    const sigi = (window as any).__SIGI_STATE__;
    if (sigi) results['__SIGI_STATE__'] = JSON.stringify(sigi).substring(0, 500);
    const render = (window as any).__RENDER_DATA__;
    if (render) results['__RENDER_DATA__'] = JSON.stringify(render).substring(0, 500);
    const initial = (window as any).__INITIAL_SSR_DATA__;
    if (initial) results['__INITIAL_SSR_DATA__'] = JSON.stringify(initial).substring(0, 500);
    return results;
  });
  for (const [key, val] of Object.entries(embeddedData)) {
    console.log(`  ${key}: ${val.substring(0, 200)}`);
  }

  // 3. Check meta tags (OG tags often have description, etc.)
  console.log('\n--- Meta / OG tags ---');
  const metaTags = await page.evaluate(() => {
    const metas = document.querySelectorAll('meta');
    return Array.from(metas)
      .map(m => ({
        name: m.getAttribute('name') || m.getAttribute('property') || m.getAttribute('itemprop') || '',
        content: m.getAttribute('content') || '',
      }))
      .filter(m => m.content && m.name);
  });
  for (const m of metaTags) {
    console.log(`  ${m.name}: ${m.content.substring(0, 150)}`);
  }

  // 4. Check JSON-LD
  console.log('\n--- JSON-LD ---');
  const jsonLd = await page.evaluate(() => {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    return Array.from(scripts).map(s => s.textContent?.substring(0, 500) || '');
  });
  for (const ld of jsonLd) {
    if (ld) console.log(ld.substring(0, 300));
  }

  // 5. Systematically test selectors
  console.log('\n--- Selector probe ---');
  const selectors = [
    // data-e2e selectors
    '[data-e2e="browse-video-desc"]',
    '[data-e2e="video-desc"]',
    '[data-e2e="browse-author-name"]',
    '[data-e2e="browse-username"]',
    '[data-e2e="browse-views"]',
    '[data-e2e="browse-like-count"]',
    '[data-e2e="browse-comment-count"]',
    '[data-e2e="browse-share-count"]',
    '[data-e2e="browse-followers"]',
    '[data-e2e="browse-verified"]',
    '[data-e2e="browse-music-info"]',
    '[data-e2e="video-location"]',
    '[data-e2e="browse-avatar"]',
    '[data-e2e="common-share"]',
    '[data-e2e="video-desc-container"]',
    '[data-e2e="video-description"]',
    '[data-e2e="search-video-desc"]',
    '[data-e2e="search-card-desc"]',
    '[data-e2e="comment-desc"]',
    '[data-e2e="detail-video-desc"]',
    '[data-e2e="detail-desc"]',
    '[data-e2e="detail-author"]',
    '[data-e2e="detail-views"]',
    '[data-e2e="detail-like"]',
    '[data-e2e="detail-comment"]',
    '[data-e2e="detail-share"]',
    '[data-e2e="detail-music"]',
    '[data-e2e="detail-location"]',
    // generic
    'h1', 'h2', 'h3',
    'video',
    'img[src*="tiktokcdn"]',
    'a[href*="/@"]',
    // class-based
    '[class*="Desc"]',
    '[class*="desc"]',
    '[class*="Caption"]',
    '[class*="caption"]',
    '[class*="Hashtag"]',
    '[class*="hashtag"]',
    '[class*="Author"]',
    '[class*="author"]',
    '[class*="Location"]',
    '[class*="location"]',
    '[class*="Music"]',
    '[class*="music"]',
    '[class*="VideoWrapper"]',
    '[class*="ActionItem"]',
    '[class*="Container"]',
    '[class*="Player"]',
    '[class*="exoplayer"]',
    '[class*="tiktok-"]',
    // role-based
    '[role="button"]',
    '[role="link"]',
    // TikTok-specific data attributes
    '[data-testid]',
    'div[data-e2e]',
    'span[data-e2e]',
    'p[data-e2e]',
    'a[data-e2e]',
  ];

  for (const sel of selectors) {
    try {
      const count = await page.locator(sel).count();
      if (count > 0) {
        const first = await page.locator(sel).first();
        const text = (await first.textContent() || '').trim();
        const tag = await first.evaluate(el => el.tagName).catch(() => '');
        const dataE2e = await first.getAttribute('data-e2e').catch(() => '');
        const cls = await first.getAttribute('class').catch(() => '');
        console.log(`  ✓ ${sel} [${count}] <${tag}> e2e="${dataE2e}" class="${cls?.substring(0, 60)}" text="${text.substring(0, 80)}"`);
      }
    } catch (_) {}
  }

  // 6. Find ALL data-e2e attributes on the page
  console.log('\n--- All data-e2e attributes ---');
  const allE2e = await page.evaluate(() => {
    const els = document.querySelectorAll('[data-e2e]');
    return Array.from(els).map(el => ({
      e2e: el.getAttribute('data-e2e'),
      tag: el.tagName,
      text: el.textContent?.trim().substring(0, 80) || '',
      class: el.className?.toString().substring(0, 60) || '',
    }));
  });
  for (const item of allE2e) {
    console.log(`  ${item.e2e} <${item.tag}> class="${item.class}" text="${item.text}"`);
  }

  // 7. Search for hashtag patterns in the page text
  console.log('\n--- Hashtags in page text ---');
  const hashtags = await page.evaluate(() => {
    const body = document.body.innerText || '';
    return body.match(/#[\w]+/g) || [];
  });
  console.log(`  Found ${hashtags.length}: ${hashtags.slice(0, 20).join(', ')}`);

  // 8. Body text sample
  console.log('\n--- Body text (first 800 chars) ---');
  const bodyText = await page.evaluate(() => document.body.innerText?.substring(0, 800) || '');
  console.log(bodyText);
}

async function main() {
  const browser = await chromium.launch({
    headless: false,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-setuid-sandbox',
    ],
  });

  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
    locale: 'en-US',
    timezoneId: 'America/New_York',
  });

  await context.addInitScript(`
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
    });
  `);

  const page = await context.newPage();

  for (const url of TEST_URLS) {
    await debugVideoPage(page, url);
    await new Promise(r => setTimeout(r, 3000));
  }

  console.log('\n\nDone. Browser stays open 60s for manual inspection.');
  await page.waitForTimeout(60000);
  await browser.close();
}

main().catch(console.error);
