export interface LatLng {
  lat: number;
  lng: number;
}

export const GRID_SIZES = [3, 5, 7, 9] as const;
export const GRID_SPACINGS_KM = [0.5, 1, 2, 3] as const;
export const DEFAULT_GRID_SIZE = 7;
export const DEFAULT_GRID_SPACING_KM = 1;

const KM_PER_DEGREE_LAT = 111.32;

/**
 * A size×size square grid of points centered on `center`, `spacingKm` apart.
 * Keep in sync with server/src/lib/geo.ts.
 */
export function generateGrid(center: LatLng, size: number, spacingKm: number): LatLng[] {
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
