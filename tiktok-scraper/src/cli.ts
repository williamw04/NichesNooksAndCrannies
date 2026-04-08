import { runScraper, saveResults } from './index.js';
import { processResults, ProcessResultsConfig } from './processor.js';
import { AiExtractor } from './ai-extractor.js';
import { TikTokScraperInput } from './types.js';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const args = process.argv.slice(2);

  let customInput: Partial<TikTokScraperInput> = {};

  const inputFileIndex = args.indexOf('--input');
  if (inputFileIndex !== -1 && args[inputFileIndex + 1]) {
    const inputFile = args[inputFileIndex + 1];
    try {
      const content = fs.readFileSync(inputFile, 'utf-8');
      customInput = JSON.parse(content);
      console.log(`Loaded input from: ${inputFile}`);
    } catch (error) {
      console.error(
        `Failed to load input file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      process.exit(1);
    }
  }

  const outputDir = path.join(process.cwd(), 'output');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputPath = path.join(outputDir, `tiktok-scrape-${timestamp}.json`);
  const locationsPath = path.join(outputDir, `locations-${timestamp}.json`);

  console.log('Starting TikTok scraper...');
  console.log(`Search queries: ${customInput.searchQueries?.length || 0}`);
  console.log(`Max items: ${customInput.maxItems || 55}`);
  console.log(
    `AI extraction: ${customInput.openRouterApiKey || process.env.OPENROUTER_API_KEY ? 'enabled' : 'disabled'}`,
  );
  console.log('');

  try {
    const output = await runScraper(customInput);

    console.log('\n=== Scraping Complete ===');
    console.log(`Total videos: ${output.stats.totalVideos}`);
    console.log(`Total profiles: ${output.stats.totalProfiles}`);
    console.log(`Queries processed: ${output.stats.queriesProcessed}`);
    console.log(`Errors: ${output.stats.errors.length}`);
    console.log(
      `Duration: ${output.stats.durationMs ? Math.round(output.stats.durationMs / 1000) : 0}s`,
    );

    saveResults(output, outputPath);
    console.log(`\nSaved full results to: ${outputPath}`);

    const apiKey =
      customInput.openRouterApiKey || process.env.OPENROUTER_API_KEY;
    const aiExtractor = apiKey
      ? new AiExtractor(apiKey, customInput.openRouterModel)
      : undefined;

    const processConfig: ProcessResultsConfig = {
      aiExtractor,
      categoryKeywords: customInput.categoryKeywords,
      minEngagement: customInput.minEngagement,
    };

    const locations = await processResults(output.results, processConfig);
    fs.writeFileSync(locationsPath, JSON.stringify(locations, null, 2));
    console.log(`Extracted ${locations.length} potential locations`);
    console.log(`Saved locations to: ${locationsPath}`);

    if (locations.length > 0) {
      const totalEngagement = locations.reduce(
        (sum, loc) => sum + loc.socialProof.totalEngagement,
        0,
      );
      const avgEngagement = Math.round(totalEngagement / locations.length);
      console.log(
        `Average engagement per location: ${avgEngagement} (likes+comments+shares+saves)`,
      );
    }

    if (output.stats.errors.length > 0) {
      console.log('\nErrors encountered:');
      output.stats.errors.forEach((err, i) => {
        console.log(`  ${i + 1}. ${err}`);
      });
    }
  } catch (error) {
    console.error(
      'Scraping failed:',
      error instanceof Error ? error.message : 'Unknown error',
    );
    process.exit(1);
  }
}

main();
