import { SQLiteAdapter } from './sqlite.js';
import { SupabaseAdapter } from './supabase.js';
import { DualWriter } from './dual-writer.js';
import { StorageAdapter, StorageConfig } from './types.js';

const DEFAULT_SQLITE_PATH = 'data/locations.db';

export function createStorage(config?: StorageConfig): StorageAdapter {
  const sqlite = new SQLiteAdapter(config?.sqlitePath || DEFAULT_SQLITE_PATH);
  const supabase = config?.supabase
    ? new SupabaseAdapter(config.supabase.url, config.supabase.key)
    : undefined;
  return new DualWriter(sqlite, supabase);
}

export { SQLiteAdapter } from './sqlite.js';
export { SupabaseAdapter } from './supabase.js';
export { DualWriter } from './dual-writer.js';
export { exportToCsv } from './csv-export.js';
export type {
  StorageAdapter,
  StorageConfig,
  StoredLocation,
  ScrapeRunMeta,
  LocationFilters,
} from './types.js';
