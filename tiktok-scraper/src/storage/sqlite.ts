import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { LocationExtraction } from '../processor.js';
import { ValidatedLocation } from '../validation/index.js';
import { StorageAdapter, StoredLocation, ScrapeRunMeta, LocationFilters } from './types.js';
import * as fs from 'fs';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS locations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'local',
  city TEXT NOT NULL DEFAULT '',
  neighborhood TEXT,
  latitude REAL,
  longitude REAL,
  address TEXT,
  gem_level INTEGER,
  extraction_method TEXT NOT NULL,
  source_video_count INTEGER NOT NULL DEFAULT 1,
  location_tag TEXT,
  location_url TEXT,
  likes INTEGER NOT NULL DEFAULT 0,
  comments INTEGER NOT NULL DEFAULT 0,
  shares INTEGER NOT NULL DEFAULT 0,
  collects INTEGER NOT NULL DEFAULT 0,
  play_count INTEGER NOT NULL DEFAULT 0,
  total_engagement INTEGER NOT NULL DEFAULT 0,
  hashtags TEXT NOT NULL DEFAULT '[]',
  mentions TEXT NOT NULL DEFAULT '[]',
  music TEXT,
  author TEXT,
  author_followers INTEGER DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'tiktok_video',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(normalized_name, city)
);

CREATE TABLE IF NOT EXISTS scrape_runs (
  id TEXT PRIMARY KEY,
  mode TEXT NOT NULL,
  queries TEXT NOT NULL,
  city TEXT,
  videos_scraped INTEGER DEFAULT 0,
  locations_found INTEGER DEFAULT 0,
  errors TEXT DEFAULT '[]',
  started_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS location_sources (
  id TEXT PRIMARY KEY,
  location_id TEXT NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  run_id TEXT NOT NULL REFERENCES scrape_runs(id),
  source_url TEXT NOT NULL,
  author TEXT,
  author_followers INTEGER DEFAULT 0,
  raw_engagement TEXT NOT NULL DEFAULT '{}',
  UNIQUE(location_id, source_url)
);

CREATE INDEX IF NOT EXISTS idx_locations_category ON locations(category);
CREATE INDEX IF NOT EXISTS idx_locations_city ON locations(city);
CREATE INDEX IF NOT EXISTS idx_locations_engagement ON locations(total_engagement);
CREATE INDEX IF NOT EXISTS idx_location_sources_location ON location_sources(location_id);
`;

function normalizeLocationName(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
}

function rowToStoredLocation(row: Record<string, unknown>): StoredLocation {
  return {
    id: row.id as string,
    name: row.name as string,
    normalizedName: row.normalized_name as string,
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
    hashtags: JSON.parse((row.hashtags as string) || '[]'),
    mentions: JSON.parse((row.mentions as string) || '[]'),
    music: row.music as string | undefined,
    author: (row.author as string) || '',
    authorFollowers: (row.author_followers as number) || 0,
    source: (row.source as 'tiktok_video' | 'ai_extraction') || 'tiktok_video',
    sourceUrl: '',
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export class SQLiteAdapter implements StorageAdapter {
  private db: Database.Database;

  constructor(dbPath: string) {
    const dir = dbPath.substring(0, dbPath.lastIndexOf('/'));
    if (dir) {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    }
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.db.exec(SCHEMA);
  }

  async upsertLocations(
    locations: LocationExtraction[],
    runMeta: ScrapeRunMeta,
    city?: string,
  ): Promise<void> {
    const runId = uuidv4();
    const now = new Date().toISOString();

    const tx = this.db.transaction(() => {
      this.db
        .prepare(
          `INSERT INTO scrape_runs (id, mode, queries, city, videos_scraped, locations_found, errors, started_at, completed_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          runId,
          runMeta.mode,
          JSON.stringify(runMeta.queries),
          runMeta.city || city || '',
          runMeta.videosScraped,
          runMeta.locationsFound,
          JSON.stringify(runMeta.errors),
          now,
          now,
        );

const upsertLocation = this.db.prepare(`
        INSERT INTO locations (
          id, name, normalized_name, description, category, city,
          latitude, longitude, address, neighborhood, place_id, rating, extraction_method, 
          source_video_count, location_tag, location_url,
          likes, comments, shares, collects, play_count, total_engagement,
          hashtags, mentions, music, author, author_followers, source,
          created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?
        )
        ON CONFLICT(normalized_name, city) DO UPDATE SET
          likes = likes + excluded.likes,
          comments = comments + excluded.comments,
          shares = shares + excluded.shares,
          collects = shares + excluded.collects,
          play_count = play_count + excluded.play_count,
          total_engagement = total_engagement + excluded.total_engagement,
          source_video_count = source_video_count + 1,
          description = CASE
            WHEN length(excluded.description) > length(locations.description) THEN excluded.description
            ELSE locations.description
          END,
          latitude = CASE
            WHEN locations.latitude IS NULL OR locations.latitude = 0 THEN excluded.latitude
            ELSE locations.latitude
          END,
          longitude = CASE
            WHEN locations.longitude IS NULL OR locations.longitude = 0 THEN excluded.longitude
            ELSE locations.longitude
          END,
          address = CASE
            WHEN locations.address IS NULL OR locations.address = '' THEN excluded.address
            ELSE locations.address
          END,
          neighborhood = CASE
            WHEN locations.neighborhood IS NULL THEN excluded.neighborhood
            ELSE locations.neighborhood
          END,
          place_id = CASE
            WHEN locations.place_id IS NULL THEN excluded.place_id
            ELSE locations.place_id
          END,
          rating = CASE
            WHEN locations.rating IS NULL THEN excluded.rating
            ELSE locations.rating
          END,
          updated_at = excluded.updated_at
      `);

      const insertSource = this.db.prepare(`
        INSERT OR IGNORE INTO location_sources (id, location_id, run_id, source_url, author, author_followers, raw_engagement)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      const findLocationId = this.db.prepare(
        `SELECT id FROM locations WHERE normalized_name = ? AND city = ?`,
      );

      for (const loc of locations) {
        const normalizedName = normalizeLocationName(loc.name);
        const locCity = runMeta.city || city || '';
        const locId = uuidv4();

        // ValidatedLocation has coordinate fields, plain LocationExtraction doesn't
        const validated = loc as ValidatedLocation;
        const latitude = validated.latitude || null;
        const longitude = validated.longitude || null;
        const address = validated.address || null;
        const neighborhood = validated.neighborhood || null;
        const placeId = validated.placeId || null;
        const rating = validated.rating || null;

        upsertLocation.run(
          locId,
          loc.name,
          normalizedName,
          loc.description,
          loc.category,
          locCity,
          latitude,
          longitude,
          address,
          neighborhood,
          placeId,
          rating,
          loc.extractionMethod,
          1,
          loc.locationTag || null,
          loc.locationUrl || null,
          loc.socialProof.likes,
          loc.socialProof.comments,
          loc.socialProof.shares,
          loc.socialProof.collects,
          loc.socialProof.playCount,
          loc.socialProof.totalEngagement,
          JSON.stringify(loc.hashtags),
          JSON.stringify(loc.mentions),
          loc.music || null,
          loc.author,
          loc.authorFollowers,
          loc.source,
          now,
          now,
        );

        const existing = findLocationId.get(normalizedName, locCity) as { id: string } | undefined;
        const actualId = existing ? existing.id : locId;

        insertSource.run(
          uuidv4(),
          actualId,
          runId,
          loc.sourceUrl,
          loc.author,
          loc.authorFollowers,
          JSON.stringify(loc.socialProof),
        );
      }
    });

    tx();
  }

  async getLocations(filters?: LocationFilters): Promise<StoredLocation[]> {
    const clauses: string[] = [];
    const params: unknown[] = [];

    if (filters?.city) {
      clauses.push('city = ?');
      params.push(filters.city);
    }
    if (filters?.category) {
      clauses.push('category = ?');
      params.push(filters.category);
    }
    if (filters?.minEngagement) {
      clauses.push('total_engagement >= ?');
      params.push(filters.minEngagement);
    }
    if (filters?.gemLevel) {
      clauses.push('gem_level = ?');
      params.push(filters.gemLevel);
    }
    if (filters?.extractionMethod) {
      clauses.push('extraction_method = ?');
      params.push(filters.extractionMethod);
    }

    const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    let sql = `SELECT * FROM locations ${where} ORDER BY total_engagement DESC`;

    if (filters?.limit) {
      sql += ` LIMIT ?`;
      params.push(filters.limit);
      if (filters?.offset) {
        sql += ` OFFSET ?`;
        params.push(filters.offset);
      }
    }

    const rows = this.db.prepare(sql).all(...params) as Record<string, unknown>[];
    return rows.map(rowToStoredLocation);
  }

  async getLocationByName(normalizedName: string, city?: string): Promise<StoredLocation | null> {
    let sql = `SELECT * FROM locations WHERE normalized_name = ?`;
    const params: unknown[] = [normalizedName];

    if (city) {
      sql += ` AND city = ?`;
      params.push(city);
    }

    const row = this.db.prepare(sql).get(...params) as Record<string, unknown> | undefined;
    return row ? rowToStoredLocation(row) : null;
  }

  async updateLocationCoordinates(
    id: string,
    latitude: number,
    longitude: number,
    address: string,
    neighborhood?: string,
    placeId?: string,
    rating?: number,
  ): Promise<void> {
    // Add columns if they don't exist (migration for existing databases)
    const columns = this.db.prepare("PRAGMA table_info(locations)").all() as { name: string }[];
    const columnNames = columns.map(c => c.name);

    if (!columnNames.includes('place_id')) {
      this.db.exec('ALTER TABLE locations ADD COLUMN place_id TEXT');
    }
    if (!columnNames.includes('rating')) {
      this.db.exec('ALTER TABLE locations ADD COLUMN rating REAL');
    }

    const now = new Date().toISOString();
    this.db
      .prepare(`
        UPDATE locations
        SET latitude = ?, longitude = ?, address = ?, neighborhood = ?, place_id = ?, rating = ?, updated_at = ?
        WHERE id = ?
      `)
      .run(latitude, longitude, address, neighborhood || null, placeId || null, rating ?? null, now, id);
  }

  close(): void {
    this.db.close();
  }
}
