/**
 * The Google Maps search the rank engine runs for a keyword at a pin, so it can be opened
 * by hand. Must match `searchUrl` in server/src/rank/googleMapsEngine.ts.
 */
export function mapsSearchUrl(keyword: string, lat: number, lng: number): string {
  return `https://www.google.com/maps/search/${encodeURIComponent(keyword)}/@${lat},${lng},15z?hl=en&gl=us`;
}

/**
 * A business's Google Maps profile, from the ID the engine stored for it: a Place ID
 * (`ChIJ…`, via the documented Maps URLs format) or, when a result had none, a feature ID
 * (`0x…:0x…`, whose second half is the place's "cid"). Null for anything else, such as
 * the simulator's made-up `sim-` IDs.
 */
export function businessProfileUrl({ placeId, name }: { placeId: string; name: string }): string | null {
  if (placeId.startsWith('ChIJ')) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}&query_place_id=${encodeURIComponent(placeId)}&hl=en`;
  }
  const featureId = placeId.match(/^0x[0-9a-f]+:(0x[0-9a-f]+)$/i);
  if (featureId) return `https://www.google.com/maps?cid=${BigInt(featureId[1]).toString()}&hl=en`;
  return null;
}
