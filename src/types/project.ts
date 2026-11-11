export type ProjectStatus = 'Active' | 'Paused' | 'Inactive';

export interface Project {
  id: string;
  name: string;
  businessLabel: string;
  placeId: string;
  address: string;
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
  rank: number | null;
}

export interface KeywordRunDetail {
  id: string;
  date: string;
  pinsTotal: number;
  pinsChecked: number;
  avgRank: number | null;
  avgRankTrend: number | null;
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
