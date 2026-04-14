import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  processResults,
  buildSocialProof,
  inferCategoryFromQuery,
  LocationExtraction,
  ProcessResultsConfig,
} from '../../src/processor.js';
import { TikTokVideo, ScrapingResult, DEFAULT_INPUT } from '../../src/types.js';

function makeVideo(overrides: Partial<TikTokVideo> = {}): TikTokVideo {
  return {
    id: '1',
    url: 'https://tiktok.com/@user/video/1',
    description: 'Test video',
    author: {
      id: '1', uniqueId: 'testuser', nickname: 'Test User', avatarUrl: '',
      signature: '', verified: false, followers: 100, following: 10,
      hearts: 500, videoCount: 20,
    },
    createTime: 0,
    playCount: 1000,
    shareCount: 5,
    commentCount: 10,
    diggCount: 100,
    collectCount: 2,
    videoUrl: '',
    coverUrl: '',
    dynamicCoverUrl: '',
    duration: 0,
    width: 0,
    height: 0,
    hashtags: [],
    mentions: [],
    isAd: false,
    isPinned: false,
    ...overrides,
  };
}

describe('buildSocialProof', () => {
  it('computes totalEngagement as likes + comments + shares + collects', () => {
    const video = makeVideo({ diggCount: 100, commentCount: 10, shareCount: 5, collectCount: 2, playCount: 1000 });
    const proof = buildSocialProof(video);
    assert.equal(proof.totalEngagement, 117);
    assert.equal(proof.likes, 100);
    assert.equal(proof.comments, 10);
    assert.equal(proof.shares, 5);
    assert.equal(proof.collects, 2);
    assert.equal(proof.playCount, 1000);
  });

  it('handles zero engagement', () => {
    const video = makeVideo({ diggCount: 0, commentCount: 0, shareCount: 0, collectCount: 0, playCount: 0 });
    const proof = buildSocialProof(video);
    assert.equal(proof.totalEngagement, 0);
  });
});

describe('inferCategoryFromQuery', () => {
  it('matches cafe keywords', () => {
    assert.equal(inferCategoryFromQuery('best coffee shops nyc'), 'cafe');
  });

  it('matches restaurant keywords', () => {
    assert.equal(inferCategoryFromQuery('best food spots'), 'restaurant');
  });

  it('matches nature keywords', () => {
    assert.equal(inferCategoryFromQuery('hiking trails'), 'nature');
  });

  it('matches nightlife keywords', () => {
    assert.equal(inferCategoryFromQuery('best bars and clubs'), 'nightlife');
  });

  it('matches local/hidden gem keywords', () => {
    assert.equal(inferCategoryFromQuery('hidden gems'), 'local');
  });

  it('returns "local" for unmatched queries', () => {
    assert.equal(inferCategoryFromQuery('random stuff'), 'local');
  });

  it('uses custom keywords when provided', () => {
    const custom = { pet: ['dog', 'cat', 'pet'] };
    assert.equal(inferCategoryFromQuery('best dog parks', custom), 'pet');
  });

  it('is case-insensitive', () => {
    assert.equal(inferCategoryFromQuery('BEST COFFEE'), 'cafe');
  });
});

describe('processResults — POI tag extraction', () => {
  it('extracts locations from locationTag', async () => {
    const results: ScrapingResult[] = [{
      query: 'best coffee nyc',
      videos: [makeVideo({ locationTag: 'Blue Bottle Coffee' })],
      profiles: [],
      timestamp: new Date().toISOString(),
    }];

    const locations = await processResults(results);
    assert.equal(locations.length, 1);
    assert.equal(locations[0].name, 'Blue Bottle Coffee');
    assert.equal(locations[0].extractionMethod, 'poi_tag');
    assert.equal(locations[0].source, 'tiktok_video');
  });

  it('strips "·" suffix from POI tag names', async () => {
    const results: ScrapingResult[] = [{
      query: 'best coffee nyc',
      videos: [makeVideo({ locationTag: 'citizenM New York Bowery · New York' })],
      profiles: [],
      timestamp: new Date().toISOString(),
    }];

    const locations = await processResults(results);
    assert.equal(locations[0].name, 'citizenM New York Bowery');
  });

  it('skips POI tags shorter than 3 characters', async () => {
    const results: ScrapingResult[] = [{
      query: 'best coffee nyc',
      videos: [makeVideo({ locationTag: 'NY' })],
      profiles: [],
      timestamp: new Date().toISOString(),
    }];

    const locations = await processResults(results);
    assert.equal(locations.length, 0);
  });

  it('infers category from query, not video content', async () => {
    const results: ScrapingResult[] = [{
      query: 'best coffee shops',
      videos: [makeVideo({ locationTag: 'Central Park', description: 'Great hiking trail!' })],
      profiles: [],
      timestamp: new Date().toISOString(),
    }];

    const locations = await processResults(results);
    assert.equal(locations[0].category, 'cafe');
  });
});

describe('processResults — deduplication and aggregation', () => {
  it('deduplicates locations by normalized name', async () => {
    const results: ScrapingResult[] = [{
      query: 'coffee',
      videos: [
        makeVideo({ locationTag: 'Blue Bottle Coffee', diggCount: 5000 }),
        makeVideo({ locationTag: 'blue bottle coffee', diggCount: 3000, url: 'https://tiktok.com/@user/video/2', id: '2' }),
      ],
      profiles: [],
      timestamp: new Date().toISOString(),
    }];

    const locations = await processResults(results);
    assert.equal(locations.length, 1);
    assert.equal(locations[0].name, 'Blue Bottle Coffee');
  });

  it('sums social proof across duplicates', async () => {
    const results: ScrapingResult[] = [{
      query: 'coffee',
      videos: [
        makeVideo({ locationTag: 'Blue Bottle Coffee', diggCount: 5000, commentCount: 100, shareCount: 50, collectCount: 10 }),
        makeVideo({ locationTag: 'Blue Bottle Coffee', diggCount: 3000, commentCount: 50, shareCount: 25, collectCount: 5, url: 'https://tiktok.com/@user/video/2', id: '2' }),
      ],
      profiles: [],
      timestamp: new Date().toISOString(),
    }];

    const locations = await processResults(results);
    assert.equal(locations[0].socialProof.likes, 8000);
    assert.equal(locations[0].socialProof.comments, 150);
    assert.equal(locations[0].sourceVideoCount, 2);
  });

  it('keeps highest-engagement instance as canonical', async () => {
    const results: ScrapingResult[] = [{
      query: 'coffee',
      videos: [
        makeVideo({ locationTag: 'Blue Bottle Coffee', diggCount: 100, description: 'Low engagement' }),
        makeVideo({ locationTag: 'Blue Bottle Coffee', diggCount: 9000, description: 'High engagement', url: 'https://tiktok.com/@user/video/2', id: '2' }),
      ],
      profiles: [],
      timestamp: new Date().toISOString(),
    }];

    const locations = await processResults(results);
    assert.equal(locations[0].description, 'High engagement');
  });

  it('sorts by total engagement descending', async () => {
    const results: ScrapingResult[] = [{
      query: 'coffee',
      videos: [
        makeVideo({ locationTag: 'Low Engagement Cafe', diggCount: 10 }),
        makeVideo({ locationTag: 'High Engagement Cafe', diggCount: 10000, url: 'https://tiktok.com/@user/video/2', id: '2' }),
      ],
      profiles: [],
      timestamp: new Date().toISOString(),
    }];

    const locations = await processResults(results);
    assert.equal(locations[0].name, 'High Engagement Cafe');
    assert.equal(locations[1].name, 'Low Engagement Cafe');
  });
});

describe('processResults — minEngagement filter', () => {
  it('filters out locations below threshold', async () => {
    const results: ScrapingResult[] = [{
      query: 'coffee',
      videos: [
        makeVideo({ locationTag: 'Popular Cafe', diggCount: 5000 }),
        makeVideo({ locationTag: 'Unpopular Cafe', diggCount: 1, url: 'https://tiktok.com/@user/video/2', id: '2' }),
      ],
      profiles: [],
      timestamp: new Date().toISOString(),
    }];

    const locations = await processResults(results, { minEngagement: 100 });
    assert.equal(locations.length, 1);
    assert.equal(locations[0].name, 'Popular Cafe');
  });

  it('returns all locations when minEngagement is 0', async () => {
    const results: ScrapingResult[] = [{
      query: 'coffee',
      videos: [
        makeVideo({ locationTag: 'Cafe A', diggCount: 1 }),
        makeVideo({ locationTag: 'Cafe B', diggCount: 9999, url: 'https://tiktok.com/@user/video/2', id: '2' }),
      ],
      profiles: [],
      timestamp: new Date().toISOString(),
    }];

    const locations = await processResults(results, { minEngagement: 0 });
    assert.equal(locations.length, 2);
  });
});

describe('processResults — empty input', () => {
  it('returns empty for no results', async () => {
    const locations = await processResults([]);
    assert.deepEqual(locations, []);
  });

  it('returns empty when no videos have location tags and no AI extractor', async () => {
    const results: ScrapingResult[] = [{
      query: 'coffee',
      videos: [makeVideo({ description: 'No location here' })],
      profiles: [],
      timestamp: new Date().toISOString(),
    }];

    const locations = await processResults(results);
    assert.equal(locations.length, 0);
  });
});
