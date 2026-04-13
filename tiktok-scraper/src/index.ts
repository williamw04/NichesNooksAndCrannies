import { GoogleTikTokScraper } from './google-scraper.js';
import { TikTokScraperInput, TikTokScraperOutput, DEFAULT_INPUT } from './types.js';
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
export * from './types.js';
