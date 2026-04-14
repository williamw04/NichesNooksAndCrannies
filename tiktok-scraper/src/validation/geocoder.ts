import { randomDelay } from '../scraping/browser.js';

export interface GeocodeResult {
  latitude: number;
  longitude: number;
  address: string;
  neighborhood?: string;
  placeId?: string;
  rating?: number;
  types?: string[];
}

// The Geocoding API resolves "West Village, New York" to the neighborhood center.
// The Places Text Search API finds actual business listings with precise coordinates.
// For location validation we need the business/store, not the geographic center.
const PLACES_SEARCH_URL = 'https://maps.googleapis.com/maps/api/place/textsearch/json';
const GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';

export async function geocodeLocation(
  name: string,
  city: string,
  apiKey: string,
): Promise<GeocodeResult | null> {
  // Try Places Text Search first — returns actual business listings
  const place = await searchPlace(name, city, apiKey);
  if (place) return place;

  // Fallback to Geocoding API for non-business locations (parks, landmarks, etc.)
  return geocodeAddress(name, city, apiKey);
}

async function searchPlace(
  name: string,
  city: string,
  apiKey: string,
): Promise<GeocodeResult | null> {
  const query = `${name} in ${city}`;
  const url = `${PLACES_SEARCH_URL}?query=${encodeURIComponent(query)}&key=${apiKey}`;

  await randomDelay(100, 200);

  try {
    const response = await fetch(url);
    const data = await response.json() as {
      status: string;
      error_message?: string;
      results: Array<{
        place_id: string;
        name: string;
        formatted_address: string;
        geometry: { location: { lat: number; lng: number } };
        types: string[];
        rating?: number;
        address_components: Array<{ types: string[]; long_name: string }>;
      }>;
    };

    if (data.status !== 'OK' || !data.results || data.results.length === 0) {
      return null;
    }

    // Prefer results that are actual businesses/establishments, not political/geographic areas
    const establishment = data.results.find(r =>
      r.types.some(t =>
        ['restaurant', 'cafe', 'store', 'bar', 'bakery', 'food', 'establishment', 'point_of_interest', 'tourist_attraction', 'museum', 'park', 'art_gallery', 'shopping_mall', 'clothing_store', 'shoe_store', 'book_store', 'gym', 'spa', 'hair_care', 'beauty_salon', 'lodging', 'night_club'].includes(t),
      ),
    );

    const result = establishment || data.results[0];
    const location = result.geometry.location;

    let neighborhood: string | undefined;
    const neighborhoodComponent = result.address_components?.find(comp =>
      comp.types.includes('neighborhood'),
    );
    if (neighborhoodComponent) {
      neighborhood = neighborhoodComponent.long_name;
    }

    return {
      latitude: location.lat,
      longitude: location.lng,
      address: result.formatted_address,
      neighborhood,
      placeId: result.place_id,
      rating: result.rating,
      types: result.types,
    };
  } catch (error) {
    console.warn(`  Places search error for "${name}": ${error instanceof Error ? error.message : 'Unknown error'}`);
    return null;
  }
}

async function geocodeAddress(
  name: string,
  city: string,
  apiKey: string,
): Promise<GeocodeResult | null> {
  const address = `${name}, ${city}`;
  const url = `${GEOCODE_URL}?address=${encodeURIComponent(address)}&key=${apiKey}`;

  await randomDelay(100, 200);

  try {
    const response = await fetch(url);
    const data = await response.json() as {
      status: string;
      error_message?: string;
      results: Array<{
        geometry: { location: { lat: number; lng: number } };
        formatted_address: string;
        address_components: Array<{ types: string[]; long_name: string }>;
      }>;
    };

    if (data.status !== 'OK' || !data.results || data.results.length === 0) {
      if (data.status === 'ZERO_RESULTS') {
        console.warn(`  No results for: ${address}`);
      } else {
        console.warn(`  Geocode failed for "${name}": ${data.status} - ${data.error_message || 'Unknown error'}`);
      }
      return null;
    }

    const result = data.results[0];
    const location = result.geometry.location;

    let neighborhood: string | undefined;
    const neighborhoodComponent = result.address_components.find(comp =>
      comp.types.includes('neighborhood'),
    );
    if (neighborhoodComponent) {
      neighborhood = neighborhoodComponent.long_name;
    }

    return {
      latitude: location.lat,
      longitude: location.lng,
      address: result.formatted_address,
      neighborhood,
    };
  } catch (error) {
    console.warn(`  Error geocoding "${name}": ${error instanceof Error ? error.message : 'Unknown error'}`);
    return null;
  }
}
