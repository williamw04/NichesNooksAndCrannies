import { BrowserContext } from 'playwright';
import { Pipeline, PipelineConfig, PipelineResult } from './types.js';
import { GooglePipeline } from './google-pipeline.js';
import { TagPipeline } from './tag-pipeline.js';
import { HybridPipeline } from './hybrid-pipeline.js';

export function createPipeline(config: PipelineConfig): Pipeline {
  switch (config.mode) {
    case 'google':
      return new GooglePipeline(config);
    case 'tags':
      return new TagPipeline(config);
    case 'hybrid':
      return new HybridPipeline(config);
    default:
      throw new Error(`Unknown pipeline mode: ${config.mode}`);
  }
}

export { GooglePipeline } from './google-pipeline.js';
export { TagPipeline } from './tag-pipeline.js';
export { HybridPipeline } from './hybrid-pipeline.js';
export type { Pipeline, PipelineConfig, PipelineResult, PipelineMode } from './types.js';
