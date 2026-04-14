-- Migration: 001_initial_schema
-- Created: 2025-04-14
-- Description: Initial schema for TikTok location storage with SQLite+Supabase dual-write

-- Locations table: main storage for discovered locations
CREATE TABLE IF NOT EXISTS locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'local',
  city TEXT NOT NULL DEFAULT '',
  neighborhood TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
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
  hashtags JSONB NOT NULL DEFAULT '[]',
  mentions JSONB NOT NULL DEFAULT '[]',
  music TEXT,
  author TEXT,
  author_followers INTEGER DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'tiktok_video',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(normalized_name, city)
);

-- Scrape runs table: tracks provenance of each scrape run
CREATE TABLE IF NOT EXISTS scrape_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mode TEXT NOT NULL,
  queries JSONB NOT NULL,
  city TEXT,
  videos_scraped INTEGER DEFAULT 0,
  locations_found INTEGER DEFAULT 0,
  errors JSONB DEFAULT '[]',
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ
);

-- Location sources: links locations to scrape runs with per-video engagement data
CREATE TABLE IF NOT EXISTS location_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  run_id UUID NOT NULL REFERENCES scrape_runs(id),
  source_url TEXT NOT NULL,
  author TEXT,
  author_followers INTEGER DEFAULT 0,
  raw_engagement JSONB NOT NULL DEFAULT '{}',
  UNIQUE(location_id, source_url)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_locations_category ON locations(category);
CREATE INDEX IF NOT EXISTS idx_locations_city ON locations(city);
CREATE INDEX IF NOT EXISTS idx_locations_engagement ON locations(total_engagement DESC);
CREATE INDEX IF NOT EXISTS idx_location_sources_location ON location_sources(location_id);
CREATE INDEX IF NOT EXISTS idx_scrape_runs_started ON scrape_runs(started_at DESC);