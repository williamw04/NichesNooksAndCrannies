import { TikTokVideo, TikTokProfile, ScrapingResult } from './types.js';

export interface LocationExtraction {
  name: string;
  description: string;
  category: string;
  source: 'tiktok_video' | 'tiktok_profile';
  sourceUrl: string;
  hashtags: string[];
  mentions: string[];
  author: string;
  authorFollowers: number;
  playCount: number;
  locationTag?: string;
  music?: string;
}

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  cafe: ['cafe', 'coffee', 'espresso', 'latte', 'cappuccino', 'bakery', 'brunch'],
  restaurant: ['restaurant', 'food', 'dining', 'eat', 'dinner', 'lunch', 'taste', 'delicious', 'yummy'],
  nature: ['nature', 'park', 'hiking', 'trail', 'beach', 'river', 'lake', 'garden', 'outdoor'],
  historical: ['historical', 'history', 'museum', 'landmark', 'monument', 'heritage', 'old'],
  museum: ['museum', 'gallery', 'exhibition', 'art', 'artifact'],
  shopping: ['shopping', 'store', 'market', 'boutique', 'mall', 'shop'],
  adventure: ['adventure', 'explore', 'thrill', 'exciting', 'activity', 'experience'],
  relaxation: ['relax', 'spa', 'wellness', 'calm', 'peaceful', 'serene', 'quiet'],
  nightlife: ['nightlife', 'bar', 'club', 'dance', 'party', 'drink', 'pub', 'lounge'],
  festival: ['festival', 'event', 'celebration', 'fair', 'parade', 'concert'],
  local: ['local', 'hidden', 'gem', 'secret', 'underrated', 'neighborhood']
};

export function extractLocationsFromVideo(video: TikTokVideo, category: string): LocationExtraction[] {
  const locations: LocationExtraction[] = [];

  if (video.locationTag && video.locationTag.trim()) {
    const name = video.locationTag.trim();
    if (isValidLocationName(name)) {
      locations.push({
        name,
        description: video.description,
        category,
        source: 'tiktok_video',
        sourceUrl: video.url,
        hashtags: video.hashtags,
        mentions: video.mentions,
        author: video.author.uniqueId,
        authorFollowers: video.author.followers,
        playCount: video.playCount,
        locationTag: video.locationTag,
        music: video.musicTitle ? `${video.musicTitle} - ${video.musicAuthor}` : undefined
      });
    }
  }

  const nycHashtags = video.hashtags.filter(h => 
    ['nyc', 'newyork', 'newyorkcity', 'manhattan', 'brooklyn', 'queens', 'bronx', 'statenisland'].includes(h.toLowerCase())
  );

  for (const hashtag of video.hashtags) {
    if (hashtag.toLowerCase().endsWith('nyc') || 
        hashtag.toLowerCase().endsWith('newyork') ||
        hashtag.toLowerCase().includes('spot') ||
        hashtag.toLowerCase().includes('cafe') ||
        hashtag.toLowerCase().includes('restaurant')) {
      const possibleLocation = hashtag.replace(/nyc|newyork|spot|cafe|restaurant/gi, '').trim();
      if (possibleLocation.length > 2 && isValidLocationName(possibleLocation)) {
        locations.push({
          name: possibleLocation,
          description: video.description,
          category,
          source: 'tiktok_video',
          sourceUrl: video.url,
          hashtags: video.hashtags,
          mentions: video.mentions,
          author: video.author.uniqueId,
          authorFollowers: video.author.followers,
          playCount: video.playCount,
          locationTag: video.locationTag,
          music: video.musicTitle ? `${video.musicTitle} - ${video.musicAuthor}` : undefined
        });
      }
    }
  }

  const locationPatterns = [
    /(?:at|in|visit|try|check out)\s+([A-Z][A-Za-z\s&'-]+(?:NYC|New York)?)/gi,
    /([A-Z][A-Za-z\s&'-]+)\s+(?:in|at)\s+(?:NYC|New York|Manhattan|Brooklyn|Queens|Bronx|Staten Island)/gi,
    /"([^"]+)"\s*(?:in|at)/gi
  ];

  const description = video.description;
  
  for (const pattern of locationPatterns) {
    let match;
    while ((match = pattern.exec(description)) !== null) {
      const name = match[1].trim();
      
      if (isValidLocationName(name)) {
        locations.push({
          name,
          description: video.description,
          category,
          source: 'tiktok_video',
          sourceUrl: video.url,
          hashtags: video.hashtags,
          mentions: video.mentions,
          author: video.author.uniqueId,
          authorFollowers: video.author.followers,
          playCount: video.playCount,
          locationTag: video.locationTag,
          music: video.musicTitle ? `${video.musicTitle} - ${video.musicAuthor}` : undefined
        });
      }
    }
  }

  return locations;
}

export function extractLocationsFromProfile(profile: TikTokProfile, category: string): LocationExtraction[] {
  const locations: LocationExtraction[] = [];
  
  const signaturePatterns = [
    /(?:📍|location:)\s*([A-Za-z\s,.-]+)/gi,
    /(?:based in|located in)\s+([A-Za-z\s,.-]+)/gi
  ];

  for (const pattern of signaturePatterns) {
    let match;
    while ((match = pattern.exec(profile.signature)) !== null) {
      const name = match[1].trim();
      if (isValidLocationName(name)) {
        locations.push({
          name,
          description: profile.signature,
          category,
          source: 'tiktok_profile',
          sourceUrl: `https://www.tiktok.com/@${profile.uniqueId}`,
          hashtags: [],
          mentions: [],
          author: profile.uniqueId,
          authorFollowers: profile.followers,
          playCount: 0
        });
      }
    }
  }

  for (const video of profile.videos) {
    const videoLocations = extractLocationsFromVideo(video, category);
    locations.push(...videoLocations);
  }

  return locations;
}

function isValidLocationName(name: string): boolean {
  if (name.length < 3 || name.length > 100) return false;
  
  const invalidWords = ['the', 'a', 'an', 'this', 'that', 'these', 'those', 'my', 'your', 'our', 'best'];
  const firstWord = name.split(' ')[0].toLowerCase();
  if (invalidWords.includes(firstWord)) return false;
  
  if (/^\d+$/.test(name)) return false;
  
  return true;
}

export function inferCategoryFromQuery(query: string): string {
  const queryLower = query.toLowerCase();
  
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(keyword => queryLower.includes(keyword))) {
      return category;
    }
  }
  
  return 'local';
}

export function deduplicateLocations(locations: LocationExtraction[]): LocationExtraction[] {
  const seen = new Map<string, LocationExtraction>();
  
  for (const location of locations) {
    const key = location.name.toLowerCase().trim();
    const existing = seen.get(key);
    
    if (!existing) {
      seen.set(key, location);
    } else if (location.playCount > existing.playCount) {
      seen.set(key, location);
    }
  }
  
  return Array.from(seen.values());
}

export function processResults(results: ScrapingResult[]): LocationExtraction[] {
  const allLocations: LocationExtraction[] = [];
  
  for (const result of results) {
    const category = inferCategoryFromQuery(result.query);
    
    for (const video of result.videos) {
      const locations = extractLocationsFromVideo(video, category);
      allLocations.push(...locations);
    }
    
    for (const profile of result.profiles) {
      const locations = extractLocationsFromProfile(profile, category);
      allLocations.push(...locations);
    }
  }
  
  return deduplicateLocations(allLocations);
}