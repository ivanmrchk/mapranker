/**
 * The Google Maps search the rank engine runs for a keyword at a pin, so it can be opened
 * by hand. Must match `searchUrl` in server/src/rank/googleMapsEngine.ts.
 */
export function mapsSearchUrl(keyword: string, lat: number, lng: number): string {
  return `https://www.google.com/maps/search/${encodeURIComponent(keyword)}/@${lat},${lng},15z?hl=en&gl=us`;
}
