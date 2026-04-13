import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GoogleTikTokScraper } from '../../src/google-scraper.js';
import { DEFAULT_INPUT } from '../../src/types.js';

const s = new GoogleTikTokScraper({ ...DEFAULT_INPUT, searchQueries: ['test'] });
const any = s as any;

describe('parseNumber', () => {
  it('parses plain integer', () => {
    assert.equal(any.parseNumber('1234'), 1234);
  });

  it('parses K suffix', () => {
    assert.equal(any.parseNumber('57.3K'), 57300);
  });

  it('parses M suffix', () => {
    assert.equal(any.parseNumber('2.1M'), 2100000);
  });

  it('parses B suffix', () => {
    assert.equal(any.parseNumber('1.5B'), 1500000000);
  });

  it('parses lowercase k', () => {
    assert.equal(any.parseNumber('100k'), 100000);
  });

  it('parses K+ (plus sign from Google SERP)', () => {
    assert.equal(any.parseNumber('3.4K+'), 3400);
  });

  it('returns 0 for empty string', () => {
    assert.equal(any.parseNumber(''), 0);
  });

  it('strips non-numeric characters', () => {
    assert.equal(any.parseNumber('  1,234  '), 1234);
  });
});

describe('classifyTikTokUrl', () => {
  it('classifies video URLs with /video/', () => {
    assert.equal(any.classifyTikTokUrl('https://www.tiktok.com/@user/video/123456'), 'video');
  });

  it('classifies short URLs with /t/', () => {
    assert.equal(any.classifyTikTokUrl('https://www.tiktok.com/t/abc123'), 'video');
  });

  it('classifies /discover/ as search', () => {
    assert.equal(any.classifyTikTokUrl('https://www.tiktok.com/discover/coffee-shops'), 'search');
  });

  it('classifies /tag/ as search', () => {
    assert.equal(any.classifyTikTokUrl('https://www.tiktok.com/tag/nyc'), 'search');
  });

  it('classifies /category/ as search', () => {
    assert.equal(any.classifyTikTokUrl('https://www.tiktok.com/category/food'), 'search');
  });

  it('classifies /f/ as search', () => {
    assert.equal(any.classifyTikTokUrl('https://www.tiktok.com/f/xyz'), 'search');
  });

  it('classifies profile URL as unknown', () => {
    assert.equal(any.classifyTikTokUrl('https://www.tiktok.com/@user'), 'unknown');
  });

  it('classifies root URL as unknown', () => {
    assert.equal(any.classifyTikTokUrl('https://www.tiktok.com/'), 'unknown');
  });
});

describe('parseSerpLinkText', () => {
  it('extracts title before "TikTok"', () => {
    const result = any.parseSerpLinkText('Best Coffee Shops TikTok · 57.3K views · 6 months ago');
    assert.equal(result.title, 'Best Coffee Shops');
  });

  it('extracts view count with K suffix', () => {
    const result = any.parseSerpLinkText('Best Coffee Shops TikTok · 57.3K views · 6 months ago');
    assert.equal(result.viewCount, 57300);
  });

  it('does NOT treat "6 months ago" as creator', () => {
    const result = any.parseSerpLinkText('Best Coffee Shops TikTok · 57.3K views · 6 months ago');
    assert.equal(result.creator, '');
  });

  it('does NOT treat "10 months ago" as creator', () => {
    const result = any.parseSerpLinkText('Delicious Coffees TikTok · 207.8K views · 10 months ago');
    assert.equal(result.creator, '');
  });

  it('extracts 207.8K views correctly', () => {
    const result = any.parseSerpLinkText('Delicious Coffees TikTok · 207.8K views · 10 months ago');
    assert.equal(result.viewCount, 207800);
  });

  it('rejects 2025 as year (2000-2100 range)', () => {
    const result = any.parseSerpLinkText('Something TikTok · 2025 views · Jan 1');
    assert.equal(result.viewCount, 0);
  });

  it('rejects 2000-2100 range from global view match', () => {
    const result = any.parseSerpLinkText('2025 views');
    assert.equal(result.viewCount, 0);
  });

  it('accepts 57300 (outside year range)', () => {
    const result = any.parseSerpLinkText('Best Coffee TikTok · 57300 views');
    assert.equal(result.viewCount, 57300);
  });

  it('strips duration prefix from title', () => {
    const result = any.parseSerpLinkText('1:01This is the best coffee shop');
    assert.ok(!result.title.startsWith('1:01'));
    assert.ok(result.title.includes('best coffee'));
  });

  it('extracts view count from text without "TikTok" separator (global fallback)', () => {
    const result = any.parseSerpLinkText('0:40Author-approved NYC coffee shops 3.4K+ views · Feb');
    assert.equal(result.viewCount, 3400);
  });

  it('skips "Jan 1" date pattern as creator', () => {
    const result = any.parseSerpLinkText('Something TikTok · 500 views · Jan 1');
    assert.equal(result.creator, '');
  });

  it('returns empty for empty input', () => {
    const result = any.parseSerpLinkText('');
    assert.equal(result.title, '');
    assert.equal(result.creator, '');
    assert.equal(result.viewCount, 0);
  });

  it('extracts creator when present before date', () => {
    const result = any.parseSerpLinkText('Best Shops TikTok · @coffeequeen · 5K views · 2 days ago');
    assert.equal(result.creator, '@coffeequeen');
  });
});

describe('parseVtt', () => {
  it('extracts text lines from valid VTT', () => {
    const vtt = 'WEBVTT\n\n1\n00:00:01.000 --> 00:00:03.000\nHello world\n';
    assert.equal(any.parseVtt(vtt), 'Hello world');
  });

  it('joins multiple text lines', () => {
    const vtt = 'WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nFirst line\n00:00:02.000 --> 00:00:03.000\nSecond line\n';
    assert.equal(any.parseVtt(vtt), 'First line Second line');
  });

  it('strips index numbers', () => {
    const vtt = 'WEBVTT\n\n1\n00:00:01.000 --> 00:00:03.000\nText\n';
    assert.equal(any.parseVtt(vtt), 'Text');
  });

  it('returns empty for WEBVTT-only input', () => {
    assert.equal(any.parseVtt('WEBVTT'), '');
  });

  it('handles empty input', () => {
    assert.equal(any.parseVtt(''), '');
  });
});

describe('extractHashtags', () => {
  it('extracts hashtags from text', () => {
    assert.deepEqual(any.extractHashtags('Love this #coffee #nyc'), ['coffee', 'nyc']);
  });

  it('returns empty for no hashtags', () => {
    assert.deepEqual(any.extractHashtags('No hashtags here'), []);
  });
});

describe('extractMentions', () => {
  it('extracts mentions from text', () => {
    assert.deepEqual(any.extractMentions('Check out @user1 and @user2'), ['user1', 'user2']);
  });

  it('returns empty for no mentions', () => {
    assert.deepEqual(any.extractMentions('No mentions'), []);
  });
});
