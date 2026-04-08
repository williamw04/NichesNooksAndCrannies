import { GoogleTikTokScraper } from './google-scraper.js';
import { TikTokScraperInput, DEFAULT_INPUT } from './types.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

function mem(): string {
  const m = process.memoryUsage();
  return `RSS=${(m.rss / 1024 / 1024).toFixed(0)}MB heap=${(m.heapUsed / 1024 / 1024).toFixed(0)}/${(m.heapTotal / 1024 / 1024).toFixed(0)}MB`;
}

interface TestResult { name: string; pass: boolean; detail: string; }
const results: TestResult[] = [];

function assert(name: string, condition: boolean, detail: string) {
  results.push({ name, pass: condition, detail });
  console.log(`  [${condition ? 'PASS' : 'FAIL'}] ${name}: ${detail}`);
}

async function main() {
  const input: TikTokScraperInput = {
    ...DEFAULT_INPUT,
    searchQueries: ['best coffee shops nyc', 'hidden gems nyc'],
    resultsPerPage: 5,
    maxItems: 10,
    debug: true,
  };

  console.log('=== TikTok Scraper Test Suite ===');
  console.log(`Queries: ${input.searchQueries.join(', ')}`);
  console.log(`Memory: ${mem()}\n`);

  const scraper = new GoogleTikTokScraper(input);
  await scraper.init();
  const context = scraper['context']!;
  const page = await context.newPage();

  // ── TEST 1: Google SERP ──
  console.log('\n── Test 1: Google SERP Discovery ──');
  const t1 = performance.now();
  const serp = await scraper.searchGoogle(input.searchQueries[0], page);
  const serpMs = performance.now() - t1;
  console.log(`  SERP took ${(serpMs / 1000).toFixed(1)}s`);

  assert('SERP returns results', serp.serpResults.length > 0, `${serp.serpResults.length} results`);
  assert('SERP has video URLs', serp.videoUrls.length > 0, `${serp.videoUrls.length} videos`);
  assert('SERP has discover URLs', serp.searchUrls.length > 0, `${serp.searchUrls.length} discover pages`);

  const serpVideosWithViews = serp.serpResults.filter(r => r.type === 'video' && r.viewCount > 2020);
  assert('SERP view counts (cite element)', serpVideosWithViews.length > 0, `${serpVideosWithViews.length}/${serp.videoUrls.length} have real view counts`);

  console.log(`  SERP results:`);
  for (const r of serp.serpResults.slice(0, 8)) {
    console.log(`    [${r.type}] @${r.creator || '?'} views=${r.viewCount} | ${r.title.substring(0, 50)}`);
  }

  // ── DEBUG: Inspect DOM of empty SERP results ──
  const emptyResults = serp.serpResults.filter(r => r.type === 'video' && r.viewCount === 0 && !r.title);
  if (emptyResults.length > 0) {
    console.log(`\n  ── DEBUG: Inspecting ${emptyResults.length} empty video links ──`);
    const allLinks = await page.locator('a[href*="tiktok.com"]').all();
    for (let i = 0; i < allLinks.length && i < 5; i++) {
      try {
        const linkEl = allLinks[i];
        const href = (await linkEl.getAttribute('href')) || '';
        const type = href.includes('/video/') || href.includes('/t/') ? 'video' : href.includes('/discover/') || href.includes('/tag/') ? 'search' : 'other';
        if (type !== 'video') continue;

        const text = (await linkEl.textContent()) || '';
        const outerHtml = await linkEl.evaluate((el: HTMLAnchorElement) => el.outerHTML.substring(0, 500));
        const parentHtml = await linkEl.evaluate((el: HTMLAnchorElement) => {
          const p = el.parentElement;
          return p ? p.outerHTML.substring(0, 800) : 'NO PARENT';
        });
        const children = await linkEl.evaluate((el: HTMLAnchorElement) => {
          return Array.from(el.children).map(c => `<${c.tagName.toLowerCase()} ${c.className ? `class="${c.className}"` : ''} ${c.textContent ? `text="${c.textContent.substring(0, 80)}"` : ''} ${c instanceof HTMLImageElement ? `alt="${c.alt?.substring(0, 100) || ''}" src="${c.src?.substring(0, 100) || ''}"` : ''}/>`).join('\n    ');
        });

        console.log(`  Link #${i}:`);
        console.log(`    href: ${href.substring(0, 100)}`);
        console.log(`    textContent: "${text.substring(0, 100)}"`);
        console.log(`    children:\n    ${children}`);
        console.log(`    outerHTML: ${outerHtml.substring(0, 400)}`);
        console.log(`    parentHTML: ${parentHtml.substring(0, 600)}`);

        const citeText = await linkEl.evaluate((el: HTMLAnchorElement) => {
          const parent = el.closest('div[class*="g "]') || el.closest('div.g') || el.parentElement?.parentElement?.parentElement;
          const cites = parent ? Array.from(parent.querySelectorAll('cite')).map(c => c.textContent) : [];
          return cites;
        });
        console.log(`    nearby <cite> texts: ${JSON.stringify(citeText)}`);
        console.log('');
      } catch {}
    }
  }

  // ── PAUSE: Let user visually inspect the Google SERP in the browser ──
  console.log('\n  >>> Browser paused on Google SERP. Inspect visually, then press Enter to continue... <<<');
  await new Promise<void>(resolve => {
    process.stdin.once('data', () => resolve());
  });

  // ── TEST 2: Discover Page ──
  console.log('\n── Test 2: Discover Page Scraping ──');
  if (serp.searchUrls.length > 0) {
    const discoverUrl = serp.searchUrls[0];
    const t2 = performance.now();
    const discoverResults = await scraper.scrapeSearchPage(discoverUrl, page);
    const discoverMs = performance.now() - t2;
    console.log(`  Discover took ${(discoverMs / 1000).toFixed(1)}s`);

    assert('Discover returns results', discoverResults.length > 0, `${discoverResults.length} videos`);
    const discoverWithViews = discoverResults.filter(r => r.viewCount > 0);
    assert('Discover view counts', discoverWithViews.length > 0, `${discoverWithViews.length}/${discoverResults.length} have views`);
    const discoverWithCreator = discoverResults.filter(r => r.creator.length > 0);
    assert('Discover creator names', discoverWithCreator.length > 0, `${discoverWithCreator.length}/${discoverResults.length} have creators`);

    console.log(`  Discover samples:`);
    for (const r of discoverResults.slice(0, 5)) {
      console.log(`    @${r.creator || '?'} views=${r.viewCount} | ${r.url.substring(0, 60)}`);
    }

    // ── TEST 3: Video Scraping (from both sources) ──
    console.log('\n── Test 3: Video Scraping ──');
    const googleVideos = serp.videoUrls.slice(0, 2).map(u => ({ url: u, source: 'google' }));
    const discoverVideos = discoverResults.slice(0, 2).map(r => ({ url: r.url, source: 'discover' }));
    const testUrls = [...googleVideos, ...discoverVideos].filter((v, i, a) => a.findIndex(x => x.url === v.url) === i);

    const videoStats: any[] = [];

    for (const { url, source } of testUrls) {
      const allResults = [...serp.serpResults, ...(discoverResults || [])];
      const serpData = allResults.find(r => r.url === url);
      const t3 = performance.now();
      const video = await scraper.scrapeTikTokVideo(url, page, serpData);
      const elapsed = performance.now() - t3;

      if (!video) {
        assert(`Scrape (${source})`, false, `${url.substring(0, 50)} returned null`);
        continue;
      }

      const hasEngagement = video.diggCount > 0 || video.commentCount > 0;
      const hasVtt = !!video.subtitles && video.subtitles.length > 0;
      const hasLocation = !!video.locationTag && video.locationTag.length > 0;

      videoStats.push({ source, url: video.url, author: video.author.uniqueId, likes: video.diggCount, comments: video.commentCount, shares: video.shareCount, plays: video.playCount, location: video.locationTag || null, vtt: hasVtt ? video.subtitles!.length : null, ms: elapsed });

      console.log(`  [${source}] @${video.author.uniqueId} | ❤${video.diggCount} 💬${video.commentCount} 👁${video.playCount}${hasLocation ? ` 📍${video.locationTag}` : ''}${hasVtt ? ' 📝VTT' : ''} [${(elapsed / 1000).toFixed(1)}s]`);

      assert(`Engagement (${source})`, hasEngagement, `likes=${video.diggCount} comments=${video.commentCount}`);
      assert(`Timing <15s (${source})`, elapsed < 15000, `${(elapsed / 1000).toFixed(1)}s`);
    }
  } else {
    assert('Discover page test', false, 'No search URLs found');
  }

  // ── Summary ──
  console.log('\n\n========== SUMMARY ==========');
  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;
  for (const r of results) console.log(`  [${r.pass ? 'PASS' : 'FAIL'}] ${r.name}: ${r.detail}`);
  console.log(`\n${passed}/${results.length} passed, ${failed} failed`);
  console.log(`Memory: ${mem()}`);

  const outputDir = path.join(process.cwd(), 'output');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, `test-results-${Date.now()}.json`), JSON.stringify({ passed, failed, total: results.length, results, memory: mem() }, null, 2));

  await page.close();
  await scraper.close();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { console.error('Crash:', e); process.exit(1); });
