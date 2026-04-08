export interface TikTokScraperInput {
  searchQueries: string[];
  city?: string;
  resultsPerPage: number;
  maxItems: number;
  shouldDownloadVideos: boolean;
  shouldDownloadCovers: boolean;
  shouldDownloadSubtitles: boolean;
  shouldDownloadSlideshowImages: boolean;
  profileScrapeSections: ('videos' | 'liked' | 'favorites')[];
  profileSorting: 'latest' | 'oldest' | 'popular';
  excludePinnedPosts: boolean;
  searchSection: '' | 'user' | 'video' | 'hashtag' | 'sound';
  maxProfilesPerQuery: number;
  searchSorting: '0' | '1' | '2';
  searchDatePosted: '0' | '1' | '7' | '30';
  scrapeRelatedVideos: boolean;
  shouldDownloadAvatars: boolean;
  shouldDownloadMusicCovers: boolean;
  downloadSubtitlesOptions: 'NEVER_DOWNLOAD_SUBTITLES' | 'DOWNLOAD_SUBTITLES_IF_AVAILABLE';
  proxyCountryCode: string;
  openRouterApiKey?: string;
  openRouterModel?: string;
  minEngagement?: number;
  categoryKeywords?: Record<string, string[]>;
  debug?: boolean;
}

export interface TikTokAuthor {
  id: string;
  uniqueId: string;
  nickname: string;
  avatarUrl: string;
  signature: string;
  verified: boolean;
  followers: number;
  following: number;
  hearts: number;
  videoCount: number;
}

export interface TikTokMusic {
  id: string;
  title: string;
  author: string;
  coverUrl: string;
  playUrl: string;
}

export interface TikTokVideo {
  id: string;
  url: string;
  description: string;
  author: TikTokAuthor;
  music?: TikTokMusic;
  createTime: number;
  playCount: number;
  shareCount: number;
  commentCount: number;
  diggCount: number;
  collectCount: number;
  videoUrl: string;
  coverUrl: string;
  dynamicCoverUrl: string;
  duration: number;
  width: number;
  height: number;
  hashtags: string[];
  mentions: string[];
  isAd: boolean;
  isPinned: boolean;
  downloadedVideo?: string;
  downloadedCover?: string;
  subtitles?: string;
  locationTag?: string;
  locationUrl?: string;
  musicTitle?: string;
  musicAuthor?: string;
}

export interface TikTokProfile {
  id: string;
  uniqueId: string;
  nickname: string;
  avatarUrl: string;
  signature: string;
  verified: boolean;
  followers: number;
  following: number;
  hearts: number;
  videoCount: number;
  videos: TikTokVideo[];
}

export interface ScrapingResult {
  query: string;
  videos: TikTokVideo[];
  profiles: TikTokProfile[];
  timestamp: string;
  error?: string;
}

export interface ScraperStats {
  totalVideos: number;
  totalProfiles: number;
  queriesProcessed: number;
  errors: string[];
  startTime: string;
  endTime?: string;
  durationMs?: number;
}

export interface TikTokScraperOutput {
  input: TikTokScraperInput;
  results: ScrapingResult[];
  stats: ScraperStats;
}

export interface SocialProof {
  likes: number;
  comments: number;
  shares: number;
  collects: number;
  playCount: number;
  totalEngagement: number;
}

export interface AiExtractedLocation {
  name: string;
  type: string;
}

export const DEFAULT_CATEGORY_KEYWORDS: Record<string, string[]> = {
  cafe: ['cafe', 'coffee', 'espresso', 'latte', 'cappuccino', 'bakery', 'brunch'],
  restaurant: ['restaurant', 'food', 'dining', 'eat', 'dinner', 'lunch', 'taste', 'delicious', 'yummy'],
  nature: ['nature', 'park', 'hiking', 'trail', 'beach', 'river', 'lake', 'garden', 'outdoor'],
  historical: ['historical', 'history', 'landmark', 'monument', 'heritage', 'old'],
  museum: ['museum', 'gallery', 'exhibition', 'art', 'artifact'],
  shopping: ['shopping', 'store', 'market', 'boutique', 'mall', 'shop'],
  adventure: ['adventure', 'explore', 'thrill', 'exciting', 'activity', 'experience'],
  relaxation: ['relax', 'spa', 'wellness', 'calm', 'peaceful', 'serene', 'quiet'],
  nightlife: ['nightlife', 'bar', 'club', 'dance', 'party', 'drink', 'pub', 'lounge'],
  festival: ['festival', 'event', 'celebration', 'fair', 'parade', 'concert'],
  local: ['local', 'hidden', 'gem', 'secret', 'underrated', 'neighborhood'],
};

export const DEFAULT_INPUT: TikTokScraperInput = {
  searchQueries: [],
  city: '',
  resultsPerPage: 5,
  maxItems: 55,
  shouldDownloadVideos: false,
  shouldDownloadCovers: false,
  shouldDownloadSubtitles: false,
  shouldDownloadSlideshowImages: false,
  profileScrapeSections: ['videos'],
  profileSorting: 'latest',
  excludePinnedPosts: false,
  searchSection: '',
  maxProfilesPerQuery: 10,
  searchSorting: '0',
  searchDatePosted: '0',
  scrapeRelatedVideos: false,
  shouldDownloadAvatars: false,
  shouldDownloadMusicCovers: false,
  downloadSubtitlesOptions: 'NEVER_DOWNLOAD_SUBTITLES',
  proxyCountryCode: 'None',
  openRouterModel: 'google/gemma-3-27b-it:free',
  minEngagement: 0,
};
