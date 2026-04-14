import { TikTokScraperInput } from '../types.js';
import { PipelineMode } from '../pipeline/types.js';

export function clearScreen(): void {
  console.clear();
}

export function printHeader(): void {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                    TikTok Scraper v2.0                       ║
║              Location Discovery via Social Proof              ║
╚══════════════════════════════════════════════════════════════╝
`);
}

export function printConfigSummary(config: Partial<TikTokScraperInput> & { mode?: PipelineMode }): void {
  const hasAiKey = !!(config.openRouterApiKey || process.env.OPENROUTER_API_KEY);
  const modeDisplay = config.mode || 'google';
  console.log('\n┌─────────────────────────────────────────────────────────────┐');
  console.log('│                    Current Configuration                    │');
  console.log('├─────────────────────────────────────────────────────────────┤');
  console.log(`│ Mode: ${modeDisplay.padEnd(56)}│`);
  console.log(`│ Search Queries: ${(config.searchQueries?.length || 0).toString().padEnd(46)}│`);
  console.log(`│ City: ${(config.city || 'Not set').padEnd(54)}│`);
  console.log(`│ Results Per Page: ${(config.resultsPerPage?.toString() || '5').padEnd(44)}│`);
  console.log(`│ Max Items: ${(config.maxItems?.toString() || '55').padEnd(50)}│`);
  console.log(`│ Search Sorting: ${(config.searchSorting === '0' ? 'Relevance' : config.searchSorting === '1' ? 'Most Recent' : 'Most Viewed').padEnd(43)}│`);
  console.log(`│ AI Extraction: ${(hasAiKey ? 'Enabled' : 'Disabled').padEnd(44)}│`);
  console.log(`│ Min Engagement: ${(config.minEngagement?.toString() || '0').padEnd(45)}│`);
  console.log(`│ Proxy: ${(config.proxyCountryCode || 'None').padEnd(53)}│`);
  console.log('└─────────────────────────────────────────────────────────────┘\n');
}

export function printScrapingStats(stats: import('../types.js').ScraperStats): void {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║                    Scraping Complete                         ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log(`║ Total Videos: ${stats.totalVideos.toString().padEnd(47)}║`);
  console.log(`║ Total Profiles: ${stats.totalProfiles.toString().padEnd(45)}║`);
  console.log(`║ Queries Processed: ${stats.queriesProcessed.toString().padEnd(41)}║`);
  console.log(`║ Errors: ${stats.errors.length.toString().padEnd(52)}║`);
  console.log(`║ Duration: ${(stats.durationMs ? Math.round(stats.durationMs / 1000) : 0).toString()}s`.padEnd(63) + '║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
}