import { select, confirm } from '@inquirer/prompts';
import { TikTokScraperInput, DEFAULT_INPUT } from '../types.js';
import { PipelineMode } from '../pipeline/types.js';
import { clearScreen, printHeader, printConfigSummary } from './display.js';
import { 
  configureQueries, 
  configureAdvanced, 
  saveConfiguration, 
  loadConfiguration,
  selectMode,
  confirmReset,
  confirmContinue 
} from './prompts.js';
import { runScraping, syncToSupabase, exportLocationsCsv } from './executor.js';

export async function main(): Promise<void> {
  let config: TikTokScraperInput & { mode?: PipelineMode } = { ...DEFAULT_INPUT };
  
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
        { name: '🔀 Change Mode', value: 'mode', description: `Switch discovery mode (current: ${config.mode || 'google'})` },
        { name: '📝 Configure Queries', value: 'queries', description: 'Add or edit search queries' },
        { name: '⚙️  Advanced Settings', value: 'advanced', description: 'Configure all scraper options' },
        { name: '💾 Save Configuration', value: 'save', description: 'Save current settings to a file' },
        { name: '📂 Load Configuration', value: 'load', description: 'Load settings from a file' },
        { name: '☁️  Sync to Supabase', value: 'sync', description: 'Push local database to Supabase' },
        { name: '📊 Export CSV', value: 'csv', description: 'Export locations to CSV file' },
        { name: '🔄 Reset to Defaults', value: 'reset', description: 'Reset all settings to default values' },
        { name: '❌ Exit', value: 'exit', description: 'Exit the application' }
      ]
    });

    switch (action) {
      case 'run':
        await runScraping(config);
        break;

      case 'mode':
        config.mode = await selectMode(config.mode) as PipelineMode;
        break;

      case 'queries':
        config.searchQueries = await configureQueries(config.searchQueries);
        break;

      case 'advanced':
        config = await configureAdvanced(config);
        break;

      case 'save':
        await saveConfiguration(config);
        await confirmContinue();
        break;

      case 'load': {
        const loaded = await loadConfiguration();
        if (loaded) {
          config = loaded;
          console.log('\n✅ Configuration loaded successfully!');
          await confirmContinue();
        }
        break;
      }

      case 'sync':
        await syncToSupabase();
        break;

      case 'csv':
        await exportLocationsCsv();
        break;

      case 'reset':
        if (await confirmReset()) {
          config = { ...DEFAULT_INPUT };
          console.log('\n✅ Configuration reset to defaults');
          await confirmContinue();
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