export interface LatLng {
  lat: number;
  lng: number;
}

export const DEFAULT_GRID_SIZE = 7;
export const DEFAULT_GRID_SPACING_KM = 1;

const KM_PER_DEGREE_LAT = 111.32;

/**
 * A size×size square grid of points centered on `center`, `spacingKm` apart.
 * Keep in sync with src/lib/grid.ts in the frontend.
 */
export function generateGrid(
  center: LatLng,
  size = DEFAULT_GRID_SIZE,
  spacingKm = DEFAULT_GRID_SPACING_KM,
): LatLng[] {
  const dLat = spacingKm / KM_PER_DEGREE_LAT;
  const dLng = spacingKm / (KM_PER_DEGREE_LAT * Math.cos((center.lat * Math.PI) / 180));
  const half = (size - 1) / 2;
  const points: LatLng[] = [];
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      points.push({
        lat: center.lat + (half - row) * dLat,
        lng: center.lng + (col - half) * dLng,
      });
    }
  }
  return points;
}

/**
 * Looks up an address with OpenStreetMap's Nominatim service (free, no key).
 * Returns null when the address can't be found or the service is unreachable.
 * Nominatim's usage policy: at most 1 request/second and an identifying User-Agent.
 */
export async function geocodeAddress(address: string): Promise<LatLng | null> {
  const query = address.trim();
  if (!query) return null;
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '1');
  url.searchParams.set('q', query);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'MapRanker/0.1 (self-hosted local rank tracker)', 'Accept-Language': 'en' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const results = (await res.json()) as { lat: string; lon: string }[];
    const first = results[0];
    if (!first) return null;
    return { lat: Number(first.lat), lng: Number(first.lon) };
  } catch {
    return null;
  }
}
