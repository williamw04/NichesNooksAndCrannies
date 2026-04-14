import { StoredLocation } from './types.js';
import * as fs from 'fs';
import * as path from 'path';

const CSV_HEADERS = [
  'name',
  'description',
  'category',
  'latitude',
  'longitude',
  'city',
  'country',
  'address',
  'price_level',
  'google_maps_url',
  'rating',
  'image_url',
  'tags',
  'ai_vibe_summary',
  'gem_level',
  'neighborhood',
];

function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function exportToCsv(locations: StoredLocation[], outputPath: string): void {
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const rows = locations.map((loc) =>
    [
      escapeCsv(loc.name),
      escapeCsv(loc.description),
      escapeCsv(loc.category),
      loc.latitude?.toString() || '',
      loc.longitude?.toString() || '',
      escapeCsv(loc.city),
      '',
      escapeCsv(loc.address || ''),
      '',
      escapeCsv(loc.locationUrl || ''),
      '',
      '',
      escapeCsv(loc.hashtags.join('; ')),
      '',
      loc.gemLevel?.toString() || '',
      escapeCsv(loc.neighborhood || ''),
    ].join(','),
  );

  const csv = [CSV_HEADERS.join(','), ...rows].join('\n');
  fs.writeFileSync(outputPath, csv);
}
