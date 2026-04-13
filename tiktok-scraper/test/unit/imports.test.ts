import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  runScraper,
  saveResults,
  processResults,
  GoogleTikTokScraper,
  AiExtractor,
  LocationExtraction,
  ProcessResultsConfig,
  SocialProof,
  TikTokScraperInput,
  DEFAULT_INPUT,
} from '../../src/index.js';

describe('Public API surface', () => {
  it('exports runScraper as a function', () => {
    assert.equal(typeof runScraper, 'function');
  });

  it('exports saveResults as a function', () => {
    assert.equal(typeof saveResults, 'function');
  });

  it('exports processResults as a function', () => {
    assert.equal(typeof processResults, 'function');
  });

  it('exports GoogleTikTokScraper as a class', () => {
    assert.equal(typeof GoogleTikTokScraper, 'function');
  });

  it('exports AiExtractor as a class', () => {
    assert.equal(typeof AiExtractor, 'function');
  });

  it('LocationExtraction interface is compilable with all fields', () => {
    const location: LocationExtraction = {
      name: 'Test Location',
      description: 'A test',
      category: 'cafe',
      source: 'tiktok_video',
      sourceUrl: 'https://tiktok.com/@user/video/123',
      sourceVideoCount: 1,
      hashtags: [],
      mentions: [],
      author: 'user',
      authorFollowers: 100,
      socialProof: { likes: 10, comments: 1, shares: 0, collects: 0, playCount: 500, totalEngagement: 11 },
      extractionMethod: 'poi_tag',
    };
    assert.equal(location.name, 'Test Location');
  });

  it('ProcessResultsConfig interface is compilable', () => {
    const config: ProcessResultsConfig = { minEngagement: 100 };
    assert.equal(config.minEngagement, 100);
  });

  it('SocialProof interface is compilable', () => {
    const proof: SocialProof = {
      likes: 100, comments: 10, shares: 5, collects: 2, playCount: 1000, totalEngagement: 117,
    };
    assert.equal(proof.totalEngagement, 117);
  });

  it('DEFAULT_INPUT has expected values', () => {
    const input: TikTokScraperInput = { ...DEFAULT_INPUT, searchQueries: ['test'] };
    assert.equal(input.resultsPerPage, 5);
    assert.equal(input.maxItems, 55);
    assert.equal(input.searchQueries[0], 'test');
  });
});
