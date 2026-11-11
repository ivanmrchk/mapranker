export interface RankCheckInput {
  keyword: string;
  lat: number;
  lng: number;
  /** Google Place ID of the business being tracked. */
  placeId: string;
  /** Display name of the tracked business (used by the simulator). */
  businessName: string;
}

/** One business in the Maps results list. */
export interface MapsListing {
  /** 1-based position among organic (non-ad) results. */
  position: number;
  placeId: string;
  name: string;
  rating: number | null;
  reviewCount: number | null;
}

export interface RankCheckResult {
  /** Position of the tracked business, or null when it wasn't in the results. */
  rank: number | null;
  /** The results list in order (top MAX_TRACKED_RANK). */
  listings: MapsListing[];
}

/**
 * Something that can tell where a business ranks for a keyword at a location.
 * Throws when the check itself fails (network error, blocked, etc.); the pin is then
 * left unchecked for that run rather than recorded as "not found".
 */
export interface RankEngine {
  check(input: RankCheckInput): Promise<RankCheckResult>;
}

/** How many results the engine looks at; a business not in them shows as "20+". */
export const MAX_TRACKED_RANK = 20;

// ---------- simulated engine (until the Google Maps scraper is wired in) ----------

interface SimBusiness {
  name: string;
  /** Overall strength 0–1: stronger businesses rank higher on average. */
  strength: number;
  rating: number;
  baseReviews: number;
  reviewsPerDay: number;
}

// A fixed cast of made-up local businesses so results stay consistent between scans.
const SIM_BUSINESSES: SimBusiness[] = [
  ['Bright Spark Electric', 0.82, 4.8, 184, 0.45],
  ['Austin Volt Electricians', 0.74, 4.6, 97, 0.26],
  ['PowerPro Electrical Services', 0.62, 4.4, 52, 0.09],
  ['CircuitWorks Electric', 0.5, 4.2, 21, 0.03],
  ['Lone Star Wiring Co.', 0.7, 4.9, 312, 0.7],
  ['Capital City Electric', 0.68, 4.5, 441, 0.55],
  ['Hill Country Power & Light', 0.6, 4.7, 88, 0.2],
  ['Greenline EV & Electric', 0.66, 5.0, 64, 0.6],
  ['Amped Home Services', 0.58, 4.3, 205, 0.35],
  ['True North Electrical', 0.55, 4.6, 39, 0.12],
  ['Riverside Electric LLC', 0.52, 4.1, 118, 0.08],
  ['Bluebonnet Electrical', 0.63, 4.8, 156, 0.3],
  ['Sparky Pros', 0.47, 3.9, 73, 0.05],
  ['Mueller Electric Contractors', 0.57, 4.7, 27, 0.15],
  ['Pecan Street Electric', 0.45, 4.4, 15, 0.04],
  ['Volta Residential', 0.61, 4.9, 233, 0.9],
  ['Eastside Electrical Repair', 0.42, 4.0, 61, 0.02],
  ['Precision Circuit Solutions', 0.54, 4.5, 94, 0.18],
  ['Longhorn Electric Co.', 0.65, 4.6, 507, 0.4],
  ['Westlake Wiring', 0.49, 4.8, 33, 0.1],
  ['A1 Breaker & Panel', 0.44, 4.2, 47, 0.06],
  ['Northside Power Techs', 0.51, 4.3, 82, 0.11],
  ['Brightway Electric', 0.56, 4.7, 129, 0.25],
  ['Mopac Electrical Services', 0.4, 3.8, 19, 0.02],
  ['SolarEdge Install Austin', 0.53, 4.6, 71, 0.22],
  ['Ironwood Electric', 0.48, 4.5, 58, 0.07],
  ['Shoal Creek Electric', 0.46, 4.9, 24, 0.09],
  ['Brazos Electrical Group', 0.59, 4.4, 166, 0.28],
].map(([name, strength, rating, baseReviews, reviewsPerDay]) => ({
  name: name as string,
  strength: strength as number,
  rating: rating as number,
  baseReviews: baseReviews as number,
  reviewsPerDay: reviewsPerDay as number,
}));

const SIM_EPOCH = Date.UTC(2026, 0, 1);

/** Stable pseudo-random number in [0, 1) from a string (FNV-1a + murmur3 finalizer). */
function hash01(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  // Without this mix, strings differing only near the end (e.g. the longitude) hash almost
  // identically, which made whole rows of pins share the same ranking.
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 2 ** 32;
}

function simPlaceId(name: string): string {
  return `sim-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
}

/**
 * Simulated results for a check at time `at`. Each business's score combines its strength,
 * a fixed per-area/per-keyword factor (so each pin has its own leaderboard) and a little
 * per-scan jitter (so positions shift a spot or two between scans). Review counts grow
 * steadily over time at each business's own rate.
 */
export function simulateCheck(input: RankCheckInput, at: Date): RankCheckResult {
  const area = `${input.keyword}|${input.lat.toFixed(2)}|${input.lng.toFixed(2)}`;
  const days = (at.getTime() - SIM_EPOCH) / 86_400_000;
  const tracked: SimBusiness & { placeId: string } = {
    name: input.businessName,
    placeId: input.placeId,
    strength: 0.6,
    rating: 4.7,
    baseReviews: 140,
    reviewsPerDay: 0.3,
  };
  const all = [...SIM_BUSINESSES.map((b) => ({ ...b, placeId: simPlaceId(b.name) })), tracked];

  const ranked = all
    .map((b) => ({
      b,
      score: b.strength + hash01(`${b.placeId}|${area}`) * 0.6 + Math.random() * 0.06,
    }))
    .sort((x, y) => y.score - x.score)
    .slice(0, MAX_TRACKED_RANK);

  const listings: MapsListing[] = ranked.map(({ b }, i) => ({
    position: i + 1,
    placeId: b.placeId,
    name: b.name,
    rating: b.rating,
    reviewCount: Math.floor(b.baseReviews + Math.max(0, days) * b.reviewsPerDay),
  }));
  const rank = listings.find((l) => l.placeId === input.placeId)?.position ?? null;
  return { rank, listings };
}

export const simulatedEngine: RankEngine = {
  async check(input) {
    if (Math.random() < 0.03) throw new Error('Simulated check failure');
    return simulateCheck(input, new Date());
  },
};

export const rankEngine: RankEngine = simulatedEngine;
