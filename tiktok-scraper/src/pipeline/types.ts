import { BrowserContext } from 'playwright';
import { ScrapingResult, ScraperStats, TikTokScraperInput } from '../types.js';

export type PipelineMode = 'google' | 'tags' | 'hybrid';

export interface PipelineConfig {
  mode: PipelineMode;
  queries: string[];
  city?: string;
  resultsPerPage: number;
  maxItems: number;
  debug?: boolean;
  openRouterApiKey?: string;
  openRouterModel?: string;
}

export interface PipelineResult {
  results: ScrapingResult[];
  stats: ScraperStats;
}

export interface Pipeline {
  run(context: BrowserContext): Promise<PipelineResult>;
}

export function configFromInput(input: TikTokScraperInput): PipelineConfig {
  return {
    mode: 'google',
    queries: input.searchQueries,
    city: input.city,
    resultsPerPage: input.resultsPerPage,
    maxItems: input.maxItems,
    debug: input.debug,
    openRouterApiKey: input.openRouterApiKey,
    openRouterModel: input.openRouterModel,
  };
}

export function makeStats(): ScraperStats {
  return {
    totalVideos: 0,
    totalProfiles: 0,
    queriesProcessed: 0,
    errors: [],
    startTime: new Date().toISOString(),
  };
}

export function finalizeStats(stats: ScraperStats): void {
  stats.endTime = new Date().toISOString();
  stats.durationMs =
    new Date(stats.endTime).getTime() -
    new Date(stats.startTime).getTime();
}
