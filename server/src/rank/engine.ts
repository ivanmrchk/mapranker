export interface RankCheckInput {
  keyword: string;
  lat: number;
  lng: number;
  /** Google Place ID of the business being tracked. */
  placeId: string;
}

export interface RankCheckResult {
  /** 1-based position in the results, or null when the business wasn't in the results. */
  rank: number | null;
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

/**
 * Simulated engine used until the Google Maps scraper is wired in (Phase 2).
 * Returns random ranks, sometimes "not found", and occasionally fails outright.
 */
export const simulatedEngine: RankEngine = {
  async check() {
    if (Math.random() < 0.03) throw new Error('Simulated check failure');
    if (Math.random() < 0.15) return { rank: null };
    return { rank: Math.floor(Math.random() * MAX_TRACKED_RANK) + 1 };
  },
};

export const rankEngine: RankEngine = simulatedEngine;
