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
 * A batch of checks sharing one setup (for the Google engine: one browser), so a run
 * doesn't pay the start-up cost per pin. Always close it, also after a failure.
 */
export interface RankSession {
  /**
   * Throws when the check itself fails (network error, page changed, …); the pin is then
   * left unchecked rather than recorded as "not found". Throws RankEngineBlockedError when
   * Google asks for a CAPTCHA: further checks would fail too, so the caller should stop.
   */
  check(input: RankCheckInput): Promise<RankCheckResult>;
  close(): Promise<void>;
}

/** Something that can tell where a business ranks for a keyword at a location. */
export interface RankEngine {
  readonly name: string;
  startSession(): Promise<RankSession>;
}

export class RankEngineBlockedError extends Error {}

/** How many results the engine looks at; a business not in them shows as "20+". */
export const MAX_TRACKED_RANK = 20;
