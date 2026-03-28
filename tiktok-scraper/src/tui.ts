import {
  input,
  select,
  confirm,
  number,
  checkbox,
  editor
} from '@inquirer/prompts';
import { TikTokScraperInput, DEFAULT_INPUT } from './types.js';
import { runScraper, saveResults } from './index.js';
import { processResults } from './processor.js';
import * as fs from 'fs';
import * as path from 'path';

const PRESET_QUERIES = [
  'best cafe spots in New York City',
  'best restaurant spots in New York City',
  'best nature spots in New York City',
  'best historical spots in New York City',
  'best museum spots in New York City',
  'best shopping spots in New York City',
  'best adventure spots in New York City',
  'best relaxation spots in New York City',
  'best nightlife spots in New York City',
  'best festival spots in New York City',
  'best local spots in New York City',
  'hidden gems NYC',
  'underrated places NYC',
  'secret spots New York',
  'locals only NYC'
];

function clearScreen() {
  console.clear();
}

function printHeader() {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                    TikTok Scraper v1.0                       ║
║              NYC Hidden Gems Data Collection                 ║
╚══════════════════════════════════════════════════════════════╝
`);
}

function printConfigSummary(config: Partial<TikTokScraperInput>) {
  console.log('\n┌─────────────────────────────────────────────────────────────┐');
  console.log('│                    Current Configuration                    │');
  console.log('├─────────────────────────────────────────────────────────────┤');
  console.log(`│ Search Queries: ${(config.searchQueries?.length || 0).toString().padEnd(46)}│`);
  console.log(`│ Results Per Page: ${(config.resultsPerPage?.toString() || '5').padEnd(44)}│`);
  console.log(`│ Max Items: ${(config.maxItems?.toString() || '55').padEnd(50)}│`);
  console.log(`│ Max Profiles/Query: ${(config.maxProfilesPerQuery?.toString() || '10').padEnd(41)}│`);
  console.log(`│ Search Sorting: ${(config.searchSorting === '0' ? 'Relevance' : config.searchSorting === '1' ? 'Most Recent' : 'Most Viewed').padEnd(43)}│`);
  console.log(`│ Download Videos: ${(config.shouldDownloadVideos ? 'Yes' : 'No').padEnd(44)}│`);
  console.log(`│ Download Covers: ${(config.shouldDownloadCovers ? 'Yes' : 'No').padEnd(44)}│`);
  console.log(`│ Proxy: ${(config.proxyCountryCode || 'None').padEnd(53)}│`);
  console.log('└─────────────────────────────────────────────────────────────┘\n');
}

async function configureQueries(current: string[]): Promise<string[]> {
  clearScreen();
  printHeader();
  console.log('Configure Search Queries\n');

  const action = await select({
    message: 'How would you like to set up queries?',
    choices: [
      { name: '📝 Enter custom queries', value: 'custom' },
      { name: '📋 Select from presets', value: 'presets' },
      { name: '✏️  Edit current queries', value: 'edit' },
      { name: '🔙 Back to main menu', value: 'back' }
    ]
  });

  if (action === 'back') return current;

  if (action === 'presets') {
    const selected = await checkbox({
      message: 'Select queries to include (space to select, enter to confirm):',
      choices: PRESET_QUERIES.map(q => ({
        name: q,
        value: q,
        checked: current.includes(q)
      }))
    });
    return selected;
  }

  if (action === 'edit' && current.length > 0) {
    console.log('\nCurrent queries:');
    current.forEach((q, i) => console.log(`  ${i + 1}. ${q}`));
    
    const toRemove = await checkbox({
      message: 'Select queries to remove:',
      choices: current.map(q => ({ name: q, value: q }))
    });
    
    const remaining = current.filter(q => !toRemove.includes(q));
    
    const addMore = await confirm({
      message: 'Add new queries?',
      default: true
    });
    
    if (addMore) {
      let addAnother = true;
      while (addAnother) {
        const newQuery = await input({
          message: 'Enter a search query:',
          validate: (value) => value.trim().length > 0 || 'Query cannot be empty'
        });
        remaining.push(newQuery.trim());
        addAnother = await confirm({
          message: 'Add another query?',
          default: false
        });
      }
    }
    
    return remaining;
  }

  if (action === 'custom') {
    const queries: string[] = [];
    let addAnother = true;
    
    while (addAnother) {
      const query = await input({
        message: `Enter search query ${queries.length + 1}:`,
        validate: (value) => value.trim().length > 0 || 'Query cannot be empty'
      });
      queries.push(query.trim());
      
      addAnother = await confirm({
        message: 'Add another query?',
        default: true
      });
    }
    
    return queries;
  }

  return current;
}

async function configureAdvanced(current: TikTokScraperInput): Promise<TikTokScraperInput> {
  clearScreen();
  printHeader();
  console.log('Advanced Configuration\n');

  const resultsPerPage = await number({
    message: 'Results per page:',
    default: current.resultsPerPage,
    min: 1,
    max: 50
  });

  const maxItems = await number({
    message: 'Maximum items to scrape:',
    default: current.maxItems,
    min: 1,
    max: 500
  });

  const maxProfilesPerQuery = await number({
    message: 'Maximum profiles per query:',
    default: current.maxProfilesPerQuery,
    min: 1,
    max: 50
  });

  const searchSorting = await select({
    message: 'Search sorting:',
    choices: [
      { name: 'Relevance', value: '0' },
      { name: 'Most Recent', value: '1' },
      { name: 'Most Viewed', value: '2' }
    ],
    default: current.searchSorting
  });

  const searchDatePosted = await select({
    message: 'Filter by date posted:',
    choices: [
      { name: 'All time', value: '0' },
      { name: 'Last 24 hours', value: '1' },
      { name: 'Last 7 days', value: '7' },
      { name: 'Last 30 days', value: '30' }
    ],
    default: current.searchDatePosted
  });

  const searchSection = await select({
    message: 'Search section:',
    choices: [
      { name: 'All', value: '' },
      { name: 'Users', value: 'user' },
      { name: 'Videos', value: 'video' },
      { name: 'Hashtags', value: 'hashtag' },
      { name: 'Sounds', value: 'sound' }
    ],
    default: current.searchSection
  });

  const profileSorting = await select({
    message: 'Profile sorting:',
    choices: [
      { name: 'Latest', value: 'latest' },
      { name: 'Oldest', value: 'oldest' },
      { name: 'Popular', value: 'popular' }
    ],
    default: current.profileSorting
  });

  const profileScrapeSections = await checkbox({
    message: 'Profile sections to scrape:',
    choices: [
      { name: 'Videos', value: 'videos', checked: current.profileScrapeSections.includes('videos') },
      { name: 'Liked', value: 'liked', checked: current.profileScrapeSections.includes('liked') },
      { name: 'Favorites', value: 'favorites', checked: current.profileScrapeSections.includes('favorites') }
    ]
  });

  const shouldDownloadVideos = await confirm({
    message: 'Download videos?',
    default: current.shouldDownloadVideos
  });

  const shouldDownloadCovers = await confirm({
    message: 'Download cover images?',
    default: current.shouldDownloadCovers
  });

  const shouldDownloadAvatars = await confirm({
    message: 'Download profile avatars?',
    default: current.shouldDownloadAvatars
  });

  const excludePinnedPosts = await confirm({
    message: 'Exclude pinned posts?',
    default: current.excludePinnedPosts
  });

  const scrapeRelatedVideos = await confirm({
    message: 'Scrape related videos?',
    default: current.scrapeRelatedVideos
  });

  const proxyCountryCode = await input({
    message: 'Proxy country code (leave empty for none):',
    default: current.proxyCountryCode === 'None' ? '' : current.proxyCountryCode
  });

  return {
    ...current,
    resultsPerPage: resultsPerPage || 5,
    maxItems: maxItems || 55,
    maxProfilesPerQuery: maxProfilesPerQuery || 10,
    searchSorting: searchSorting as '0' | '1' | '2',
    searchDatePosted: searchDatePosted as '0' | '1' | '7' | '30',
    searchSection: searchSection as '' | 'user' | 'video' | 'hashtag' | 'sound',
    profileSorting: profileSorting as 'latest' | 'oldest' | 'popular',
    profileScrapeSections: profileScrapeSections as ('videos' | 'liked' | 'favorites')[],
    shouldDownloadVideos,
    shouldDownloadCovers,
    shouldDownloadAvatars,
    excludePinnedPosts,
    scrapeRelatedVideos,
    proxyCountryCode: proxyCountryCode || 'None',
    shouldDownloadSubtitles: false,
    shouldDownloadSlideshowImages: false,
    shouldDownloadMusicCovers: false,
    downloadSubtitlesOptions: 'NEVER_DOWNLOAD_SUBTITLES'
  };
}

async function saveConfiguration(config: TikTokScraperInput): Promise<void> {
  clearScreen();
  printHeader();
  console.log('Save Configuration\n');

  const saveFile = await confirm({
    message: 'Save configuration to file?',
    default: true
  });

  if (saveFile) {
    const filename = await input({
      message: 'Filename:',
      default: 'config.json',
      validate: (value) => value.endsWith('.json') || 'Filename must end with .json'
    });

    const outputDir = path.join(process.cwd(), 'configs');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputPath = path.join(outputDir, filename);
    fs.writeFileSync(outputPath, JSON.stringify(config, null, 2));
    console.log(`\n✅ Configuration saved to: ${outputPath}`);
  }
}

async function loadConfiguration(): Promise<TikTokScraperInput | null> {
  const configDir = path.join(process.cwd(), 'configs');
  
  if (!fs.existsSync(configDir)) {
    return null;
  }

  const files = fs.readdirSync(configDir).filter(f => f.endsWith('.json'));
  
  if (files.length === 0) {
    return null;
  }

  const loadFile = await confirm({
    message: 'Load existing configuration?',
    default: true
  });

  if (!loadFile) {
    return null;
  }

  const selectedFile = await select({
    message: 'Select configuration:',
    choices: files.map(f => ({ name: f, value: f }))
  });

  const filePath = path.join(configDir, selectedFile);
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content);
}

async function runScraping(config: TikTokScraperInput): Promise<void> {
  clearScreen();
  printHeader();
  console.log('Running Scraper...\n');
  console.log('Press Ctrl+C to stop\n');

  const outputDir = path.join(process.cwd(), 'output');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputPath = path.join(outputDir, `tiktok-scrape-${timestamp}.json`);
  const locationsPath = path.join(outputDir, `locations-${timestamp}.json`);

  try {
    console.log('Initializing browser...');
    const output = await runScraper(config);

    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║                    Scraping Complete                         ║');
    console.log('╠══════════════════════════════════════════════════════════════╣');
    console.log(`║ Total Videos: ${output.stats.totalVideos.toString().padEnd(47)}║`);
    console.log(`║ Total Profiles: ${output.stats.totalProfiles.toString().padEnd(45)}║`);
    console.log(`║ Queries Processed: ${output.stats.queriesProcessed.toString().padEnd(41)}║`);
    console.log(`║ Errors: ${output.stats.errors.length.toString().padEnd(52)}║`);
    console.log(`║ Duration: ${(output.stats.durationMs ? Math.round(output.stats.durationMs / 1000) : 0).toString()}s`.padEnd(63) + '║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');

    saveResults(output, outputPath);
    console.log(`📁 Full results saved to: ${outputPath}`);

    const locations = processResults(output.results);
    fs.writeFileSync(locationsPath, JSON.stringify(locations, null, 2));
    console.log(`📍 Extracted ${locations.length} potential locations`);
    console.log(`📁 Locations saved to: ${locationsPath}`);

    if (output.stats.errors.length > 0) {
      console.log('\n⚠️  Errors encountered:');
      output.stats.errors.slice(0, 5).forEach((err, i) => {
        console.log(`   ${i + 1}. ${err}`);
      });
      if (output.stats.errors.length > 5) {
        console.log(`   ... and ${output.stats.errors.length - 5} more`);
      }
    }

    await confirm({ message: '\nPress enter to continue...', default: true });

  } catch (error) {
    console.error('\n❌ Scraping failed:', error instanceof Error ? error.message : 'Unknown error');
    await confirm({ message: '\nPress enter to continue...', default: true });
  }
}

export async function main() {
  let config: TikTokScraperInput = { ...DEFAULT_INPUT };
  
  const savedConfig = await loadConfiguration();
  if (savedConfig) {
    config = savedConfig;
  }

  let running = true;

  while (running) {
    clearScreen();
    printHeader();
    printConfigSummary(config);

    const action = await select({
      message: 'What would you like to do?',
      choices: [
        { name: '▶️  Run Scraper', value: 'run', description: 'Start scraping with current configuration' },
        { name: '📝 Configure Queries', value: 'queries', description: 'Add or edit search queries' },
        { name: '⚙️  Advanced Settings', value: 'advanced', description: 'Configure all scraper options' },
        { name: '💾 Save Configuration', value: 'save', description: 'Save current settings to a file' },
        { name: '📂 Load Configuration', value: 'load', description: 'Load settings from a file' },
        { name: '🔄 Reset to Defaults', value: 'reset', description: 'Reset all settings to default values' },
        { name: '❌ Exit', value: 'exit', description: 'Exit the application' }
      ]
    });

    switch (action) {
      case 'run':
        await runScraping(config);
        break;

      case 'queries':
        config.searchQueries = await configureQueries(config.searchQueries);
        break;

      case 'advanced':
        config = await configureAdvanced(config);
        break;

      case 'save':
        await saveConfiguration(config);
        await confirm({ message: 'Press enter to continue...', default: true });
        break;

      case 'load': {
        const loaded = await loadConfiguration();
        if (loaded) {
          config = loaded;
          console.log('\n✅ Configuration loaded successfully!');
          await confirm({ message: 'Press enter to continue...', default: true });
        }
        break;
      }

      case 'reset':
        const confirmReset = await confirm({
          message: 'Reset all settings to defaults?',
          default: false
        });
        if (confirmReset) {
          config = { ...DEFAULT_INPUT };
          console.log('\n✅ Configuration reset to defaults');
          await confirm({ message: 'Press enter to continue...', default: true });
        }
        break;

      case 'exit':
        running = false;
        clearScreen();
        console.log('\n👋 Goodbye!\n');
        break;
    }
  }
}

main().catch(console.error);