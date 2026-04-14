import 'dotenv/config';
import { runScraper, runPipeline, saveResults, createStorage, exportToCsv, validateLocations, validateLocationsBatch, ValidationConfig, BatchValidationConfig } from './index.js';
import { processResults, ProcessResultsConfig } from './processor.js';
import { AiExtractor } from './ai-extractor.js';
import { TikTokScraperInput } from './types.js';
import { PipelineMode } from './pipeline/types.js';
import { StorageConfig, ScrapeRunMeta } from './storage/types.js';
import * as fs from 'fs';
import * as path from 'path';

function getStorageConfig(): StorageConfig {
  return {
    sqlitePath: process.env.SQLITE_PATH || 'data/locations.db',
    supabase:
      process.env.SUPABASE_URL && process.env.SUPABASE_KEY
        ? { url: process.env.SUPABASE_URL, key: process.env.SUPABASE_KEY }
        : undefined,
  };
}

async function runSync(): Promise<void> {
  console.log('Syncing SQLite → Supabase...\n');

  const config = getStorageConfig();
  if (!config.supabase) {
    console.error('Supabase not configured. Set SUPABASE_URL and SUPABASE_KEY in .env');
    process.exit(1);
  }

  const storage = createStorage(config);
  const locations = await storage.getLocations();
  console.log(`Found ${locations.length} locations in SQLite`);

  if (locations.length === 0) {
    console.log('Nothing to sync.');
    return;
  }

  // Re-upsert to trigger Supabase write via DualWriter
  const { SQLiteAdapter } = await import('./storage/sqlite.js');
  const { SupabaseAdapter } = await import('./storage/supabase.js');
  const supabase = new SupabaseAdapter(config.supabase!.url, config.supabase!.key);

  // Read raw locations from SQLite and push to Supabase
  for (const loc of locations) {
    try {
      await supabase.upsertLocations(
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
      console.warn(`  Failed to sync "${loc.name}": ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  console.log(`\nSynced ${locations.length} locations to Supabase`);
}

async function runExportCsv(csvPath: string): Promise<void> {
  const storage = createStorage(getStorageConfig());
  const locations = await storage.getLocations();
  exportToCsv(locations, csvPath);
  console.log(`Exported ${locations.length} locations to ${csvPath}`);
}

async function runValidate(): Promise<void> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    console.error('Google Maps API key not set. Set GOOGLE_MAPS_API_KEY in .env');
    process.exit(1);
  }

  const config: ValidationConfig = {
    storage: getStorageConfig(),
    apiKey,
  };

  await validateLocations(config);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--sync')) {
    await runSync();
    return;
  }

  if (args.includes('--validate')) {
    await runValidate();
    return;
  }

  const csvIndex = args.indexOf('--export-csv');
  if (csvIndex !== -1 && args[csvIndex + 1]) {
    await runExportCsv(args[csvIndex + 1]);
    return;
  }

  let customInput: Partial<TikTokScraperInput> = {};
  let mode: PipelineMode = 'google';

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

  const modeIndex = args.indexOf('--mode');
  if (modeIndex !== -1 && args[modeIndex + 1]) {
    const modeArg = args[modeIndex + 1];
    if (['google', 'tags', 'hybrid'].includes(modeArg)) {
      mode = modeArg as PipelineMode;
    } else {
      console.error(`Unknown mode: ${modeArg}. Use: google, tags, or hybrid`);
      process.exit(1);
    }
  }

  const outputDir = path.join(process.cwd(), 'output');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputPath = path.join(outputDir, `tiktok-scrape-${timestamp}.json`);
  const locationsPath = path.join(outputDir, `locations-${timestamp}.json`);

  console.log('Starting TikTok scraper...');
  console.log(`Mode: ${mode}`);
  console.log(`Search queries: ${customInput.searchQueries?.length || 0}`);
  console.log(`City: ${customInput.city || 'not set'}`);
  console.log(`Max items: ${customInput.maxItems || 55}`);
  console.log(
    `AI extraction: ${process.env.QWEN_API_KEY || customInput.openRouterApiKey || process.env.OPENROUTER_API_KEY ? 'enabled' : 'disabled'}`,
  );
  console.log('');

  try {
    let pipelineResult: { results: import('./types.js').ScrapingResult[]; stats: import('./types.js').ScraperStats };

    if (mode === 'google' && !customInput.openRouterApiKey && !process.env.OPENROUTER_API_KEY) {
      const output = await runScraper(customInput);
      pipelineResult = { results: output.results, stats: output.stats };
      saveResults(output, outputPath);
      console.log(`\nSaved full results to: ${outputPath}`);
    } else {
      const pr = await runPipeline({
        mode,
        queries: customInput.searchQueries || [],
        city: customInput.city,
        resultsPerPage: customInput.resultsPerPage || 5,
        maxItems: customInput.maxItems || 55,
        debug: customInput.debug,
        openRouterApiKey: customInput.openRouterApiKey || process.env.OPENROUTER_API_KEY,
        openRouterModel: customInput.openRouterModel,
      });
      pipelineResult = { results: pr.results, stats: pr.stats };

      const fullOutput = {
        input: { ...customInput, mode },
        results: pr.results,
        stats: pr.stats,
      };
      const dir = path.dirname(outputPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(outputPath, JSON.stringify(fullOutput, null, 2));
      console.log(`\nSaved full results to: ${outputPath}`);
    }

    console.log('\n=== Scraping Complete ===');
    console.log(`Total videos: ${pipelineResult.stats.totalVideos}`);
    console.log(`Queries processed: ${pipelineResult.stats.queriesProcessed}`);
    console.log(`Errors: ${pipelineResult.stats.errors.length}`);
    console.log(
      `Duration: ${pipelineResult.stats.durationMs ? Math.round(pipelineResult.stats.durationMs / 1000) : 0}s`,
    );

    const apiKey =
      process.env.QWEN_API_KEY || customInput.openRouterApiKey || process.env.OPENROUTER_API_KEY;
    const aiExtractor = apiKey
      ? new AiExtractor(apiKey, { model: customInput.openRouterModel })
      : undefined;

    const processConfig: ProcessResultsConfig = {
      aiExtractor,
      categoryKeywords: customInput.categoryKeywords,
      minEngagement: customInput.minEngagement,
    };

    const locations = await processResults(pipelineResult.results, processConfig);
    console.log(`Extracted ${locations.length} potential locations`);

    // Transform: Validate/geocode locations before storage
    const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;
    let validatedLocations: import('./validation/index.js').ValidatedLocation[] = [];
    let invalidLocations: import('./processor.js').LocationExtraction[] = [];

    if (googleMapsApiKey) {
      const batchConfig: BatchValidationConfig = {
        apiKey: googleMapsApiKey,
        city: customInput.city,
      };
      const result = await validateLocationsBatch(locations, batchConfig);
      validatedLocations = result.valid;
      invalidLocations = result.invalid;
    } else {
      console.log('\n[!] GOOGLE_MAPS_API_KEY not set — skipping validation step');
      console.log('    Locations will be stored without coordinates. Run --validate later.');
      // Cast to ValidatedLocation (without coordinates) for storage
      validatedLocations = locations.map(loc => ({
        ...loc,
        latitude: 0,
        longitude: 0,
        address: '',
      }));
    }

    const dir = path.dirname(locationsPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(locationsPath, JSON.stringify(validatedLocations, null, 2));
    console.log(`Saved ${validatedLocations.length} validated locations to: ${locationsPath}`);

    if (validatedLocations.length > 0) {
      const totalEngagement = validatedLocations.reduce(
        (sum, loc) => sum + loc.socialProof.totalEngagement,
        0,
      );
      const avgEngagement = Math.round(totalEngagement / validatedLocations.length);
      console.log(
        `Average engagement per location: ${avgEngagement} (likes+comments+shares+saves)`,
      );
    }

    // Load: Store validated locations in SQLite + Supabase
    const storage = createStorage(getStorageConfig());
    const runMeta: ScrapeRunMeta = {
      mode,
      queries: customInput.searchQueries || [],
      city: customInput.city,
      videosScraped: pipelineResult.stats.totalVideos,
      locationsFound: validatedLocations.length,
      errors: pipelineResult.stats.errors,
    };
    await storage.upsertLocations(validatedLocations, runMeta, customInput.city);
    console.log(`\nStored ${validatedLocations.length} validated locations in database`);
  } catch (error) {
    console.error(
      'Scraping failed:',
      error instanceof Error ? error.message : 'Unknown error',
    );
    process.exit(1);
  }
}

main();
