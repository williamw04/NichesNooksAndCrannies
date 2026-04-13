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
    const results = await extractor.extractLocations('Great coffee at Central Perk Cafe!');
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
    const results = await extractor.extractLocations('Blue Bottle is great');
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
    const results = await extractor.extractLocations('Stumptown coffee');
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
    const results = await extractor.extractLocations('AB and Real Place');
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
    const results = await extractor.extractLocations('No places here');
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
    const results = await extractor.extractLocations('Something');
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
    const results = await extractor.extractLocations('Mystery Place');
    assert.equal(results.length, 1);
    assert.equal(results[0].type, 'unknown');
  });
});

describe('AiExtractor — fallback chain', () => {
  let originalFetch: typeof globalThis.fetch;
  let fetchCalls: string[];

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    fetchCalls = [];
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('falls back to next model on empty results', async () => {
    let callCount = 0;
    globalThis.fetch = ((url: any, opts: any) => {
      fetchCalls.push(JSON.parse(opts.body).model);
      callCount++;
      if (callCount === 1) return Promise.resolve(MOCK_EMPTY_RESPONSE as any);
      return Promise.resolve(MOCK_RESPONSE as any);
    }) as any;

    const extractor = new AiExtractor('test-key');
    const results = await extractor.extractLocations('Central Perk Cafe');
    assert.equal(results.length, 1);
    assert.equal(results[0].name, 'Central Perk Cafe');
    assert.equal(fetchCalls.length, 2);
    assert.notEqual(fetchCalls[0], fetchCalls[1]);
  });

  it('falls back to next model on HTTP error', async () => {
    let callCount = 0;
    globalThis.fetch = ((url: any, opts: any) => {
      fetchCalls.push(JSON.parse(opts.body).model);
      callCount++;
      if (callCount === 1) return Promise.resolve(MOCK_ERROR_RESPONSE as any);
      return Promise.resolve(MOCK_RESPONSE as any);
    }) as any;

    const extractor = new AiExtractor('test-key');
    const results = await extractor.extractLocations('Central Perk Cafe');
    assert.equal(results.length, 1);
    assert.equal(fetchCalls.length, 2);
  });

  it('returns empty when all models fail', async () => {
    globalThis.fetch = () => Promise.resolve(MOCK_ERROR_RESPONSE as any);
    const extractor = new AiExtractor('test-key');
    const results = await extractor.extractLocations('test');
    assert.equal(results.length, 0);
  });

  it('returns empty when all models return empty arrays', async () => {
    globalThis.fetch = () => Promise.resolve(MOCK_EMPTY_RESPONSE as any);
    const extractor = new AiExtractor('test-key');
    const results = await extractor.extractLocations('test');
    assert.equal(results.length, 0);
  });

  it('uses preferred model first', async () => {
    const preferredModel = 'qwen/qwen3-32b:free';
    globalThis.fetch = ((url: any, opts: any) => {
      fetchCalls.push(JSON.parse(opts.body).model);
      return Promise.resolve(MOCK_RESPONSE as any);
    }) as any;

    const extractor = new AiExtractor('test-key', preferredModel);
    await extractor.extractLocations('test');
    assert.equal(fetchCalls[0], preferredModel);
  });

  it('does not call more models after success', async () => {
    globalThis.fetch = ((url: any, opts: any) => {
      fetchCalls.push(JSON.parse(opts.body).model);
      return Promise.resolve(MOCK_RESPONSE as any);
    }) as any;

    const extractor = new AiExtractor('test-key');
    await extractor.extractLocations('test');
    assert.equal(fetchCalls.length, 1);
  });
});
