import { TikTokVideo, SocialProof, ScrapingResult, DEFAULT_CATEGORY_KEYWORDS } from './types.js';
import { AiExtractor } from './ai-extractor.js';

export interface LocationExtraction {
  name: string;
  description: string;
  category: string;
  source: 'tiktok_video' | 'ai_extraction';
  sourceUrl: string;
  sourceVideoCount: number;
  hashtags: string[];
  mentions: string[];
  author: string;
  authorFollowers: number;
  socialProof: SocialProof;
  locationTag?: string;
  locationUrl?: string;
  music?: string;
  extractionMethod: 'poi_tag' | 'ai_extraction';
}

export interface ProcessResultsConfig {
  aiExtractor?: AiExtractor;
  categoryKeywords?: Record<string, string[]>;
  minEngagement?: number;
}

// Generic location names to skip — neighborhoods, boroughs, cities, areas
// These are not specific business/venue names
const GENERIC_LOCATIONS = [
  // Boroughs
  'manhattan', 'brooklyn', 'queens', 'bronx', 'staten island',
  // Cities
  'new york', 'nyc', 'new york city',
  // Common NYC neighborhoods
  'east village', 'west village', 'greenwich village', 'soho', 'tribeca', 
  'lower east side', 'upper east side', 'upper west side', 'midtown',
  'chelsea', 'harlem', 'williamsburg', 'dumbo', 'bushwick', 'astoria',
  'financial district', 'flatiron', 'nomad', 'hell\'s kitchen', 'hells kitchen',
  'little Italy', 'chinatown', 'koreatown', 'murray hill', 'gramercy',
  'park slope', 'carroll gardens', 'cobble hill', 'brooklyn heights',
  'long island city', 'ridgewood', 'greenpoint', 'bedford stuyvesant',
  // Generic area names
  'downtown', 'uptown', 'midtown east', 'midtown west',
];

export function buildSocialProof(video: TikTokVideo): SocialProof {
  const likes = video.diggCount || 0;
  const comments = video.commentCount || 0;
  const shares = video.shareCount || 0;
  const collects = video.collectCount || 0;
  const playCount = video.playCount || 0;

  return {
    likes,
    comments,
    shares,
    collects,
    playCount,
    totalEngagement: likes + comments + shares + collects,
  };
}

export function inferCategoryFromQuery(
  query: string,
  categoryKeywords?: Record<string, string[]>,
): string {
  const keywords = categoryKeywords || DEFAULT_CATEGORY_KEYWORDS;
  const queryLower = query.toLowerCase();

  for (const [category, words] of Object.entries(keywords)) {
    if (words.some((keyword) => queryLower.includes(keyword))) {
      return category;
    }
  }

  return 'local';
}

function cleanLocationName(name: string): string {
  // TikTok POI tags sometimes append extra data after a middle dot (·), e.g. "Cafe · New York"
  return name
    .replace(/\s*·\s*.*$/, '')
    .trim();
}

function normalizeLocationName(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
}

function isGenericLocation(name: string): boolean {
  const normalized = normalizeLocationName(name);
  return GENERIC_LOCATIONS.some(generic => 
    normalizeLocationName(generic) === normalized
  );
}

function hasUsableContent(video: TikTokVideo): boolean {
  const hasDescription = video.description && video.description.trim().length > 0;
  const hasSubtitles = video.subtitles && video.subtitles.trim().length > 0;
  const hasPoiTag = video.locationTag && video.locationTag.trim().length > 0;
  
  // Rule: skip if no description AND no subtitles AND no POI tag
  return Boolean(hasDescription || hasSubtitles || hasPoiTag);
}

function aggregateSocialProof(proofs: SocialProof[]): SocialProof {
  return {
    likes: proofs.reduce((sum, p) => sum + p.likes, 0),
    comments: proofs.reduce((sum, p) => sum + p.comments, 0),
    shares: proofs.reduce((sum, p) => sum + p.shares, 0),
    collects: proofs.reduce((sum, p) => sum + p.collects, 0),
    playCount: proofs.reduce((sum, p) => sum + p.playCount, 0),
    totalEngagement: proofs.reduce((sum, p) => sum + p.totalEngagement, 0),
  };
}

function deduplicateAndAggregate(
  locations: LocationExtraction[],
): LocationExtraction[] {
  const groups = new Map<
    string,
    { locations: LocationExtraction[]; proofs: SocialProof[] }
  >();

  for (const loc of locations) {
    const key = normalizeLocationName(loc.name);
    const existing = groups.get(key);

    if (existing) {
      existing.locations.push(loc);
      existing.proofs.push(loc.socialProof);
    } else {
      groups.set(key, { locations: [loc], proofs: [loc.socialProof] });
    }
  }

  const results: LocationExtraction[] = [];

  for (const [, group] of groups) {
    const sorted = group.locations.sort(
      (a, b) => b.socialProof.totalEngagement - a.socialProof.totalEngagement,
    );

    const best = sorted[0];
    const aggregated = aggregateSocialProof(group.proofs);

    results.push({
      ...best,
      socialProof: aggregated,
      sourceVideoCount: group.locations.length,
    });
  }

  return results.sort(
    (a, b) => b.socialProof.totalEngagement - a.socialProof.totalEngagement,
  );
}

export async function processResults(
  results: ScrapingResult[],
  config?: ProcessResultsConfig,
): Promise<LocationExtraction[]> {
  const allLocations: LocationExtraction[] = [];

  for (const result of results) {
    // Category is inferred from the search query, not the video content.
    // A video found via "best coffee spots" gets category "cafe" regardless of its actual content.
    const category = inferCategoryFromQuery(
      result.query,
      config?.categoryKeywords,
    );

    for (const video of result.videos) {
      // Rule: skip video if no description AND no subtitles AND no POI tag
      if (!hasUsableContent(video)) {
        continue;
      }

      // AI extraction: primary method when description or subtitles available
      if (config?.aiExtractor && (video.description || video.subtitles)) {
        try {
          const aiLocations = await config.aiExtractor.extractLocations(
            result.query,
            video.description,
            video.subtitles || undefined,
          );

          for (const loc of aiLocations) {
            allLocations.push({
              name: loc.name,
              description: video.description,
              category: loc.type || category,
              source: 'ai_extraction',
              sourceUrl: video.url,
              sourceVideoCount: 1,
              hashtags: video.hashtags,
              mentions: video.mentions,
              author: video.author.uniqueId,
              authorFollowers: video.author.followers,
              socialProof: buildSocialProof(video),
              music: video.musicTitle
                ? `${video.musicTitle} - ${video.musicAuthor}`
                : undefined,
              extractionMethod: 'ai_extraction',
            });
          }
        } catch (e) {
          console.log(
            `  AI extraction failed for video ${video.id}: ${e instanceof Error ? e.message : 'Unknown error'}`,
          );
        }

        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      // POI tag extraction: secondary method
      // Rule: skip if POI tag is generic (neighborhood, city, borough)
      if (video.locationTag && video.locationTag.trim()) {
        const cleanedName = cleanLocationName(video.locationTag);
        if (cleanedName.length >= 3 && !isGenericLocation(cleanedName)) {
          allLocations.push({
            name: cleanedName,
            description: video.description,
            category,
            source: 'tiktok_video',
            sourceUrl: video.url,
            sourceVideoCount: 1,
            hashtags: video.hashtags,
            mentions: video.mentions,
            author: video.author.uniqueId,
            authorFollowers: video.author.followers,
            socialProof: buildSocialProof(video),
            locationTag: video.locationTag,
            locationUrl: video.locationUrl,
            music: video.musicTitle
              ? `${video.musicTitle} - ${video.musicAuthor}`
              : undefined,
            extractionMethod: 'poi_tag',
          });
        }
      }
    }
  }

  const deduped = deduplicateAndAggregate(allLocations);

  const minEngagement = config?.minEngagement || 0;
  if (minEngagement > 0) {
    return deduped.filter(
      (loc) => loc.socialProof.totalEngagement >= minEngagement,
    );
  }

  return deduped;
}
