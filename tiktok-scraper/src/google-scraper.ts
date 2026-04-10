import { chromium, Browser, BrowserContext, Page } from 'playwright';
import {
  TikTokScraperInput,
  TikTokVideo,
  ScrapingResult,
  ScraperStats,
  TikTokScraperOutput,
} from './types.js';

interface GoogleSerpResult {
  url: string;
  title: string;
  creator: string;
  viewCount: number;
  type: 'video' | 'search' | 'unknown';
}

interface EmbeddedVideoData {
  description?: string;
  author?: {
    id?: string;
    uniqueId?: string;
    nickname?: string;
    avatarUrl?: string;
    signature?: string;
    verified?: boolean;
    followerCount?: number;
    followingCount?: number;
    heartCount?: number;
    videoCount?: number;
  };
  stats?: {
    playCount?: number;
    diggCount?: number;
    commentCount?: number;
    shareCount?: number;
    collectCount?: number;
  };
  hashtags?: string[];
  createTime?: number;
}

export class GoogleTikTokScraper {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private input: TikTokScraperInput;
  private stats: ScraperStats;

  constructor(input: TikTokScraperInput) {
    this.input = input;
    this.stats = {
      totalVideos: 0,
      totalProfiles: 0,
      queriesProcessed: 0,
      errors: [],
      startTime: new Date().toISOString(),
    };
  }

  async init(): Promise<void> {
    this.browser = await chromium.launch({
      headless: false,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
        '--disable-setuid-sandbox',
      ],
    });

    this.context = await this.browser.newContext({
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      locale: 'en-US',
      timezoneId: 'America/New_York',
    });

    await this.context.addInitScript(`
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
    `);
  }

  async close(): Promise<void> {
    if (this.context) await this.context.close();
    if (this.browser) await this.browser.close();
    this.stats.endTime = new Date().toISOString();
    this.stats.durationMs =
      new Date(this.stats.endTime).getTime() -
      new Date(this.stats.startTime).getTime();
  }

  private async randomDelay(min: number = 1000, max: number = 3000): Promise<void> {
    const ms = Math.floor(Math.random() * (max - min + 1)) + min;
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async safeText(page: Page, selector: string, timeoutMs: number = 3000): Promise<string> {
    try {
      return (await page.locator(selector).first().textContent({ timeout: timeoutMs }))?.trim() || '';
    } catch {
      return '';
    }
  }

  private async safeAttr(page: Page, selector: string, attr: string, timeoutMs: number = 3000): Promise<string> {
    try {
      return (await page.locator(selector).first().getAttribute(attr, { timeout: timeoutMs })) || '';
    } catch {
      return '';
    }
  }

  private parseNumber(text: string): number {
    if (!text) return 0;
    const clean = text.replace(/[^0-9.KkMmBb]/g, '');
    const num = parseFloat(clean);
    if (text.toLowerCase().includes('k')) return Math.floor(num * 1000);
    if (text.toLowerCase().includes('m')) return Math.floor(num * 1000000);
    if (text.toLowerCase().includes('b')) return Math.floor(num * 1000000000);
    return Math.floor(num) || 0;
  }

  private extractHashtags(text: string): string[] {
    const hashtags = text.match(/#\w+/g) || [];
    return hashtags.map((h) => h.replace('#', ''));
  }

  private extractMentions(text: string): string[] {
    const mentions = text.match(/@\w+/g) || [];
    return mentions.map((m) => m.replace('@', ''));
  }

  private parseVtt(vttText: string): string {
    const lines = vttText.split('\n');
    const textLines: string[] = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (trimmed === 'WEBVTT') continue;
      if (/^\d{2}:\d{2}:\d{2}\.\d{3}\s*-->/.test(trimmed)) continue;
      if (/^\d+$/.test(trimmed)) continue;
      textLines.push(trimmed);
    }
    return textLines.join(' ');
  }

  private classifyTikTokUrl(url: string): 'video' | 'search' | 'unknown' {
    if (/tiktok\.com\/@[\w.]+\/video\/\d+/.test(url)) return 'video';
    if (/tiktok\.com\/t\/[\w]+/.test(url)) return 'video';
    if (/tiktok\.com\/discover\//.test(url)) return 'search';
    if (/tiktok\.com\/tag\//.test(url)) return 'search';
    if (/tiktok\.com\/category\//.test(url)) return 'search';
    if (/tiktok\.com\/f\//.test(url)) return 'search';
    return 'unknown';
  }

  private parseSerpLinkText(text: string): {
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
          const viewMatch = segment.match(/([\d.]+[KkMmBb]?\+?)(?:\s*views)?$/i);
          if (viewMatch && viewCount === 0) {
            const num = this.parseNumber(viewMatch[1]);
            // Reject 2000–2100 range: Google sometimes puts "2025" (year) where view count goes
            if (num < 2000 || num > 2100) {
              viewCount = num;
            }
            continue;
          }
        if (datePattern.test(segment)) continue;
        creator = segment;
        break;
      }
    }

    if (viewCount === 0) {
      const globalViewMatch = text.match(/([\d.]+[KkMmBb]?\+?)\s*views/i);
      if (globalViewMatch) {
        const num = this.parseNumber(globalViewMatch[1]);
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

  private extractVideoId(url: string): string {
    const match = url.match(/\/video\/(\d+)/);
    if (match) return match[1];
    const match2 = url.match(/\/t\/([\w]+)/);
    if (match2) return match2[1];
    return Date.now().toString();
  }

  private async extractEmbeddedData(page: Page): Promise<EmbeddedVideoData | null> {
    try {
      const raw = await page.evaluate(() => {
        const el = document.getElementById('__NEXT_DATA__');
        return el ? el.textContent : null;
      });
      if (!raw) return null;

      const parsed = JSON.parse(raw);
      const item = parsed?.props?.pageProps?.itemInfo?.itemStruct;
      if (!item) return null;

      return {
        description: item.desc || undefined,
        author: item.author
          ? {
              id: item.author.id || undefined,
              uniqueId: item.author.uniqueId || undefined,
              nickname: item.author.nickname || undefined,
              avatarUrl:
                item.author.avatarLarger ||
                item.author.avatarMedium ||
                undefined,
              signature: item.author.signature || undefined,
              verified: item.author.verified || false,
              followerCount:
                item.authorStats?.followerCount ||
                item.author.stats?.followerCount ||
                undefined,
              followingCount:
                item.authorStats?.followingCount ||
                item.author.stats?.followingCount ||
                undefined,
              heartCount:
                item.authorStats?.heartCount ||
                item.author.stats?.heartCount ||
                undefined,
              videoCount:
                item.authorStats?.videoCount ||
                item.author.stats?.videoCount ||
                undefined,
            }
          : undefined,
        stats: item.stats
          ? {
              playCount: item.stats.playCount || undefined,
              diggCount: item.stats.diggCount || undefined,
              commentCount: item.stats.commentCount || undefined,
              shareCount: item.stats.shareCount || undefined,
              collectCount: item.stats.collectCount || undefined,
            }
          : undefined,
        hashtags: item.challenges?.map((c: any) => c.title) || undefined,
        createTime: item.createTime || undefined,
      };
    } catch {
      return null;
    }
  }

  async searchGoogle(
    query: string,
    page: Page,
  ): Promise<{
    videoUrls: string[];
    searchUrls: string[];
    serpResults: GoogleSerpResult[];
  }> {
    const videoUrls: string[] = [];
    const searchUrls: string[] = [];
    const serpResults: GoogleSerpResult[] = [];

    const googleQuery = `${query} tiktok`;
    const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(googleQuery)}`;

    console.log(`\nSearching Google for: "${googleQuery}"`);

    try {
      await page.goto(googleUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });
      await this.randomDelay(2000, 3000);

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
          const type = this.classifyTikTokUrl(cleanUrl);

          if (type === 'unknown') continue;
          if (seenUrls.has(cleanUrl)) continue;
          seenUrls.add(cleanUrl);

          const linkText = (await linkEl.textContent()) || '';
          const parsed = this.parseSerpLinkText(linkText);

          let citeViewCount = 0;
          try {
            const resultBlock = linkEl.locator('xpath=ancestor::div[@class="g" or contains(@class, "g ")]');
            const citeEl = resultBlock.locator('cite').first();
            const citeText = (await citeEl.textContent({ timeout: 2000 })) || '';
            const citeMatch = citeText.match(/([\d.]+[KkMmBb]?\+?)\s*views/i);
            if (citeMatch) citeViewCount = this.parseNumber(citeMatch[1]);
          } catch {}
          if (citeViewCount === 0) {
            try {
              const resultBlock = linkEl.locator('xpath=ancestor::div[3]');
              const citeEl = resultBlock.locator('cite').first();
              const citeText = (await citeEl.textContent({ timeout: 2000 })) || '';
              const citeMatch = citeText.match(/([\d.]+[KkMmBb]?\+?)\s*views/i);
              if (citeMatch) citeViewCount = this.parseNumber(citeMatch[1]);
            } catch {}
          }

          const result: GoogleSerpResult = {
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

          if (this.input.debug) {
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
      this.stats.errors.push(errorMsg);
    }

    return { videoUrls, searchUrls, serpResults };
  }

  async scrapeSearchPage(searchUrl: string, page: Page): Promise<GoogleSerpResult[]> {
    console.log(`\n  Scraping search page: ${searchUrl}`);
    try {
      await page.goto(searchUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });
      await this.randomDelay(3000, 5000);

      const containers = await page.locator('[class*="DivItemContainer"]').all();
      console.log(`  Found ${containers.length} video containers`);

      const results: GoogleSerpResult[] = [];
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
            viewCount = this.parseNumber(viewsText);
          } catch {}
          try {
            const likesText = (await container.locator('strong[class*="StrongLikes"]').first().textContent({ timeout: 2000 })) || '';
            likeCount = this.parseNumber(likesText);
          } catch {}

          let title = '';
          let creator = '';
          try {
            const imgAlt = (await container.locator('img[alt*="Likes"]').first().getAttribute('alt', { timeout: 2000 })) || '';
            const altMatch = imgAlt.match(/(\d[\d,.]*[KkMmBb]?)\s*Likes?,\s*(\d[\d,.]*[KkMmBb]?)\s*Comments?.*?from\s+(.+?)\s*\(@/);
            if (altMatch) {
              likeCount = likeCount || this.parseNumber(altMatch[1]);
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
      this.stats.errors.push(errorMsg);
      return [];
    }
  }

  async scrapeTikTokVideo(
    videoUrl: string,
    page: Page,
    serpData?: GoogleSerpResult,
  ): Promise<TikTokVideo | null> {
    console.log(`  Scraping video: ${videoUrl.substring(0, 70)}...`);

    let capturedVtt = '';

    const handleResponse = async (response: import('playwright').Response) => {
      try {
        const url = response.url();
        if (!url.includes('tiktokcdn')) return;
        const headers = response.headers();
        const contentType = headers['content-type'] || '';
        const contentLength = parseInt(headers['content-length'] || '0', 10);
        const isVttCandidate =
          contentType.includes('text/vtt') ||
          contentType.includes('text/plain') ||
          // TikTok CDN serves VTT files with wrong content-type: video/mp4.
          // Identify them by small size (<2000 bytes) since real videos are much larger.
          (contentType.includes('video/mp4') && contentLength > 0 && contentLength < 2000);
        if (!isVttCandidate) return;
        const body = await response.text().catch(() => '');
        if (body.startsWith('WEBVTT')) {
          capturedVtt = body;
          console.log(`    ✓ Captured VTT captions (${body.length} bytes, content-type: ${contentType})`);
        }
      } catch (_) {}
    };

    page.on('response', handleResponse);

    try {
      const t0 = performance.now();
      await page.goto(videoUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });
      const gotoMs = performance.now() - t0;
      await this.randomDelay(3000, 5000);
      const delayMs = performance.now() - t0 - gotoMs;

      const videoId = this.extractVideoId(videoUrl);
      const urlAuthorMatch = videoUrl.match(/@([\w.]+)/);
      const authorFromUrl = urlAuthorMatch ? urlAuthorMatch[1] : '';

      const t1 = performance.now();

      // __NEXT_DATA__ is skipped — TikTok blocks it for unauthenticated sessions.
      // There is no playCount/viewCount element in the DOM on individual video pages.
      // playCount comes from serpData (discover page or SERP <cite> element) instead.
      const embedded = null as EmbeddedVideoData | null;

      const [
        ogTitle, ogDescription, metaDescription, ogImage,
        videoDescText, likeText, commentText, shareText,
        collectText, bookmarkText, viewsText,
        posterAttr, poiText, poiHref, musicText,
      ] = await Promise.all([
        this.safeAttr(page, 'meta[property="og:title"]', 'content'),
        this.safeAttr(page, 'meta[property="og:description"]', 'content'),
        this.safeAttr(page, 'meta[name="description"]', 'content'),
        this.safeAttr(page, 'meta[property="og:image"]', 'content'),
        this.safeText(page, '[data-e2e="video-desc"]'),
        this.safeText(page, '[data-e2e="like-count"]'),
        this.safeText(page, '[data-e2e="comment-count"]'),
        this.safeText(page, '[data-e2e="share-count"]'),
        this.safeText(page, '[data-e2e="collect-count"]'),
        this.safeText(page, '[data-e2e="bookmark-count"]'),
        this.safeText(page, '[data-e2e="video-views"]'),
        this.safeAttr(page, '[data-e2e="feed-video"] video', 'poster'),
        this.safeText(page, '[data-e2e="poi-tag"]'),
        this.safeAttr(page, 'a[href*="/place/"]', 'href'),
        this.safeText(page, '[data-e2e="video-music"]'),
      ]);

      const description = embedded?.description || ogDescription || videoDescText || serpData?.title || '';

      let authorUniqueId = embedded?.author?.uniqueId || authorFromUrl;
      let authorNickname = embedded?.author?.nickname || '';

      if (!authorNickname) {
        const onTiktokMatch = ogTitle.match(/(.+?)\s+on TikTok/);
        if (onTiktokMatch) authorNickname = onTiktokMatch[1].trim();
      }
      if (!authorNickname) {
        const fromMatch = metaDescription.match(
          /from\s+(.+?)\s*\(@?[\w.]+\)/,
        );
        if (fromMatch) authorNickname = fromMatch[1].trim();
      }
      if (!authorNickname) authorNickname = serpData?.creator || authorFromUrl;

      let diggCount = embedded?.stats?.diggCount || 0;
      let commentCount = embedded?.stats?.commentCount || 0;
      let shareCount = embedded?.stats?.shareCount || 0;
      let collectCount = embedded?.stats?.collectCount || 0;
      let playCount = embedded?.stats?.playCount || serpData?.viewCount || 0;

      if (diggCount === 0) {
        const likesMatch = metaDescription.match(/([\d.]+[KkMmBb]?)\s*Likes?/i);
        if (likesMatch) diggCount = this.parseNumber(likesMatch[1]);
        if (likeText) diggCount = this.parseNumber(likeText);
      }

      if (commentCount === 0) {
        const commentsMatch = metaDescription.match(/([\d.]+[KkMmBb]?)\s*Comments?/i);
        if (commentsMatch) commentCount = this.parseNumber(commentsMatch[1]);
        if (commentText) commentCount = this.parseNumber(commentText);
      }

      if (shareCount === 0) {
        if (shareText) shareCount = this.parseNumber(shareText);
      }

      if (collectCount === 0) {
        if (collectText) collectCount = this.parseNumber(collectText);
        if (collectCount === 0 && bookmarkText) {
          collectCount = this.parseNumber(bookmarkText);
        }
      }

      if (playCount === 0) {
        const viewsMatch = metaDescription.match(/([\d.]+[KkMmBb]?)\s*[Vv]iews?/);
        if (viewsMatch) playCount = this.parseNumber(viewsMatch[1]);
        if (playCount === 0 && viewsText) playCount = this.parseNumber(viewsText);
      }

      const coverUrl = ogImage || posterAttr || '';

      const locationTag = poiText;

      let locationUrl = '';
      if (poiHref) {
        locationUrl = poiHref.startsWith('http')
          ? poiHref
          : `https://www.tiktok.com${poiHref}`;
      }

      let musicTitle = '';
      let musicAuthor = '';
      if (musicText) {
        const parts = musicText.split('-');
        if (parts.length >= 2) {
          musicTitle = parts[0].trim();
          musicAuthor = parts.slice(1).join('-').trim();
        }
      }

      const embeddedHashtags = embedded?.hashtags || [];
      const descHashtags = this.extractHashtags(description);
      const hashtags = [...new Set([...embeddedHashtags, ...descHashtags])];
      const mentions = this.extractMentions(description);
      const subtitles = capturedVtt ? this.parseVtt(capturedVtt) : '';
      const authorFollowers = embedded?.author?.followerCount || 0;

      const extractAndLocatorsMs = performance.now() - t1;
      const totalMs = performance.now() - t0;
      console.log(
        `    ✓ @${authorUniqueId} | ❤${diggCount} 💬${commentCount} 👁${playCount}${locationTag ? ` | 📍 ${locationTag}` : ''}${subtitles ? ' | 📝 captions' : ''} [${(totalMs / 1000).toFixed(1)}s: goto=${(gotoMs / 1000).toFixed(1)}s delay=${(delayMs / 1000).toFixed(1)}s extract+locators=${(extractAndLocatorsMs / 1000).toFixed(1)}s]`,
      );

      page.off('response', handleResponse);

      return {
        id: videoId,
        url: videoUrl,
        description: description.trim(),
        author: {
          id: embedded?.author?.id || '',
          uniqueId: authorUniqueId,
          nickname: authorNickname.trim(),
          avatarUrl: embedded?.author?.avatarUrl || '',
          signature: embedded?.author?.signature || '',
          verified: embedded?.author?.verified || false,
          followers: authorFollowers,
          following: embedded?.author?.followingCount || 0,
          hearts: embedded?.author?.heartCount || 0,
          videoCount: embedded?.author?.videoCount || 0,
        },
        createTime: embedded?.createTime || 0,
        playCount,
        shareCount,
        commentCount,
        diggCount,
        collectCount,
        videoUrl: '',
        coverUrl,
        dynamicCoverUrl: '',
        duration: 0,
        width: 0,
        height: 0,
        hashtags,
        mentions,
        isAd: false,
        isPinned: false,
        locationTag,
        locationUrl,
        musicTitle,
        musicAuthor,
        subtitles,
      };
    } catch (error) {
      page.off('response', handleResponse);
      const errorMsg = `Failed to scrape video: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error(`    ✗ ${errorMsg}`);
      this.stats.errors.push(errorMsg);
      return null;
    }
  }

  async scrape(): Promise<TikTokScraperOutput> {
    if (!this.context) await this.init();

    const results: ScrapingResult[] = [];
    const page = await this.context!.newPage();

    try {
      for (const query of this.input.searchQueries) {
        if (this.stats.totalVideos >= this.input.maxItems) break;

        const result: ScrapingResult = {
          query,
          videos: [],
          profiles: [],
          timestamp: new Date().toISOString(),
        };

        const { videoUrls, searchUrls, serpResults } =
          await this.searchGoogle(query, page);

        const allSearchResults: GoogleSerpResult[] = [...serpResults];
        let allVideoUrls: string[] = [...videoUrls];

        if (videoUrls.length < this.input.resultsPerPage && searchUrls.length > 0) {
          const needed = this.input.resultsPerPage - videoUrls.length;
          console.log(
            `\n=== Google found ${videoUrls.length} videos, need ${needed} more — scraping up to ${Math.min(searchUrls.length, 2)} search pages ===`,
          );
          const pagesToScrape = searchUrls.slice(0, 2);
          for (const searchUrl of pagesToScrape) {
            const pageResults = await this.scrapeSearchPage(searchUrl, page);
            for (const r of pageResults) {
              if (!allVideoUrls.includes(r.url)) {
                allVideoUrls.push(r.url);
                allSearchResults.push(r);
              }
            }
            await this.randomDelay(2000, 3000);
            if (allVideoUrls.length >= this.input.resultsPerPage) break;
          }
        }

        const uniqueUrls = [...new Set(allVideoUrls)];
        console.log(
          `\nTotal unique video URLs to scrape: ${uniqueUrls.length}`,
        );

        const urlsToScrape = uniqueUrls.slice(0, this.input.resultsPerPage);

        for (const videoUrl of urlsToScrape) {
          if (this.stats.totalVideos >= this.input.maxItems) break;

          const serpData = allSearchResults.find((r) => r.url === videoUrl);
          const video = await this.scrapeTikTokVideo(videoUrl, page, serpData);
          if (video) {
            result.videos.push(video);
            this.stats.totalVideos++;
          }

          await this.randomDelay(2000, 4000);
        }

        results.push(result);
        this.stats.queriesProcessed++;

        await this.randomDelay(3000, 5000);
      }
    } catch (error) {
      const errorMsg = `Scraping error: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error(errorMsg);
      this.stats.errors.push(errorMsg);
    } finally {
      await page.close();
    }

    return {
      input: this.input,
      results,
      stats: this.stats,
    };
  }
}
