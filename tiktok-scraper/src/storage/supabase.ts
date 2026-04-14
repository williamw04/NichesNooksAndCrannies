import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { LocationExtraction } from '../processor.js';
import { StorageAdapter, StoredLocation, ScrapeRunMeta, LocationFilters } from './types.js';

function normalizeLocationName(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
}

function locationToRow(loc: LocationExtraction, city: string) {
  return {
    id: uuidv4(),
    name: loc.name,
    normalized_name: normalizeLocationName(loc.name),
    description: loc.description,
    category: loc.category,
    city,
    extraction_method: loc.extractionMethod,
    source_video_count: 1,
    location_tag: loc.locationTag || null,
    location_url: loc.locationUrl || null,
    likes: loc.socialProof.likes,
    comments: loc.socialProof.comments,
    shares: loc.socialProof.shares,
    collects: loc.socialProof.collects,
    play_count: loc.socialProof.playCount,
    total_engagement: loc.socialProof.totalEngagement,
    hashtags: loc.hashtags,
    mentions: loc.mentions,
    music: loc.music || null,
    author: loc.author,
    author_followers: loc.authorFollowers,
    source: loc.source,
  };
}

export class SupabaseAdapter implements StorageAdapter {
  private client: SupabaseClient;

  constructor(url: string, key: string) {
    this.client = createClient(url, key);
  }

  async upsertLocations(
    locations: LocationExtraction[],
    runMeta: ScrapeRunMeta,
    city?: string,
  ): Promise<void> {
    const runId = uuidv4();
    const now = new Date().toISOString();
    const locCity = runMeta.city || city || '';

    const { error: runError } = await this.client.from('scrape_runs').insert({
      id: runId,
      mode: runMeta.mode,
      queries: runMeta.queries,
      city: locCity,
      videos_scraped: runMeta.videosScraped,
      locations_found: runMeta.locationsFound,
      errors: runMeta.errors,
      started_at: now,
      completed_at: now,
    });
    if (runError) console.warn(`Supabase scrape_runs insert failed: ${runError.message}`);

    // Query existing locations to preserve their IDs (FK integrity with location_sources)
    const normalizedNameCityPairs = locations.map((loc) => ({
      normalized_name: normalizeLocationName(loc.name),
      city: locCity,
    }));

    const { data: existingLocs } = await this.client
      .from('locations')
      .select('id, normalized_name, city')
      .or(
        normalizedNameCityPairs
          .map((p) => `and(normalized_name.eq.${p.normalized_name},city.eq.${p.city})`)
          .join(','),
      );

    const existingMap = new Map(
      (existingLocs || []).map((row) => [`${row.normalized_name}|${row.city}`, row.id]),
    );

    const locationRows = locations.map((loc) => {
      const row = locationToRow(loc, locCity);
      const key = `${normalizeLocationName(loc.name)}|${locCity}`;
      const existingId = existingMap.get(key);
      if (existingId) row.id = existingId;
      return row;
    });

    const { error: locError } = await this.client
      .from('locations')
      .upsert(locationRows, {
        onConflict: 'normalized_name,city',
        ignoreDuplicates: false,
      });
    if (locError) console.warn(`Supabase locations upsert failed: ${locError.message}`);

    for (let i = 0; i < locations.length; i++) {
      const loc = locations[i];
      const key = `${normalizeLocationName(loc.name)}|${locCity}`;
      const existingId = existingMap.get(key);

      if (existingId) {
        await this.client.from('location_sources').upsert(
          {
            id: uuidv4(),
            location_id: existingId,
            run_id: runId,
            source_url: loc.sourceUrl,
            author: loc.author,
            author_followers: loc.authorFollowers,
            raw_engagement: loc.socialProof,
          },
          { onConflict: 'location_id,source_url', ignoreDuplicates: true },
        );
      }
    }
  }

  async getLocations(filters?: LocationFilters): Promise<StoredLocation[]> {
    let query = this.client.from('locations').select('*').order('total_engagement', { ascending: false });

    if (filters?.city) query = query.eq('city', filters.city);
    if (filters?.category) query = query.eq('category', filters.category);
    if (filters?.minEngagement) query = query.gte('total_engagement', filters.minEngagement);
    if (filters?.gemLevel) query = query.eq('gem_level', filters.gemLevel);
    if (filters?.extractionMethod) query = query.eq('extraction_method', filters.extractionMethod);
    if (filters?.limit) query = query.limit(filters.limit);
    if (filters?.offset) query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1);

    const { data, error } = await query;
    if (error) {
      console.warn(`Supabase getLocations failed: ${error.message}`);
      return [];
    }

    return (data || []).map((row: Record<string, unknown>) => ({
      id: row.id as string,
      normalizedName: row.normalized_name as string,
      name: row.name as string,
      description: (row.description as string) || '',
      category: row.category as string,
      city: (row.city as string) || '',
      neighborhood: row.neighborhood as string | undefined,
      latitude: row.latitude as number | undefined,
      longitude: row.longitude as number | undefined,
      address: row.address as string | undefined,
      gemLevel: row.gem_level as number | undefined,
      extractionMethod: row.extraction_method as 'poi_tag' | 'ai_extraction',
      sourceVideoCount: row.source_video_count as number,
      locationTag: row.location_tag as string | undefined,
      locationUrl: row.location_url as string | undefined,
      socialProof: {
        likes: row.likes as number,
        comments: row.comments as number,
        shares: row.shares as number,
        collects: row.collects as number,
        playCount: row.play_count as number,
        totalEngagement: row.total_engagement as number,
      },
      hashtags: Array.isArray(row.hashtags) ? row.hashtags : JSON.parse((row.hashtags as string) || '[]'),
      mentions: Array.isArray(row.mentions) ? row.mentions : JSON.parse((row.mentions as string) || '[]'),
      music: row.music as string | undefined,
      author: (row.author as string) || '',
      authorFollowers: (row.author_followers as number) || 0,
      source: (row.source as 'tiktok_video' | 'ai_extraction') || 'tiktok_video',
      sourceUrl: '',
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    }));
  }

  async getLocationByName(normalizedName: string, city?: string): Promise<StoredLocation | null> {
    let query = this.client.from('locations').select('*').eq('normalized_name', normalizedName);
    if (city) query = query.eq('city', city);

    const { data, error } = await query.single();
    if (error || !data) return null;

    const row = data as Record<string, unknown>;
    return {
      id: row.id as string,
      normalizedName: row.normalized_name as string,
      name: row.name as string,
      description: (row.description as string) || '',
      category: row.category as string,
      city: (row.city as string) || '',
      neighborhood: row.neighborhood as string | undefined,
      latitude: row.latitude as number | undefined,
      longitude: row.longitude as number | undefined,
      address: row.address as string | undefined,
      gemLevel: row.gem_level as number | undefined,
      extractionMethod: row.extraction_method as 'poi_tag' | 'ai_extraction',
      sourceVideoCount: row.source_video_count as number,
      locationTag: row.location_tag as string | undefined,
      locationUrl: row.location_url as string | undefined,
      socialProof: {
        likes: row.likes as number,
        comments: row.comments as number,
        shares: row.shares as number,
        collects: row.collects as number,
        playCount: row.play_count as number,
        totalEngagement: row.total_engagement as number,
      },
      hashtags: Array.isArray(row.hashtags) ? row.hashtags : JSON.parse((row.hashtags as string) || '[]'),
      mentions: Array.isArray(row.mentions) ? row.mentions : JSON.parse((row.mentions as string) || '[]'),
      music: row.music as string | undefined,
      author: (row.author as string) || '',
      authorFollowers: (row.author_followers as number) || 0,
      source: (row.source as 'tiktok_video' | 'ai_extraction') || 'tiktok_video',
      sourceUrl: '',
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  }
}
