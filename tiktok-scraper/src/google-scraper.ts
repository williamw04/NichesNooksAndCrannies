import { chromium, Browser, BrowserContext, Page } from 'playwright';
import {
  TikTokScraperInput,
  TikTokVideo,
  ScrapingResult,
  ScraperStats,
  TikTokScraperOutput
} from './types.js';

interface GoogleSerpResult {
  url: string;
  title: string;
  creator: string;
  viewCount: number;
  type: 'video' | 'search' | 'unknown';
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
      startTime: new Date().toISOString()
    };
  }

  async init(): Promise<void> {
    this.browser = await chromium.launch({
      headless: false,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
        '--disable-setuid-sandbox'
      ]
    });

    this.context = await this.browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      locale: 'en-US',
      timezoneId: 'America/New_York'
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
      new Date(this.stats.endTime).getTime() - new Date(this.stats.startTime).getTime();
  }

  private async randomDelay(min: number = 1000, max: number = 3000): Promise<void> {
    const ms = Math.floor(Math.random() * (max - min + 1)) + min;
    await new Promise(resolve => setTimeout(resolve, ms));
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
    return hashtags.map(h => h.replace('#', ''));
  }

  private extractMentions(text: string): string[] {
    const mentions = text.match(/@\w+/g) || [];
    return mentions.map(m => m.replace('@', ''));
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

  private parseSerpLinkText(text: string): { title: string; creator: string; viewCount: number } {
    let title = '';
    let creator = '';
    let viewCount = 0;

    const tiktokSplit = text.split('TikTok');
    if (tiktokSplit.length >= 1) {
      title = tiktokSplit[0].trim();
    }
    if (tiktokSplit.length >= 2) {
      const afterTiktok = tiktokSplit[1];
      const dotSplit = afterTiktok.split('·');
      if (dotSplit.length >= 2) {
        creator = dotSplit[dotSplit.length - 1].trim();
        const viewMatch = creator.match(/([\d.]+[KkMmBb]?\+?)(?:\s*views)?$/);
        if (viewMatch) {
          viewCount = this.parseNumber(viewMatch[1]);
          creator = creator.replace(viewMatch[0], '').trim();
        }
      }
    }
    if (!title && text.length > 0) {
      title = text.substring(0, Math.min(60, text.length)).trim();
    }
    return { title, creator, viewCount };
  }

  async searchGoogle(query: string, page: Page): Promise<{
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
      await page.goto(googleUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await this.randomDelay(2000, 3000);

      const allLinks = await page.locator('a[href*="tiktok.com"]').all();
      console.log(`Found ${allLinks.length} TikTok links on Google`);

      const seenUrls = new Set<string>();

      for (const linkEl of allLinks) {
        try {
          const href = await linkEl.getAttribute('href') || '';
          if (!href) continue;

          const cleanUrl = href.split('#:~:text=')[0].split('?lang=')[0];
          const type = this.classifyTikTokUrl(cleanUrl);

          if (type === 'unknown') continue;
          if (seenUrls.has(cleanUrl)) continue;
          seenUrls.add(cleanUrl);

          const linkText = await linkEl.textContent() || '';
          const parsed = this.parseSerpLinkText(linkText);

          const result: GoogleSerpResult = {
            url: cleanUrl,
            title: parsed.title,
            creator: parsed.creator,
            viewCount: parsed.viewCount,
            type
          };
          serpResults.push(result);

          const label = type === 'video'
            ? `VIDEO [${parsed.creator}, ${parsed.viewCount} views]`
            : `SEARCH`;
          console.log(`  - ${label}: ${parsed.title.substring(0, 60)}`);

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

  async scrapeSearchPage(searchUrl: string, page: Page): Promise<string[]> {
    console.log(`\n  Scraping search page: ${searchUrl}`);

    try {
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await this.randomDelay(3000, 5000);

      for (let i = 0; i < 3; i++) {
        await page.mouse.wheel(0, 500);
        await this.randomDelay(1000, 2000);
      }

      const videoLinks = await page.locator('a[href*="/video/"]').all();
      console.log(`  Found ${videoLinks.length} video links on page`);

      const videoUrls: string[] = [];
      const seen = new Set<string>();

      for (const linkEl of videoLinks) {
        const href = await linkEl.getAttribute('href') || '';
        const cleanUrl = href.split('?')[0].split('#')[0];
        if (cleanUrl.includes('/video/') && !seen.has(cleanUrl)) {
          seen.add(cleanUrl);
          const fullUrl = cleanUrl.startsWith('http')
            ? cleanUrl
            : `https://www.tiktok.com${cleanUrl}`;
          videoUrls.push(fullUrl);
        }
      }

      console.log(`  Unique video URLs: ${videoUrls.length}`);
      return videoUrls;

    } catch (error) {
      const errorMsg = `Failed to scrape search page ${searchUrl}: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error(`  ✗ ${errorMsg}`);
      this.stats.errors.push(errorMsg);
      return [];
    }
  }

  private extractVideoId(url: string): string {
    const match = url.match(/\/video\/(\d+)/);
    if (match) return match[1];
    const match2 = url.match(/\/t\/([\w]+)/);
    if (match2) return match2[1];
    return Date.now().toString();
  }

  async scrapeTikTokVideo(videoUrl: string, page: Page, serpData?: GoogleSerpResult): Promise<TikTokVideo | null> {
    console.log(`  Scraping video: ${videoUrl.substring(0, 70)}...`);

    try {
      await page.goto(videoUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await this.randomDelay(3000, 5000);

      const videoId = this.extractVideoId(videoUrl);
      const urlAuthorMatch = videoUrl.match(/@([\w.]+)/);
      const authorFromUrl = urlAuthorMatch ? urlAuthorMatch[1] : '';

      let description = '';
      try {
        const descSelectors = ['[data-e2e="browse-video-desc"]', '[data-e2e="video-desc"]', 'h1'];
        for (const sel of descSelectors) {
          const text = await page.locator(sel).first().textContent();
          if (text?.trim()) { description = text.trim(); break; }
        }
      } catch (_) { /* ignore */ }
      if (!description) description = serpData?.title || '';

      let authorNickname = '';
      let authorFollowers = 0;
      let verified = false;
      try {
        const nameEl = page.locator('[data-e2e="browse-author-name"]').first();
        authorNickname = await nameEl.textContent() || '';
        if (!authorNickname) authorNickname = serpData?.creator || authorFromUrl;

        const followersEl = page.locator('[data-e2e="browse-followers"]').first();
        const fText = await followersEl.textContent() || '0';
        authorFollowers = this.parseNumber(fText);

        verified = await page.locator('[data-e2e="browse-verified"]').count() > 0;
      } catch (_) {
        authorNickname = serpData?.creator || authorFromUrl;
      }

      let playCount = 0;
      let diggCount = 0;
      let commentCount = 0;
      let shareCount = 0;
      try {
        playCount = this.parseNumber(await page.locator('[data-e2e="browse-views"]').first().textContent() || '0');
        diggCount = this.parseNumber(await page.locator('[data-e2e="browse-like-count"]').first().textContent() || '0');
        commentCount = this.parseNumber(await page.locator('[data-e2e="browse-comment-count"]').first().textContent() || '0');
        shareCount = this.parseNumber(await page.locator('[data-e2e="browse-share-count"]').first().textContent() || '0');
      } catch (_) { /* ignore */ }
      if (playCount === 0 && serpData?.viewCount) playCount = serpData.viewCount;

      let coverUrl = '';
      try {
        const videoEl = page.locator('video').first();
        const poster = await videoEl.getAttribute('poster');
        if (poster) coverUrl = poster;
        if (!coverUrl) {
          const imgEl = page.locator('img[src*="tiktokcdn"]').first();
          coverUrl = await imgEl.getAttribute('src') || '';
        }
      } catch (_) { /* ignore */ }

      let locationTag = '';
      try {
        locationTag = await page.locator('[data-e2e="video-location"]').first().textContent() || '';
      } catch (_) { /* ignore */ }

      let musicTitle = '';
      let musicAuthor = '';
      try {
        const musicText = await page.locator('[data-e2e="browse-music-info"]').first().textContent() || '';
        const parts = musicText.split('-');
        if (parts.length >= 2) {
          musicTitle = parts[0].trim();
          musicAuthor = parts.slice(1).join('-').trim();
        }
      } catch (_) { /* ignore */ }

      const hashtags = this.extractHashtags(description);
      const mentions = this.extractMentions(description);

      console.log(`    ✓ @${authorFromUrl} | ${playCount} views | ${hashtags.length} hashtags${locationTag ? ` | 📍 ${locationTag}` : ''}`);

      return {
        id: videoId,
        url: videoUrl,
        description: description.trim(),
        author: {
          id: '',
          uniqueId: authorFromUrl,
          nickname: authorNickname.trim(),
          avatarUrl: '',
          signature: '',
          verified,
          followers: authorFollowers,
          following: 0,
          hearts: 0,
          videoCount: 0
        },
        createTime: 0,
        playCount,
        shareCount,
        commentCount,
        diggCount,
        collectCount: 0,
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
        musicTitle,
        musicAuthor
      };
    } catch (error) {
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
          timestamp: new Date().toISOString()
        };

        const { videoUrls, searchUrls, serpResults } = await this.searchGoogle(query, page);

        let allVideoUrls: string[] = [];

        if (searchUrls.length > 0) {
          console.log(`\n=== Scraping ${searchUrls.length} search pages for video links ===`);
          for (const searchUrl of searchUrls) {
            const foundUrls = await this.scrapeSearchPage(searchUrl, page);
            allVideoUrls.push(...foundUrls);
            await this.randomDelay(2000, 3000);
          }
        }

        allVideoUrls.push(...videoUrls);

        const uniqueUrls = [...new Set(allVideoUrls)];
        console.log(`\nTotal unique video URLs to scrape: ${uniqueUrls.length}`);

        const urlsToScrape = uniqueUrls.slice(0, this.input.resultsPerPage);

        for (const videoUrl of urlsToScrape) {
          if (this.stats.totalVideos >= this.input.maxItems) break;

          const serpData = serpResults.find(r => r.url === videoUrl);
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
      stats: this.stats
    };
  }
}