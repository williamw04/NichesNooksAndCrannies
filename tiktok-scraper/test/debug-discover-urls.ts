/**
 * Debug script to test TikTok discover/search URL patterns.
 *
 * Goal: determine which URL formats return video containers
 * so we can skip Google SERP and generate discover URLs directly.
 *
 * Patterns tested:
 *   /discover/{kebab-slug}            e.g. /discover/coffee-shops
 *   /discover/{slug}-in-{city}        e.g. /discover/coffee-shops-in-nyc
 *   /search?q={query}                 e.g. /search?q=coffee%20shops%20nyc
 *   /tag/{hashtag}                    e.g. /tag/nyc-coffee-shops
 *
 * For each URL we measure:
 *   - Video links found (a[href*="/video/"])
 *   - DivItemContainer count
 *   - Whether page loaded real content vs login wall / redirect
 */
import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const BASE = 'https://www.tiktok.com';

const QUERIES = [
  { raw: 'coffee shops', kebab: 'coffee-shops', tag: 'coffeeshops' },
  { raw: 'coffee shops nyc', kebab: 'coffee-shops-nyc', tag: 'nyc-coffee-shops' },
  { raw: 'best pizza NYC', kebab: 'best-pizza-nyc', tag: 'bestpizzanyc' },
  { raw: 'hidden gems NYC', kebab: 'hidden-gems-nyc', tag: 'hiddengemsnyc' },
  { raw: 'rooftop bars', kebab: 'rooftop-bars', tag: 'rooftopbars' },
];

const CITY = 'nyc';

function generateUrls(q: typeof QUERIES[number]): { label: string; url: string }[] {
  return [
    { label: `/discover/{kebab}`, url: `${BASE}/discover/${q.kebab}` },
    { label: `/discover/{kebab}-in-{city}`, url: `${BASE}/discover/${q.kebab}-in-${CITY}` },
    { label: `/discover/{city}-{kebab}`, url: `${BASE}/discover/${CITY}-${q.kebab}` },
    { label: `/search?q={raw}+{city}`, url: `${BASE}/search?q=${encodeURIComponent(q.raw + ' ' + CITY)}` },
    { label: `/search?q={raw}`, url: `${BASE}/search?q=${encodeURIComponent(q.raw)}` },
    { label: `/tag/{tag}`, url: `${BASE}/tag/${q.tag}` },
  ];
}

interface UrlTestResult {
  query: string;
  label: string;
  url: string;
  videoLinks: number;
  containers: number;
  totalLinks: number;
  title: string;
  redirectedTo: string;
  bodySnippet: string;
  error?: string;
}

async function main() {
  const outputDir = path.resolve(process.cwd(), 'output');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

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
  const results: UrlTestResult[] = [];

  for (const q of QUERIES) {
    const urls = generateUrls(q);

    for (const { label, url } of urls) {
      console.log(`\n${'='.repeat(70)}`);
      console.log(`Query: "${q.raw}" | Pattern: ${label}`);
      console.log(`URL: ${url}`);
      console.log('='.repeat(70));

      const result: UrlTestResult = {
        query: q.raw,
        label,
        url,
        videoLinks: 0,
        containers: 0,
        totalLinks: 0,
        title: '',
        redirectedTo: '',
        bodySnippet: '',
      };

      try {
        const response = await page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: 30000,
        });
        await page.waitForTimeout(8000);

        const finalUrl = page.url();
        result.redirectedTo = finalUrl !== url ? finalUrl : '';
        result.title = await page.title();

        result.videoLinks = await page.locator('a[href*="/video/"]').count();
        result.containers = await page.locator('[class*="DivItemContainer"]').count();
        result.totalLinks = await page.locator('a').count();

        const bodyText = (await page.locator('body').textContent()) || '';
        result.bodySnippet = bodyText.substring(0, 200).replace(/\n/g, ' ');

        console.log(`  Title: ${result.title}`);
        console.log(`  Redirected: ${result.redirectedTo || 'no'}`);
        console.log(`  Video links: ${result.videoLinks}`);
        console.log(`  Containers: ${result.containers}`);
        console.log(`  Total links: ${result.totalLinks}`);

        if (result.videoLinks > 0 || result.containers > 0) {
          console.log(`  *** SUCCESS — found video content ***`);
        }
      } catch (error) {
        result.error = error instanceof Error ? error.message : 'Unknown error';
        console.log(`  ERROR: ${result.error}`);
      }

      results.push(result);

      await page.waitForTimeout(4000);
    }
  }

  const outPath = path.resolve(outputDir, 'discover-url-patterns.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log(`\n\nResults saved to ${outPath}`);

  console.log('\n\n=== SUMMARY ===\n');
  console.log('Query'.padEnd(25) + 'Pattern'.padEnd(35) + 'Videos'.padEnd(10) + 'Containers'.padEnd(12) + 'Redirect');
  console.log('-'.repeat(95));
  for (const r of results) {
    const redirect = r.redirectedTo ? 'YES → ' + r.redirectedTo.substring(0, 40) : 'no';
    console.log(
      r.query.padEnd(25) +
      r.label.padEnd(35) +
      String(r.videoLinks).padEnd(10) +
      String(r.containers).padEnd(12) +
      redirect
    );
  }

  console.log('\n\nBrowser stays open 20s for inspection.');
  await page.waitForTimeout(20000);
  await browser.close();
}

main().catch(console.error);
