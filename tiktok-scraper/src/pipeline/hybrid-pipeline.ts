import { BrowserContext } from 'playwright';
import { randomDelay } from '../scraping/browser.js';
import { scrapeSearchPage, SerpResult } from '../scraping/search-page.js';
import { scrapeTikTokVideo } from '../scraping/video-page.js';
import { searchGoogle } from '../discovery/google-serp.js';
import { generateTags, generateDiscoverUrls } from '../discovery/tag-generator.js';
import { AiExtractor } from '../ai-extractor.js';
import { Pipeline, PipelineConfig, PipelineResult, makeStats, finalizeStats } from './types.js';

export class HybridPipeline implements Pipeline {
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

        console.log(`\n${'='.repeat(60)}`);
        console.log(`Hybrid pipeline: "${query}"`);
        console.log('='.repeat(60));

        // Stage 1: Google SERP discovery (finds discover pages + direct video URLs)
        const googleResult = await searchGoogle(query, page, this.config.debug, (msg) => stats.errors.push(msg));
        const allSearchResults: SerpResult[] = [...googleResult.serpResults];
        const seenVideoUrls = new Set<string>(googleResult.videoUrls);

        // Stage 2: Scrape Google-discovered search pages (discover + tag URLs)
        if (googleResult.searchUrls.length > 0) {
          console.log(`\n--- Scraping ${Math.min(googleResult.searchUrls.length, 2)} Google-discovered search pages ---`);
          for (const searchUrl of googleResult.searchUrls.slice(0, 2)) {
            const pageResults = await scrapeSearchPage(searchUrl, page, (msg) => stats.errors.push(msg));
            for (const r of pageResults) {
              if (!seenVideoUrls.has(r.url)) {
                seenVideoUrls.add(r.url);
                allSearchResults.push(r);
              }
            }
            await randomDelay(2000, 3000);
          }
        }

        // Stage 3: AI/heuristic tag discovery (bypasses Google captcha)
        if (seenVideoUrls.size < this.config.resultsPerPage) {
          const tagCandidates = await generateTags(query, this.config.city, aiExtractor);
          console.log(`\n--- Tag discovery: ${tagCandidates.map(t => '#' + t.tag).join(', ')} ---`);

          for (const tag of tagCandidates) {
            if (seenVideoUrls.size >= this.config.resultsPerPage * 2) break;
            const pageResults = await scrapeSearchPage(tag.url, page, (msg) => stats.errors.push(msg));
            for (const r of pageResults) {
              if (!seenVideoUrls.has(r.url)) {
                seenVideoUrls.add(r.url);
                allSearchResults.push(r);
              }
            }
            await randomDelay(2000, 3000);
          }
        }

        // Stage 4: Discover page fallback
        if (seenVideoUrls.size < this.config.resultsPerPage) {
          const discoverCandidates = generateDiscoverUrls(query, this.config.city);
          for (const discover of discoverCandidates) {
            if (seenVideoUrls.size >= this.config.resultsPerPage * 2) break;
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

        // Stage 5: Scrape individual video pages
        const urlsToScrape = [...seenVideoUrls].slice(0, this.config.resultsPerPage);
        console.log(`\nTotal unique video URLs to scrape: ${urlsToScrape.length}`);

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
      stats.errors.push(`Hybrid pipeline error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      await page.close();
      finalizeStats(stats);
    }

    return { results, stats };
  }
}
