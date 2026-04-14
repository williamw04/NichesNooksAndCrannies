import { Page } from 'playwright';
import { randomDelay, parseNumber } from '../scraping/browser.js';
import { SerpResult } from '../scraping/search-page.js';

export interface GoogleSearchResult {
  videoUrls: string[];
  searchUrls: string[];
  serpResults: SerpResult[];
}

function classifyTikTokUrl(url: string): 'video' | 'search' | 'unknown' {
  if (/tiktok\.com\/@[\w.]+\/video\/\d+/.test(url)) return 'video';
  if (/tiktok\.com\/t\/[\w]+/.test(url)) return 'video';
  if (/tiktok\.com\/discover\//.test(url)) return 'search';
  if (/tiktok\.com\/tag\//.test(url)) return 'search';
  if (/tiktok\.com\/category\//.test(url)) return 'search';
  if (/tiktok\.com\/f\//.test(url)) return 'search';
  return 'unknown';
}

function parseSerpLinkText(text: string): {
  title: string;
  creator: string;
  viewCount: number;
} {
  let title = '';
  let creator = '';
  let viewCount = 0;

  const datePattern = /^\d+\s+(?:second|minute|hour|day|week|month|year)s?\s+ago$|^(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}$/i;

  const stripDuration = (s: string) => s.replace(/^\d{1,2}:\d{2}\s*/, '');

  const tiktokSplit = text.split('TikTok');
  if (tiktokSplit.length >= 1) {
    title = stripDuration(tiktokSplit[0].trim());
  }
  if (tiktokSplit.length >= 2) {
    const afterTiktok = tiktokSplit[1];
    const dotSplit = afterTiktok.split('·');
    for (let i = dotSplit.length - 1; i >= 0; i--) {
      const segment = dotSplit[i].trim();
      if (!segment) continue;
      if (datePattern.test(segment)) continue;
      const viewMatch = segment.match(/([\d.]+[KkMmBb]?\+?)(?:\s*views)?$/i);
      if (viewMatch && viewCount === 0) {
        const num = parseNumber(viewMatch[1]);
        // Reject 2000–2100 range: Google sometimes puts "2025" (year) where view count goes
        if (num < 2000 || num > 2100) {
          viewCount = num;
        }
        continue;
      }
      creator = segment;
      break;
    }
  }

  if (viewCount === 0) {
    const globalViewMatch = text.match(/([\d.]+[KkMmBb]?\+?)\s*views/i);
    if (globalViewMatch) {
      const num = parseNumber(globalViewMatch[1]);
      // Reject 2000–2100 range: Google sometimes puts "2025" (year) where view count goes
      if (num < 2000 || num > 2100) {
        viewCount = num;
      }
    }
  }

  if (!title && text.length > 0) {
    title = stripDuration(text.substring(0, Math.min(60, text.length)).trim());
  }
  return { title, creator, viewCount };
}

export async function searchGoogle(
  query: string,
  page: Page,
  debug?: boolean,
  onError?: (msg: string) => void,
): Promise<GoogleSearchResult> {
  const videoUrls: string[] = [];
  const searchUrls: string[] = [];
  const serpResults: SerpResult[] = [];

  const googleQuery = `${query} tiktok`;
  const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(googleQuery)}`;

  console.log(`\nSearching Google for: "${googleQuery}"`);

  try {
    await page.goto(googleUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await randomDelay(2000, 3000);

    let allLinks = await page.locator('a[href*="tiktok.com"]').all();
    if (allLinks.length === 0) {
      // No TikTok links found — likely a Google captcha. Pause for manual solve.
      console.log(`No TikTok links found — waiting 15s for user interaction (captcha?)...`);
      await new Promise(r => setTimeout(r, 15000));
      allLinks = await page.locator('a[href*="tiktok.com"]').all();
    }
    console.log(`Found ${allLinks.length} TikTok links on Google`);

    const seenUrls = new Set<string>();

    for (const linkEl of allLinks) {
      try {
        const href = (await linkEl.getAttribute('href')) || '';
        if (!href) continue;

        const cleanUrl = href.split('#:~:text=')[0].split('?lang=')[0];
        const type = classifyTikTokUrl(cleanUrl);

        if (type === 'unknown') continue;
        if (seenUrls.has(cleanUrl)) continue;
        seenUrls.add(cleanUrl);

        const linkText = (await linkEl.textContent()) || '';
        const parsed = parseSerpLinkText(linkText);

        let citeViewCount = 0;
        try {
          const resultBlock = linkEl.locator('xpath=ancestor::div[@class="g" or contains(@class, "g ")]');
          const citeEl = resultBlock.locator('cite').first();
          const citeText = (await citeEl.textContent({ timeout: 2000 })) || '';
          const citeMatch = citeText.match(/([\d.]+[KkMmBb]?\+?)\s*views/i);
          if (citeMatch) citeViewCount = parseNumber(citeMatch[1]);
        } catch {}
        if (citeViewCount === 0) {
          try {
            const resultBlock = linkEl.locator('xpath=ancestor::div[3]');
            const citeEl = resultBlock.locator('cite').first();
            const citeText = (await citeEl.textContent({ timeout: 2000 })) || '';
            const citeMatch = citeText.match(/([\d.]+[KkMmBb]?\+?)\s*views/i);
            if (citeMatch) citeViewCount = parseNumber(citeMatch[1]);
          } catch {}
        }

        const result: SerpResult = {
          url: cleanUrl,
          title: parsed.title,
          creator: parsed.creator,
          viewCount: citeViewCount || parsed.viewCount,
          type,
        };
        serpResults.push(result);

        const hasMeta = result.viewCount > 0 || parsed.title.length > 0;
        let label: string;
        if (type === 'search') {
          label = 'FOUND SEARCH/DISCOVER PAGE';
        } else if (hasMeta) {
          label = `FOUND VIDEO [${parsed.creator || '?'}, ${result.viewCount} views]`;
        } else {
          label = 'FOUND CAROUSEL VIDEO (no metadata)';
        }
        console.log(`  - ${label}: ${parsed.title.substring(0, 60) || cleanUrl.substring(0, 80)}`);

        if (debug) {
          const outerHtml = await linkEl.evaluate((el: HTMLAnchorElement) => el.outerHTML.substring(0, 500));
          console.log(`    <a> ${outerHtml}`);
        }

        if (type === 'video') {
          videoUrls.push(cleanUrl);
        } else {
          searchUrls.push(cleanUrl);
        }
      } catch (_) {
        continue;
      }
    }

    console.log(`\nUnique video URLs: ${videoUrls.length}`);
    console.log(`Unique search URLs: ${searchUrls.length}`);
  } catch (error) {
    const errorMsg = `Google search failed for "${query}": ${error instanceof Error ? error.message : 'Unknown error'}`;
    console.error(errorMsg);
    onError?.(errorMsg);
  }

  return { videoUrls, searchUrls, serpResults };
}
