import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const URL = 'https://www.tiktok.com/discover/coffee-shops-in-nyc';

async function main() {
  const browser = await chromium.launch({
    headless: false,
    args: ['--disable-blink-features=AutomationControlled'],
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

  console.log('Navigating to:', URL);
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(5000);

  const outputDir = path.resolve(import.meta.dirname, '../output');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  // Save debug artifacts
  await page.screenshot({ path: path.resolve(outputDir, 'discover-screenshot.png'), fullPage: true });
  const html = await page.content();
  fs.writeFileSync(path.resolve(outputDir, 'discover-page.html'), html);

  // ===== PART 1: CSS Selector-based extraction =====
  console.log('\n=== PART 1: CSS Selector Analysis ===\n');

  const containerSelectors = [
    'div.css-1vcpynh-7937d88b--DivItemContainer',
    '[class*="DivItemContainer"]',
    '[data-e2e="search_video-item"]',
    '[data-e2e="search_video_item"]',
  ];

  let workingContainerSelector = '';
  for (const sel of containerSelectors) {
    const count = await page.locator(sel).count();
    console.log(`Container selector "${sel}": ${count} matches`);
    if (count > 0 && !workingContainerSelector) {
      workingContainerSelector = sel;
    }
  }

  const videoItems: any[] = [];

  if (workingContainerSelector) {
    const containers = await page.locator(workingContainerSelector).all();
    console.log(`\nProbing ${containers.length} containers...`);

    for (let i = 0; i < Math.min(containers.length, 10); i++) {
      const container = containers[i];
      const item: any = { index: i, selectors: {} };

      const videoLink = container.locator('a[href*="/video/"]');
      const linkCount = await videoLink.count();
      if (linkCount > 0) {
        item.videoHref = await videoLink.first().getAttribute('href');
        item.selectors['a[href*="/video/"]'] = { count: linkCount, href: item.videoHref };
      }

      const viewCountSelectors = [
        '[class*="SpanLikes"]',
        '[class*="StrongLikes"]',
        '[class*="SpanLikeWrapper"]',
        'span[class*="SpanLikes"]',
        'strong[class*="StrongLikes"]',
        '[data-e2e="video-like-icon"]',
      ];

      for (const vSel of viewCountSelectors) {
        try {
          const vCount = await container.locator(vSel).count();
          if (vCount > 0) {
            const text = (await container.locator(vSel).first().textContent())?.trim() || '';
            const fullClass = await container.locator(vSel).first().getAttribute('class') || '';
            item.selectors[vSel] = { count: vCount, text, fullClass };
            if (!item.viewCountText) {
              item.viewCountText = text;
              item.viewCountClass = fullClass;
            }
          }
        } catch (_) {}
      }

      // Check for ALL text content and child elements to find other stats
      const containerInfo = await container.evaluate((el: HTMLElement) => {
        const allText = el.innerText?.trim() || '';
        const allSpans = Array.from(el.querySelectorAll('span')).map(s => ({
          text: s.textContent?.trim() || '',
          class: s.className?.toString() || '',
        })).filter(s => s.text);
        const allStrongs = Array.from(el.querySelectorAll('strong')).map(s => ({
          text: s.textContent?.trim() || '',
          class: s.className?.toString() || '',
        })).filter(s => s.text);
        const allLinks = Array.from(el.querySelectorAll('a')).map(a => ({
          href: a.getAttribute('href') || '',
          text: a.textContent?.trim().substring(0, 100) || '',
          class: a.className?.toString().substring(0, 80) || '',
        })).filter(a => a.href);
        const allImgs = Array.from(el.querySelectorAll('img')).map(img => ({
          src: img.getAttribute('src')?.substring(0, 120) || '',
          alt: img.getAttribute('alt') || '',
        }));

        return { allText, allSpans, allStrongs, allLinks, allImgs };
      });

      item.allText = containerInfo.allText;
      item.allSpans = containerInfo.allSpans;
      item.allStrongs = containerInfo.allStrongs;
      item.allLinks = containerInfo.allLinks;
      item.allImgs = containerInfo.allImgs;

      // Also check the full class of the container itself
      item.containerClass = await container.getAttribute('class') || '';

      videoItems.push(item);
    }
  }

  // ===== PART 2: Check ALL data-e2e attributes =====
  console.log('\n=== PART 2: All data-e2e attributes ===\n');

  const allE2e = await page.evaluate(() => {
    const els = document.querySelectorAll('[data-e2e]');
    return Array.from(els).map(el => ({
      e2e: el.getAttribute('data-e2e'),
      tag: el.tagName,
      text: el.textContent?.trim().substring(0, 80) || '',
      class: (el.className?.toString() || '').substring(0, 100),
    }));
  });
  for (const item of allE2e) {
    console.log(`  data-e2e="${item.e2e}" <${item.tag}> class="${item.class}" text="${item.text}"`);
  }

  // ===== PART 3: Extract from __UNIVERSAL_DATA_FOR_REHYDRATION__ =====
  console.log('\n=== PART 3: Embedded JSON Data ===\n');

  const embeddedData = await page.evaluate(() => {
    const el = document.getElementById('__UNIVERSAL_DATA_FOR_REHYDRATION__');
    return el ? el.textContent : null;
  });

  let embeddedItems: any[] = [];
  if (embeddedData) {
    try {
      const parsed = JSON.parse(embeddedData);
      const scope = parsed?.['__DEFAULT_SCOPE__'];

      const exploreKeys = Object.keys(scope || {}).filter(k =>
        k.includes('explore') || k.includes('search') || k.includes('discover')
      );
      console.log('Explore-related scope keys:', exploreKeys);

      for (const [key, value] of Object.entries(scope || {})) {
        if (typeof value === 'object' && value !== null) {
          const str = JSON.stringify(value);
          if (str.includes('/video/') || str.includes('itemList') || str.includes('playCount')) {
            console.log(`\nScope key "${key}" contains video data (${str.length} chars)`);
            const v: any = value;
            if (v.itemList) {
              console.log(`  itemList: ${v.itemList.length} items`);
              embeddedItems = v.itemList.map((item: any) => ({
                id: item.id,
                desc: item.desc?.substring(0, 100),
                author: item.author?.uniqueId,
                stats: item.stats,
                videoUrl: `https://www.tiktok.com/@${item.author?.uniqueId}/video/${item.id}`,
              }));
            } else if (Array.isArray(v)) {
              const first: any = v[0];
              if (first?.itemList) {
                console.log(`  first.itemList: ${first.itemList.length} items`);
                embeddedItems = first.itemList.map((item: any) => ({
                  id: item.id,
                  desc: item.desc?.substring(0, 100),
                  author: item.author?.uniqueId,
                  stats: item.stats,
                  videoUrl: `https://www.tiktok.com/@${item.author?.uniqueId}/video/${item.id}`,
                }));
              }
            }
          }
        }
      }

      if (embeddedItems.length === 0) {
        console.log('\nNo itemList found directly. Dumping all scope keys with sizes:');
        for (const [key, value] of Object.entries(scope || {})) {
          const size = JSON.stringify(value).length;
          if (size > 100) console.log(`  ${key}: ${size} chars`);
        }
      }
    } catch (e) {
      console.log('JSON parse error:', (e as Error).message);
    }
  }

  // ===== PART 4: Dump one full container's outer HTML =====
  console.log('\n=== PART 4: Full container HTML sample ===\n');

  if (workingContainerSelector) {
    const firstContainerHtml = await page.locator(workingContainerSelector).first().evaluate(el => el.outerHTML);
    const samplePath = path.resolve(outputDir, 'discover-container-sample.html');
    fs.writeFileSync(samplePath, firstContainerHtml);
    console.log(`Saved first container HTML to ${samplePath} (${firstContainerHtml.length} chars)`);
  }

  // ===== Save results =====
  const results = {
    timestamp: new Date().toISOString(),
    url: URL,
    containerSelector: workingContainerSelector,
    videoItems,
    embeddedData: embeddedItems,
    allE2eAttributes: allE2e,
  };

  const outPath = path.resolve(outputDir, 'discover-structure.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log(`\nResults saved to ${outPath}`);

  console.log('\n\nBrowser stays open 30s for inspection. Press Ctrl+C to exit.');
  await page.waitForTimeout(30000);
  await browser.close();
}

main().catch(console.error);
