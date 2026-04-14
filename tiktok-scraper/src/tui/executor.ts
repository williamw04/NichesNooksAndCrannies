import 'dotenv/config';
import { confirm } from '@inquirer/prompts';
import * as fs from 'fs';
import * as path from 'path';
import { TikTokScraperInput, ScrapingResult, ScraperStats } from '../types.js';
import { PipelineMode } from '../pipeline/types.js';
import { StorageConfig } from '../storage/types.js';
import { runScraper, runPipeline, saveResults, createStorage, exportToCsv } from '../index.js';
import { processResults } from '../processor.js';
import { AiExtractor } from '../ai-extractor.js';
import { clearScreen, printHeader, printScrapingStats } from './display.js';

export async function runScraping(config: TikTokScraperInput & { mode?: PipelineMode }): Promise<void> {
  clearScreen();
  printHeader();
  console.log('Running Scraper...\n');
  console.log(`Mode: ${config.mode || 'google'}\n`);
  console.log('Press Ctrl+C to stop\n');

  const outputDir = path.join(process.cwd(), 'output');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputPath = path.join(outputDir, `tiktok-scrape-${timestamp}.json`);
  const locationsPath = path.join(outputDir, `locations-${timestamp}.json`);

  try {
    console.log('Initializing browser...');

    const mode = config.mode || 'google';
    let outputResults: ScrapingResult[];
    let outputStats: ScraperStats;

    if (mode === 'google') {
      const output = await runScraper(config);
      outputResults = output.results;
      outputStats = output.stats;
      saveResults(output, outputPath);
    } else {
      const pipelineResult = await runPipeline({
        mode,
        queries: config.searchQueries,
        city: config.city,
        resultsPerPage: config.resultsPerPage,
        maxItems: config.maxItems,
        debug: config.debug,
        openRouterApiKey: config.openRouterApiKey || process.env.OPENROUTER_API_KEY,
        openRouterModel: config.openRouterModel,
      });
      outputResults = pipelineResult.results;
      outputStats = pipelineResult.stats;
      const fullOutput = { input: { ...config, mode }, results: pipelineResult.results, stats: pipelineResult.stats };
      if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
      fs.writeFileSync(outputPath, JSON.stringify(fullOutput, null, 2));
    }

    printScrapingStats(outputStats);
    console.log(`Full results saved to: ${outputPath}`);

    const apiKey = process.env.QWEN_API_KEY || config.openRouterApiKey || process.env.OPENROUTER_API_KEY;
    const aiExtractor = apiKey
      ? new AiExtractor(apiKey, { model: config.openRouterModel })
      : undefined;

    if (aiExtractor) {
      console.log('AI location extraction: enabled (Qwen)');
    } else {
      console.log('AI location extraction: disabled (set QWEN_API_KEY to enable)');
    }

    const locations = await processResults(outputResults, {
      aiExtractor,
      categoryKeywords: config.categoryKeywords,
      minEngagement: config.minEngagement,
    });

    fs.writeFileSync(locationsPath, JSON.stringify(locations, null, 2));
    console.log(`\nExtracted ${locations.length} locations with social validation`);
    console.log(`Locations saved to: ${locationsPath}`);

    if (locations.length > 0) {
      const totalEngagement = locations.reduce(
        (sum, loc) => sum + loc.socialProof.totalEngagement,
        0,
      );
      const avgEngagement = Math.round(totalEngagement / locations.length);
      console.log(`Average engagement per location: ${avgEngagement}`);

      const topLocations = locations.slice(0, 5);
      console.log('\nTop locations by engagement:');
      topLocations.forEach((loc, i) => {
        console.log(`  ${i + 1}. ${loc.name} (${loc.socialProof.totalEngagement} engagement, ${loc.extractionMethod})`);
      });
    }

    if (outputStats.errors.length > 0) {
      console.log('\nErrors encountered:');
      outputStats.errors.slice(0, 5).forEach((err: string, i: number) => {
        console.log(`   ${i + 1}. ${err}`);
      });
      if (outputStats.errors.length > 5) {
        console.log(`   ... and ${outputStats.errors.length - 5} more`);
      }
    }

    await confirm({ message: '\nPress enter to continue...', default: true });

  } catch (error) {
    console.error('\nScraping failed:', error instanceof Error ? error.message : 'Unknown error');
    await confirm({ message: '\nPress enter to continue...', default: true });
  }
}

export async function syncToSupabase(): Promise<void> {
  clearScreen();
  printHeader();
  console.log('Sync to Supabase\n');

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.log('Supabase not configured. Set SUPABASE_URL and SUPABASE_KEY in .env');
    await confirm({ message: '\nPress enter to continue...', default: true });
    return;
  }

  const config: StorageConfig = {
    sqlitePath: process.env.SQLITE_PATH || 'data/locations.db',
    supabase: { url: supabaseUrl, key: supabaseKey },
  };

  const storage = createStorage(config);
  const locations = await storage.getLocations();

  console.log(`Found ${locations.length} locations in local database`);

  if (locations.length === 0) {
    console.log('Nothing to sync. Run the scraper first.');
    await confirm({ message: '\nPress enter to continue...', default: true });
    return;
  }

  const proceed = await confirm({
    message: `Sync ${locations.length} locations to Supabase?`,
    default: true,
  });

  if (proceed) {
    for (const loc of locations) {
      try {
        await storage.upsertLocations(
          [
            {
              name: loc.name,
              description: loc.description,
              category: loc.category,
              source: loc.source,
              sourceUrl: loc.sourceUrl,
              sourceVideoCount: loc.sourceVideoCount,
              hashtags: loc.hashtags,
              mentions: loc.mentions,
              author: loc.author,
              authorFollowers: loc.authorFollowers,
              socialProof: loc.socialProof,
              locationTag: loc.locationTag,
              locationUrl: loc.locationUrl,
              music: loc.music,
              extractionMethod: loc.extractionMethod,
            },
          ],
          {
            mode: 'tags' as PipelineMode,
            queries: [],
            city: loc.city,
            videosScraped: 0,
            locationsFound: 1,
            errors: [],
          },
          loc.city,
        );
      } catch (error) {
        console.warn(`  Failed: "${loc.name}" - ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    console.log(`\nSynced ${locations.length} locations to Supabase`);
  }

  await confirm({ message: '\nPress enter to continue...', default: true });
}

export async function exportLocationsCsv(): Promise<void> {
  clearScreen();
  printHeader();
  console.log('Export to CSV\n');

  const config: StorageConfig = {
    sqlitePath: process.env.SQLITE_PATH || 'data/locations.db',
  };

  const storage = createStorage(config);
  const locations = await storage.getLocations();

  if (locations.length === 0) {
    console.log('No locations in database. Run the scraper first.');
    await confirm({ message: '\nPress enter to continue...', default: true });
    return;
  }

  const defaultPath = path.join(process.cwd(), 'output', 'locations.csv');
  const csvPath = await import('@inquirer/prompts').then(m => m.input({
    message: 'Output file path:',
    default: defaultPath,
  }));

  exportToCsv(locations, csvPath);
  console.log(`\nExported ${locations.length} locations to ${csvPath}`);

  await confirm({ message: '\nPress enter to continue...', default: true });
}