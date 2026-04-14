import { BrowserContext } from 'playwright';
import { randomDelay } from '../scraping/browser.js';
import { scrapeSearchPage, SerpResult } from '../scraping/search-page.js';
import { scrapeTikTokVideo } from '../scraping/video-page.js';
import { generateTags, generateDiscoverUrls } from '../discovery/tag-generator.js';
import { AiExtractor } from '../ai-extractor.js';
import { Pipeline, PipelineConfig, PipelineResult, makeStats, finalizeStats } from './types.js';

export class TagPipeline implements Pipeline {
  constructor(private config: PipelineConfig) {}

  async run(context: BrowserContext): Promise<PipelineResult> {
    const stats = makeStats();
    const results: import('../types.js').ScrapingResult[] = [];
    const page = await context.newPage();

    const aiExtractor = this.config.openRouterApiKey
      ? new AiExtractor(this.config.openRouterApiKey, { model: this.config.openRouterModel })
      : null;

    try {
      for (const query of this.config.queries) {
        if (stats.totalVideos >= this.config.maxItems) break;

        const result: import('../types.js').ScrapingResult = {
          query,
          videos: [],
          profiles: [],
          timestamp: new Date().toISOString(),
        };

        // Generate tag candidates (heuristic + AI if available)
        const tagCandidates = await generateTags(query, this.config.city, aiExtractor);
        const discoverCandidates = generateDiscoverUrls(query, this.config.city);

        console.log(`\n=== Tag pipeline for "${query}" ===`);
        console.log(`  Tags: ${tagCandidates.map(t => '#' + t.tag).join(', ')}`);
        console.log(`  Discover: ${discoverCandidates.map(d => d.slug).join(', ')}`);

        const allSearchResults: SerpResult[] = [];
        const seenVideoUrls = new Set<string>();

        // Scrape tag pages
        for (const tag of tagCandidates) {
          if (seenVideoUrls.size >= this.config.resultsPerPage) break;
          console.log(`\n  Scraping tag: #${tag.tag} (${tag.source})`);
          const pageResults = await scrapeSearchPage(tag.url, page, (msg) => stats.errors.push(msg));
          for (const r of pageResults) {
            if (!seenVideoUrls.has(r.url)) {
              seenVideoUrls.add(r.url);
              allSearchResults.push(r);
            }
          }
          await randomDelay(2000, 3000);
        }

        // Fallback: try discover pages if tags didn't yield enough
        if (seenVideoUrls.size < this.config.resultsPerPage) {
          for (const discover of discoverCandidates) {
            if (seenVideoUrls.size >= this.config.resultsPerPage) break;
            console.log(`\n  Scraping discover: ${discover.slug}`);
            const pageResults = await scrapeSearchPage(discover.url, page, (msg) => stats.errors.push(msg));
            for (const r of pageResults) {
              if (!seenVideoUrls.has(r.url)) {
                seenVideoUrls.add(r.url);
                allSearchResults.push(r);
              }
            }
            await randomDelay(2000, 3000);
          }
        }

        const urlsToScrape = [...seenVideoUrls].slice(0, this.config.resultsPerPage);
        console.log(`\n  Total unique video URLs: ${urlsToScrape.length}`);

        for (const videoUrl of urlsToScrape) {
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
      stats.errors.push(`Tag pipeline error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      await page.close();
      finalizeStats(stats);
    }

    return { results, stats };
  }
}
