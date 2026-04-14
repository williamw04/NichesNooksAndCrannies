import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { AiExtractor } from '../../src/ai-extractor.js';

const MOCK_RESPONSE = {
  ok: true,
  json: () => Promise.resolve({
    choices: [{ message: { content: '[{"name":"Central Perk Cafe","type":"cafe"}]' } }],
  }),
};

const MOCK_EMPTY_RESPONSE = {
  ok: true,
  json: () => Promise.resolve({
    choices: [{ message: { content: '[]' } }],
  }),
};

const MOCK_ERROR_RESPONSE = {
  ok: false,
  status: 429,
  text: () => Promise.resolve('Rate limited'),
};

describe('AiExtractor — parseResponse (via extractLocations)', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('extracts locations from clean JSON response', async () => {
    globalThis.fetch = () => Promise.resolve(MOCK_RESPONSE as any);
    const extractor = new AiExtractor('test-key');
    const results = await extractor.extractLocations('best coffee shops nyc', 'Great coffee at Central Perk Cafe!');
    assert.equal(results.length, 1);
    assert.equal(results[0].name, 'Central Perk Cafe');
    assert.equal(results[0].type, 'cafe');
  });

  it('extracts JSON from markdown code fences', async () => {
    globalThis.fetch = () => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        choices: [{ message: { content: '```json\n[{"name":"Blue Bottle","type":"cafe"}]\n```' } }],
      }),
    } as any);
    const extractor = new AiExtractor('test-key');
    const results = await extractor.extractLocations('best coffee nyc', 'Blue Bottle is great');
    assert.equal(results.length, 1);
    assert.equal(results[0].name, 'Blue Bottle');
  });

  it('extracts JSON from response with explanatory text', async () => {
    globalThis.fetch = () => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        choices: [{ message: { content: 'Here are the locations:\n[{"name":"Stumptown","type":"cafe"}]\nHope that helps!' } }],
      }),
    } as any);
    const extractor = new AiExtractor('test-key');
    const results = await extractor.extractLocations('coffee spots', 'Stumptown coffee');
    assert.equal(results.length, 1);
    assert.equal(results[0].name, 'Stumptown');
  });

  it('filters out locations with names shorter than 3 characters', async () => {
    globalThis.fetch = () => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        choices: [{ message: { content: '[{"name":"AB","type":"cafe"},{"name":"Real Place","type":"restaurant"}]' } }],
      }),
    } as any);
    const extractor = new AiExtractor('test-key');
    const results = await extractor.extractLocations('food', 'AB and Real Place');
    assert.equal(results.length, 1);
    assert.equal(results[0].name, 'Real Place');
  });

  it('returns empty array when no JSON array found in response', async () => {
    globalThis.fetch = () => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        choices: [{ message: { content: 'No locations found in this text.' } }],
      }),
    } as any);
    const extractor = new AiExtractor('test-key');
    const results = await extractor.extractLocations('test', 'No places here');
    assert.equal(results.length, 0);
  });

  it('returns empty array for malformed JSON', async () => {
    globalThis.fetch = () => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        choices: [{ message: { content: '[{broken json}' } }],
      }),
    } as any);
    const extractor = new AiExtractor('test-key');
    const results = await extractor.extractLocations('test', 'Something');
    assert.equal(results.length, 0);
  });

  it('defaults type to "unknown" when missing', async () => {
    globalThis.fetch = () => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        choices: [{ message: { content: '[{"name":"Mystery Place"}]' } }],
      }),
    } as any);
    const extractor = new AiExtractor('test-key');
    const results = await extractor.extractLocations('test', 'Mystery Place');
    assert.equal(results.length, 1);
    assert.equal(results[0].type, 'unknown');
  });
});

describe('AiExtractor — single model (Qwen)', () => {
  let originalFetch: typeof globalThis.fetch;
  let fetchCalls: string[];

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    fetchCalls = [];
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('returns empty on HTTP error', async () => {
    globalThis.fetch = () => Promise.resolve(MOCK_ERROR_RESPONSE as any);
    const extractor = new AiExtractor('test-key');
    const results = await extractor.extractLocations('test', 'Central Perk Cafe');
    assert.equal(results.length, 0);
  });

  it('returns empty on empty results', async () => {
    globalThis.fetch = () => Promise.resolve(MOCK_EMPTY_RESPONSE as any);
    const extractor = new AiExtractor('test-key');
    const results = await extractor.extractLocations('test', 'test');
    assert.equal(results.length, 0);
  });

  it('uses provided model', async () => {
    const customModel = 'qwen-max';
    globalThis.fetch = ((_url: any, opts: any) => {
      fetchCalls.push(JSON.parse(opts.body).model);
      return Promise.resolve(MOCK_RESPONSE as any);
    }) as any;

    const extractor = new AiExtractor('test-key', { model: customModel });
    await extractor.extractLocations('test', 'test');
    assert.equal(fetchCalls[0], customModel);
  });

  it('calls model only once on success', async () => {
    globalThis.fetch = ((_url: any, opts: any) => {
      fetchCalls.push(JSON.parse(opts.body).model);
      return Promise.resolve(MOCK_RESPONSE as any);
    }) as any;

    const extractor = new AiExtractor('test-key');
    await extractor.extractLocations('test', 'test');
    assert.equal(fetchCalls.length, 1);
  });
});
