import {
  MAX_TRACKED_RANK,
  type MapsListing,
  type RankCheckInput,
  type RankCheckResult,
  type RankEngine,
} from './engine.js';
import { SIMULATED_BUSINESSES, type SimulatedBusiness } from './simulatedBusinesses.js';

/** Fake engine for development: plausible, slowly drifting results without touching Google. */
export const simulatedEngine: RankEngine = {
  name: 'simulated',
  async startSession() {
    return {
      async check(input) {
        if (Math.random() < 0.03) throw new Error('Simulated check failure');
        return simulateCheck(input, new Date());
      },
      async close() {},
    };
  },
};

const SIM_EPOCH = Date.UTC(2026, 0, 1);

/**
 * Simulated results for a check at time `at`. Each business's score combines its strength,
 * a fixed per-area/per-keyword factor (so each pin has its own leaderboard), a slow
 * momentum (so history drifts over weeks) and a little per-scan jitter (so positions shift
 * a spot or two between scans). Review counts grow steadily at each business's own rate.
 */
export function simulateCheck(input: RankCheckInput, at: Date): RankCheckResult {
  const area = `${input.keyword}|${input.lat.toFixed(2)}|${input.lng.toFixed(2)}`;
  const days = (at.getTime() - SIM_EPOCH) / 86_400_000;
  const tracked: SimulatedBusiness & { placeId: string } = {
    name: input.businessName,
    placeId: input.placeId,
    strength: 0.6,
    rating: 4.7,
    baseReviews: 140,
    reviewsPerDay: 0.3,
  };
  const all = [...SIMULATED_BUSINESSES.map((b) => ({ ...b, placeId: simPlaceId(b.name) })), tracked];

  const ranked = all
    .map((b) => {
      const phase = hash01(`${b.placeId}|phase`) * 2 * Math.PI;
      const period = 60 + hash01(`${b.placeId}|period`) * 90;
      const momentum = 0.06 * Math.sin((2 * Math.PI * days) / period + phase);
      return {
        b,
        score: b.strength + hash01(`${b.placeId}|${area}`) * 0.6 + momentum + Math.random() * 0.06,
      };
    })
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

function simPlaceId(name: string): string {
  return `sim-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
}

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
