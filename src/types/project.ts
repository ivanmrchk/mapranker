export type ProjectStatus = 'Active' | 'Paused' | 'Inactive';

export interface Project {
  id: string;
  name: string;
  businessLabel: string;
  placeId: string;
  address: string;
  /** Business location from the address lookup; null when it couldn't be found. */
  lat: number | null;
  lng: number | null;
  status: ProjectStatus;
  lastRun: string | null;
  keywordCount: number;
  avgRank: number | null;
  avgRankTrend: number | null;
  visibility: number | null;
  visibilityTrend: number | null;
}

export interface RankHistoryPoint {
  date: string;
  avgRank: number;
  visibility: number;
}

export interface Keyword {
  id: string;
  text: string;
  avgRank: number | null;
  visibility: number | null;
  lastRun: string | null;
}

export interface KeywordRunSummary {
  id: string;
  date: string;
}

export interface PinRankPoint {
  pinId: string;
  /** null = checked, but the business wasn't in the top 20 (shown as "20+"). */
  rank: number | null;
  checkedAt: string;
}

export interface KeywordRunDetail {
  id: string;
  date: string;
  pinsTotal: number;
  pinsChecked: number;
  avgRank: number | null;
  avgRankTrend: number | null;
  visibility: number | null;
  visibilityTrend: number | null;
  /** Only pins that were checked in this run appear here. */
  pinResults: PinRankPoint[];
}

export interface Pin {
  id: string;
  lat: number;
  lng: number;
  enabled: boolean;
  lastCheckedAt: string | null;
}

export interface KeywordDetail extends Keyword {
  pinsTotal: number;
  runs: KeywordRunSummary[];
}

export interface KeywordRunResult {
  keyword: Keyword;
  run: KeywordRunDetail;
}

export interface Competitor {
  id: string;
  name: string;
  placeId: string | null;
  avgRank: number | null;
  visibility: number | null;
  reviewCount: number | null;
  reviewGrowthPerWeek: number | null;
}

export interface ProjectDetail extends Project {
  pinsTracked: number;
  pinsTotal: number;
  rankHistory: RankHistoryPoint[];
  keywords: Keyword[];
  competitors: Competitor[];
}

export interface NewProjectInput {
  name: string;
  businessLabel: string;
  placeId: string;
  address?: string;
}

export interface ProjectUpdateInput {
  name?: string;
  businessLabel?: string;
  placeId?: string;
  address?: string;
  status?: ProjectStatus;
}

export interface PinCompetitor {
  position: number;
  /** Position at this pin in the previous scan; null if it wasn't there or there's no previous scan. */
  previousPosition: number | null;
  /** True when there is a previous scan and this business wasn't in it. */
  isNew: boolean;
  placeId: string;
  name: string;
  rating: number | null;
  reviewCount: number | null;
  /** Reviews gained over the 7 days before this scan; null without an earlier observation. */
  reviewsGained: number | null;
  reviewsSince: string | null;
  isYou: boolean;
}

export interface PinInsights {
  /** This pin's rank in every run that checked it, oldest first. */
  history: { runId: string; date: string; rank: number | null }[];
  scan: { runId: string; checkedAt: string; rank: number | null } | null;
  previousScan: { runId: string; date: string; rank: number | null } | null;
  competitors: PinCompetitor[];
}

export interface PinBatchResult {
  pins: Pin[];
  /** Maps the temporary ids of newly added pins to their saved ids. */
  idMap: Record<string, string>;
}
