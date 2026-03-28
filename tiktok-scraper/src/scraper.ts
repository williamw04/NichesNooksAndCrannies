import { chromium as playwrightChromium, Browser, Page, BrowserContext, Cookie } from 'playwright';
import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { 
  TikTokScraperInput, 
  TikTokVideo, 
  TikTokProfile, 
  TikTokAuthor,
  ScrapingResult,
  ScraperStats,
  TikTokScraperOutput
} from './types.js';
import * as fs from 'fs';
import * as path from 'path';

chromium.use(StealthPlugin());

const COOKIES_PATH = path.join(process.cwd(), 'auth', 'tiktok-cookies.json');

export class TikTokScraper {
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

  private loadCookies(): Cookie[] | null {
    try {
      if (fs.existsSync(COOKIES_PATH)) {
        const data = fs.readFileSync(COOKIES_PATH, 'utf-8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.log('Failed to load cookies:', error);
    }
    return null;
  }

  async init(): Promise<void> {
    const cookies = this.loadCookies();
    
    if (!cookies) {
      console.log('⚠️  No cookies found. Run "npm run login" first to authenticate.');
      console.log('   Continuing without authentication (may fail)...\n');
    }

    this.browser = await chromium.launch({
      headless: false,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-infobars',
        '--disable-background-networking',
        '--disable-breakpoints',
        '--disable-component-update',
        '--disable-default-apps',
        '--disable-extensions',
        '--disable-sync',
        '--metrics-recording-only',
        '--no-first-run',
        '--disable-features=IsolateOrigins,site-per-process'
      ]
    });

    this.context = await this.browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      locale: 'en-US',
      timezoneId: 'America/New_York',
      colorScheme: 'light',
      hasTouch: false,
      isMobile: false,
      javaScriptEnabled: true,
      ignoreHTTPSErrors: true
    });

    if (cookies && cookies.length > 0) {
      await this.context.addCookies(cookies);
      console.log(`✅ Loaded ${cookies.length} cookies from saved session\n`);
    }

    await this.context.addInitScript(`
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
      });
      window.chrome = { runtime: {} };
      Object.defineProperty(navigator, 'permissions', {
        get: () => ({
          query: () => Promise.resolve({ state: 'granted' }),
        }),
      });
    `);

    await this.context.route('**/*', async (route) => {
      const headers = route.request().headers();
      headers['accept-language'] = 'en-US,en;q=0.9';
      headers['sec-ch-ua'] = '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"';
      headers['sec-ch-ua-mobile'] = '?0';
      headers['sec-ch-ua-platform'] = '"macOS"';
      await route.continue({ headers });
    });
  }

  async close(): Promise<void> {
    if (this.context) await this.context.close();
    if (this.browser) await this.browser.close();
    this.stats.endTime = new Date().toISOString();
    this.stats.durationMs = 
      new Date(this.stats.endTime).getTime() - new Date(this.stats.startTime).getTime();
  }

  private async randomDelay(min: number = 1000, max: number = 3000): Promise<void> {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    await new Promise(resolve => setTimeout(resolve, delay));
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

  private extractHashtags(description: string): string[] {
    const hashtags = description.match(/#\w+/g) || [];
    return hashtags.map(h => h.replace('#', ''));
  }

  private extractMentions(description: string): string[] {
    const mentions = description.match(/@\w+/g) || [];
    return mentions.map(m => m.replace('@', ''));
  }

  async search(query: string, page: Page): Promise<TikTokVideo[]> {
    const videos: TikTokVideo[] = [];
    const searchUrl = this.buildSearchUrl(query);
    
    console.log(`Searching for: ${query}`);
    console.log(`URL: ${searchUrl}`);

    try {
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
      
      console.log('Page loaded, waiting for content...');
      await this.randomDelay(3000, 5000);

      for (let i = 0; i < 3; i++) {
        await page.mouse.wheel(0, 500);
        await this.randomDelay(1000, 2000);
      }

      const selectors = [
        '[data-e2e="search_video-item"]',
        '[data-e2e="search_video_item"]',
        'div[data-e2e="search-video-item"]',
        '[class*="DivItemContainer"]',
        'a[href*="/video/"]'
      ];

      let videoElements: any[] = [];
      for (const selector of selectors) {
        try {
          const count = await page.locator(selector).count();
          console.log(`Selector "${selector}": ${count} elements`);
          if (count > 0) {
            videoElements = await page.locator(selector).all();
            console.log(`Using selector: ${selector}`);
            break;
          }
        } catch (e) {
          console.log(`Selector "${selector}" failed: ${e}`);
        }
      }

      if (videoElements.length === 0) {
        console.log('No video elements found, taking screenshot...');
        await page.screenshot({ path: 'debug-no-videos.png' });
        
        const bodyText = await page.locator('body').textContent();
        if (bodyText?.includes('Sign up') || bodyText?.includes('Log in')) {
          console.log('Login wall detected');
          this.stats.errors.push('TikTok showing login wall');
        }
        return [];
      }
      
      console.log(`Found ${videoElements.length} video elements`);

      for (let i = 0; i < Math.min(videoElements.length, this.input.resultsPerPage); i++) {
        try {
          const videoEl = videoElements[i];
          await videoEl.scrollIntoViewIfNeeded();
          await this.randomDelay(500, 1500);

          const video = await this.extractVideoData(videoEl, page);
          if (video) {
            videos.push(video);
            this.stats.totalVideos++;
          }
        } catch (error) {
          const errorMsg = `Failed to extract video ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          console.error(errorMsg);
          this.stats.errors.push(errorMsg);
        }
      }
    } catch (error) {
      const errorMsg = `Search failed for "${query}": ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error(errorMsg);
      this.stats.errors.push(errorMsg);
    }

    return videos;
  }

  private buildSearchUrl(query: string): string {
    const params = new URLSearchParams();
    params.set('q', query);
    
    if (this.input.searchSection) {
      params.set('t', this.input.searchSection);
    }
    
    if (this.input.searchDatePosted && this.input.searchDatePosted !== '0') {
      params.set('upload_time', this.input.searchDatePosted);
    }

    return `https://www.tiktok.com/search?${params.toString()}`;
  }

  private async extractVideoData(videoEl: any, page: Page): Promise<TikTokVideo | null> {
    try {
      const linkEl = await videoEl.locator('a[href*="/video/"]').first();
      const videoUrl = await linkEl.getAttribute('href') || '';
      const videoId = this.extractVideoId(videoUrl);
      
      if (!videoId) return null;

      const description = await videoEl.locator('[data-e2e="search-video-desc"]').textContent() || '';
      
      const authorLink = await videoEl.locator('a[href*="/@"]').first();
      const authorHref = await authorLink.getAttribute('href') || '';
      const authorUniqueId = authorHref.split('/@')[1]?.split('/')[0] || '';

      const authorName = await authorLink.textContent() || authorUniqueId;

      const playCountText = await videoEl.locator('[data-e2e="search-video-play-count"]').textContent() || '0';
      const playCount = this.parseNumber(playCountText);

      const coverImg = await videoEl.locator('img').first();
      const coverUrl = await coverImg.getAttribute('src') || '';

      return {
        id: videoId,
        url: videoUrl,
        description: description.trim(),
        author: {
          id: '',
          uniqueId: authorUniqueId,
          nickname: authorName.trim(),
          avatarUrl: '',
          signature: '',
          verified: false,
          followers: 0,
          following: 0,
          hearts: 0,
          videoCount: 0
        },
        createTime: 0,
        playCount,
        shareCount: 0,
        commentCount: 0,
        diggCount: 0,
        collectCount: 0,
        videoUrl: '',
        coverUrl,
        dynamicCoverUrl: '',
        duration: 0,
        width: 0,
        height: 0,
        hashtags: this.extractHashtags(description),
        mentions: this.extractMentions(description),
        isAd: false,
        isPinned: false
      };
    } catch (error) {
      console.error('Error extracting video data:', error);
      return null;
    }
  }

  private extractVideoId(url: string): string {
    const match = url.match(/\/video\/(\d+)/);
    return match ? match[1] : '';
  }

  async scrapeProfile(uniqueId: string, page: Page): Promise<TikTokProfile | null> {
    const profileUrl = `https://www.tiktok.com/@${uniqueId}`;
    console.log(`Scraping profile: ${uniqueId}`);

    try {
      await page.goto(profileUrl, { waitUntil: 'networkidle', timeout: 30000 });
      await this.randomDelay(2000, 4000);

      const profileData = await this.extractProfileData(page);
      if (!profileData) return null;

      const videos: TikTokVideo[] = [];
      
      if (this.input.profileScrapeSections.includes('videos')) {
        const profileVideos = await this.scrapeProfileVideos(page, profileData);
        videos.push(...profileVideos);
      }

      this.stats.totalProfiles++;
      return { ...profileData, videos };
    } catch (error) {
      const errorMsg = `Failed to scrape profile ${uniqueId}: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error(errorMsg);
      this.stats.errors.push(errorMsg);
      return null;
    }
  }

  private async extractProfileData(page: Page): Promise<Omit<TikTokProfile, 'videos'> | null> {
    try {
      await page.waitForSelector('[data-e2e="profile-video-count"]', { timeout: 10000 });

      const uniqueId = await page.locator('[data-e2e="profile-unique-id"]').textContent() || '';
      const nickname = await page.locator('[data-e2e="profile-nickname"]').textContent() || '';
      const signature = await page.locator('[data-e2e="profile-bio"]').textContent() || '';
      const avatarUrl = await page.locator('[data-e2e="profile-avatar"] img').getAttribute('src') || '';
      
      const followersText = await page.locator('[data-e2e="followers-count"]').textContent() || '0';
      const followingText = await page.locator('[data-e2e="following-count"]').textContent() || '0';
      const heartsText = await page.locator('[data-e2e="likes-count"]').textContent() || '0';
      const videoCountText = await page.locator('[data-e2e="profile-video-count"]').textContent() || '0';

      const verified = await page.locator('[data-e2e="verified-badge"]').count() > 0;

      return {
        id: uniqueId,
        uniqueId: uniqueId.replace('@', ''),
        nickname: nickname.trim(),
        avatarUrl,
        signature: signature.trim(),
        verified,
        followers: this.parseNumber(followersText),
        following: this.parseNumber(followingText),
        hearts: this.parseNumber(heartsText),
        videoCount: this.parseNumber(videoCountText)
      };
    } catch (error) {
      console.error('Error extracting profile data:', error);
      return null;
    }
  }

  private async scrapeProfileVideos(page: Page, profileData: Omit<TikTokProfile, 'videos'>): Promise<TikTokVideo[]> {
    const videos: TikTokVideo[] = [];
    
    try {
      const videoElements = await page.locator('[data-e2e="user-post-item"]').all();
      
      for (let i = 0; i < Math.min(videoElements.length, this.input.resultsPerPage); i++) {
        if (this.stats.totalVideos >= this.input.maxItems) break;

        const videoEl = videoElements[i];
        const video = await this.extractProfileVideoData(videoEl, profileData);
        if (video) {
          videos.push(video);
          this.stats.totalVideos++;
        }
      }
    } catch (error) {
      console.error('Error scraping profile videos:', error);
    }

    return videos;
  }

  private async extractProfileVideoData(videoEl: any, profileData: Omit<TikTokProfile, 'videos'>): Promise<TikTokVideo | null> {
    try {
      const linkEl = await videoEl.locator('a').first();
      const videoUrl = await linkEl.getAttribute('href') || '';
      const videoId = this.extractVideoId(videoUrl);

      if (!videoId) return null;

      const coverImg = await videoEl.locator('img').first();
      const coverUrl = await coverImg.getAttribute('src') || '';

      const viewsText = await videoEl.locator('[data-e2e="video-views"]').textContent() || '0';

      return {
        id: videoId,
        url: videoUrl,
        description: '',
        author: {
          id: profileData.id,
          uniqueId: profileData.uniqueId,
          nickname: profileData.nickname,
          avatarUrl: profileData.avatarUrl,
          signature: profileData.signature,
          verified: profileData.verified,
          followers: profileData.followers,
          following: profileData.following,
          hearts: profileData.hearts,
          videoCount: profileData.videoCount
        },
        createTime: 0,
        playCount: this.parseNumber(viewsText),
        shareCount: 0,
        commentCount: 0,
        diggCount: 0,
        collectCount: 0,
        videoUrl: '',
        coverUrl,
        dynamicCoverUrl: '',
        duration: 0,
        width: 0,
        height: 0,
        hashtags: [],
        mentions: [],
        isAd: false,
        isPinned: false
      };
    } catch (error) {
      console.error('Error extracting profile video:', error);
      return null;
    }
  }

  async scrape(): Promise<TikTokScraperOutput> {
    if (!this.context) {
      await this.init();
    }

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

        const videos = await this.search(query, page);
        result.videos = videos;

        const profileIds = new Set<string>();
        for (const video of videos) {
          if (video.author.uniqueId && !profileIds.has(video.author.uniqueId)) {
            profileIds.add(video.author.uniqueId);
          }
        }

        const profilesToScrape = Array.from(profileIds).slice(0, this.input.maxProfilesPerQuery);
        for (const uniqueId of profilesToScrape) {
          if (this.stats.totalProfiles >= this.input.maxProfilesPerQuery * this.input.searchQueries.length) break;
          
          const profile = await this.scrapeProfile(uniqueId, page);
          if (profile) {
            result.profiles.push(profile);
          }
          await this.randomDelay(3000, 5000);
        }

        results.push(result);
        this.stats.queriesProcessed++;

        await this.randomDelay(3000, 6000);
      }
    } catch (error) {
      const errorMsg = `Scraping error: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error(errorMsg);
      this.stats.errors.push(errorMsg);
    } finally {
      await page.close();
    }

    this.stats.endTime = new Date().toISOString();
    this.stats.durationMs = 
      new Date(this.stats.endTime).getTime() - new Date(this.stats.startTime).getTime();

    return {
      input: this.input,
      results,
      stats: this.stats
    };
  }
}