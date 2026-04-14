import {
  input,
  select,
  confirm,
  number,
  checkbox,
} from '@inquirer/prompts';
import * as fs from 'fs';
import * as path from 'path';
import { TikTokScraperInput, DEFAULT_INPUT } from '../types.js';
import { clearScreen, printHeader } from './display.js';

const PRESET_QUERIES = [
  'best cafe spots',
  'best restaurant spots',
  'best nature spots',
  'best museum spots',
  'best shopping spots',
  'best nightlife spots',
  'hidden gems',
  'underrated places',
  'secret spots',
  'locals only spots',
  'must visit places',
  'best views spots',
  'best date spots',
  'foodie spots',
  'instagrammable spots',
];

export async function configureQueries(current: string[]): Promise<string[]> {
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

export async function configureAdvanced(current: TikTokScraperInput): Promise<TikTokScraperInput> {
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

export async function saveConfiguration(config: TikTokScraperInput): Promise<void> {
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

export async function loadConfiguration(): Promise<TikTokScraperInput | null> {
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

export async function selectMode(currentMode?: string): Promise<string> {
  return await select({
    message: 'Select discovery mode:',
    choices: [
      { name: 'Google SERP', value: 'google', description: 'Search Google for TikTok URLs. Most reliable, but may hit captchas.' },
      { name: 'Tags Only', value: 'tags', description: 'Generate hashtags and scrape tag pages directly. No Google, no captchas.' },
      { name: 'Hybrid', value: 'hybrid', description: 'Google SERP + AI tag generation combined. Maximum coverage.' },
    ]
  });
}

export async function confirmReset(): Promise<boolean> {
  return await confirm({
    message: 'Reset all settings to defaults?',
    default: false
  });
}

export async function confirmContinue(): Promise<boolean> {
  return await confirm({ message: '\nPress enter to continue...', default: true });
}

export { PRESET_QUERIES };