import { GoogleTikTokScraper } from './google-scraper.js';
import { TikTokScraperInput, TikTokScraperOutput, DEFAULT_INPUT } from './types.js';
import { launchBrowser, closeBrowser } from './scraping/browser.js';
import { createPipeline, PipelineConfig, PipelineMode, PipelineResult } from './pipeline/index.js';
import { configFromInput } from './pipeline/types.js';
import * as fs from 'fs';
import * as path from 'path';

export async function runScraper(customInput?: Partial<TikTokScraperInput>): Promise<TikTokScraperOutput> {
  const input: TikTokScraperInput = {
    ...DEFAULT_INPUT,
    ...customInput
  };

  const scraper = new GoogleTikTokScraper(input);

  try {
    await scraper.init();
    const results = await scraper.scrape();
    return results;
  } finally {
    await scraper.close();
  }
}

export async function runPipeline(
  config: PipelineConfig,
): Promise<PipelineResult> {
  const { browser, context } = await launchBrowser();
  try {
    const pipeline = createPipeline(config);
    return await pipeline.run(context);
  } finally {
    await closeBrowser(browser, context);
  }
}

export function saveResults(output: TikTokScraperOutput, outputPath: string): void {
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
}

export { GoogleTikTokScraper } from './google-scraper.js';
export { AiExtractor } from './ai-extractor.js';
export { processResults } from './processor.js';
export type { LocationExtraction, ProcessResultsConfig } from './processor.js';
export { createPipeline, GooglePipeline, TagPipeline, HybridPipeline } from './pipeline/index.js';
export type { PipelineConfig, PipelineMode, PipelineResult } from './pipeline/index.js';
export { createStorage, exportToCsv } from './storage/index.js';
export { validateLocations, validateLocationsBatch } from './validation/index.js';
export type { ValidationConfig, BatchValidationConfig, ValidatedLocation, BatchValidationResult } from './validation/index.js';
export type { StorageAdapter, StorageConfig, StoredLocation, ScrapeRunMeta, LocationFilters } from './storage/index.js';
export * from './types.js';
