import { Page } from 'playwright';
import { randomDelay, parseNumber } from './browser.js';

export interface SerpResult {
  url: string;
  title: string;
  creator: string;
  viewCount: number;
  type: 'video' | 'search' | 'unknown';
}

export async function scrapeSearchPage(
  searchUrl: string,
  page: Page,
  onError?: (msg: string) => void,
): Promise<SerpResult[]> {
  console.log(`\n  Scraping search page: ${searchUrl}`);
  try {
    await page.goto(searchUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await randomDelay(3000, 5000);

    // Detect homepage redirect — discover URLs with unknown slugs redirect to tiktok.com
    const currentUrl = page.url();
    if (currentUrl === 'https://www.tiktok.com/' || currentUrl === 'https://www.tiktok.com') {
      console.log(`  Page redirected to homepage — slug not found`);
      return [];
    }

    const containers = await page.locator('[class*="DivItemContainer"]').all();
    console.log(`  Found ${containers.length} video containers`);

    const results: SerpResult[] = [];
    const seen = new Set<string>();

    for (const container of containers) {
      try {
        const linkEl = container.locator('a[href*="/video/"]').first();
        const href = (await linkEl.getAttribute('href', { timeout: 3000 })) || '';
        const cleanUrl = href.split('?')[0].split('#')[0];
        if (!cleanUrl.includes('/video/') || seen.has(cleanUrl)) continue;
        seen.add(cleanUrl);

        const fullUrl = cleanUrl.startsWith('http')
          ? cleanUrl
          : `https://www.tiktok.com${cleanUrl}`;

        let viewCount = 0;
        let likeCount = 0;
        try {
          // SpanLikes is misnamed — TikTok reuses this class for view/play count on discover pages
          const viewsText = (await container.locator('span[class*="SpanLikes"]').first().textContent({ timeout: 2000 })) || '';
          viewCount = parseNumber(viewsText);
        } catch {}
        try {
          const likesText = (await container.locator('strong[class*="StrongLikes"]').first().textContent({ timeout: 2000 })) || '';
          likeCount = parseNumber(likesText);
        } catch {}

        let title = '';
        let creator = '';
        try {
          const imgAlt = (await container.locator('img[alt*="Likes"]').first().getAttribute('alt', { timeout: 2000 })) || '';
          const altMatch = imgAlt.match(/(\d[\d,.]*[KkMmBb]?)\s*Likes?,\s*(\d[\d,.]*[KkMmBb]?)\s*Comments?.*?from\s+(.+?)\s*\(@/);
          if (altMatch) {
            likeCount = likeCount || parseNumber(altMatch[1]);
            title = imgAlt;
            creator = altMatch[3].trim();
          }
        } catch {}
        try {
          if (!creator) {
            creator = (await container.locator('p[data-e2e="video-user-name"]').first().textContent({ timeout: 2000 })) || '';
          }
        } catch {}

        results.push({
          url: fullUrl,
          title,
          creator,
          viewCount: viewCount || likeCount,
          type: 'video',
        });
      } catch {}
    }

    console.log(`  Unique video URLs: ${results.length}`);
    return results;
  } catch (error) {
    const errorMsg = `Failed to scrape search page ${searchUrl}: ${error instanceof Error ? error.message : 'Unknown error'}`;
    console.error(`  ✗ ${errorMsg}`);
    onError?.(errorMsg);
    return [];
  }
}
