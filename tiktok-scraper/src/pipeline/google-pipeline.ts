import { BrowserContext } from 'playwright';
import { randomDelay } from '../scraping/browser.js';
import { scrapeSearchPage, SerpResult } from '../scraping/search-page.js';
import { scrapeTikTokVideo } from '../scraping/video-page.js';
import { searchGoogle } from '../discovery/google-serp.js';
import { Pipeline, PipelineConfig, PipelineResult, makeStats, finalizeStats } from './types.js';

export class GooglePipeline implements Pipeline {
  constructor(private config: PipelineConfig) {}

  async run(context: BrowserContext): Promise<PipelineResult> {
    const stats = makeStats();
    const results: import('../types.js').ScrapingResult[] = [];
    const page = await context.newPage();

    try {
      for (const query of this.config.queries) {
        if (stats.totalVideos >= this.config.maxItems) break;

        const result: import('../types.js').ScrapingResult = {
          query,
          videos: [],
          profiles: [],
          timestamp: new Date().toISOString(),
        };

        const { videoUrls, searchUrls, serpResults } =
          await searchGoogle(query, page, this.config.debug, (msg) => stats.errors.push(msg));

        const allSearchResults: SerpResult[] = [...serpResults];
        let allVideoUrls: string[] = [...videoUrls];

        if (videoUrls.length < this.config.resultsPerPage && searchUrls.length > 0) {
          const needed = this.config.resultsPerPage - videoUrls.length;
          console.log(
            `\n=== Google found ${videoUrls.length} videos, need ${needed} more — scraping up to ${Math.min(searchUrls.length, 2)} search pages ===`,
          );
          for (const searchUrl of searchUrls.slice(0, 2)) {
            const pageResults = await scrapeSearchPage(searchUrl, page, (msg) => stats.errors.push(msg));
            for (const r of pageResults) {
              if (!allVideoUrls.includes(r.url)) {
                allVideoUrls.push(r.url);
                allSearchResults.push(r);
              }
            }
            await randomDelay(2000, 3000);
            if (allVideoUrls.length >= this.config.resultsPerPage) break;
          }
        }

        const uniqueUrls = [...new Set(allVideoUrls)].slice(0, this.config.resultsPerPage);
        console.log(`\nTotal unique video URLs to scrape: ${uniqueUrls.length}`);

        for (const videoUrl of uniqueUrls) {
          if (stats.totalVideos >= this.config.maxItems) break;
          const serpData = allSearchResults.find((r) => r.url === videoUrl);
          const video = await scrapeTikTokVideo(videoUrl, page, serpData, (msg) => stats.errors.push(msg));
          if (video) {
            result.videos.push(video);
            stats.totalVideos++;
          }
          await randomDelay(2000, 4000);
        }

        results.push(result);
        stats.queriesProcessed++;
        await randomDelay(3000, 5000);
      }
    } catch (error) {
      stats.errors.push(`Google pipeline error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      await page.close();
      finalizeStats(stats);
    }

    return { results, stats };
  }
}
