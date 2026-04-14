import { Browser, BrowserContext } from 'playwright';
import {
  TikTokScraperInput,
  ScrapingResult,
  ScraperStats,
  TikTokScraperOutput,
} from './types.js';
import { launchBrowser, closeBrowser, randomDelay } from './scraping/browser.js';
import { SerpResult, scrapeSearchPage } from './scraping/search-page.js';
import { scrapeTikTokVideo } from './scraping/video-page.js';
import { searchGoogle as searchGoogleDiscovery, GoogleSearchResult } from './discovery/google-serp.js';

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
    const { browser, context } = await launchBrowser();
    this.browser = browser;
    this.context = context;
  }

  async close(): Promise<void> {
    if (this.context && this.browser) {
      await closeBrowser(this.browser, this.context);
    }
    this.stats.endTime = new Date().toISOString();
    this.stats.durationMs =
      new Date(this.stats.endTime).getTime() -
      new Date(this.stats.startTime).getTime();
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
          await searchGoogleDiscovery(query, page, this.input.debug, (msg) => this.stats.errors.push(msg));

        const allSearchResults: SerpResult[] = [...serpResults];
        let allVideoUrls: string[] = [...videoUrls];

        if (videoUrls.length < this.input.resultsPerPage && searchUrls.length > 0) {
          const needed = this.input.resultsPerPage - videoUrls.length;
          console.log(
            `\n=== Google found ${videoUrls.length} videos, need ${needed} more — scraping up to ${Math.min(searchUrls.length, 2)} search pages ===`,
          );
          const pagesToScrape = searchUrls.slice(0, 2);
          for (const searchUrl of pagesToScrape) {
            const pageResults = await scrapeSearchPage(searchUrl, page, (msg) => this.stats.errors.push(msg));
            for (const r of pageResults) {
              if (!allVideoUrls.includes(r.url)) {
                allVideoUrls.push(r.url);
                allSearchResults.push(r);
              }
            }
            await randomDelay(2000, 3000);
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
          const video = await scrapeTikTokVideo(videoUrl, page, serpData, (msg) => this.stats.errors.push(msg));
          if (video) {
            result.videos.push(video);
            this.stats.totalVideos++;
          }

          await randomDelay(2000, 4000);
        }

        results.push(result);
        this.stats.queriesProcessed++;

        await randomDelay(3000, 5000);
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
