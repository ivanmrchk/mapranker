/**
 * What a pin shows for the selected run:
 * - a number: the business's position
 * - 'notFound': checked, but not in the top 20
 * - 'unchecked': no result for this pin in the run
 * - 'disabled': pin is switched off
 */
export type PinRankState = number | 'notFound' | 'unchecked' | 'disabled';

export const RANK_BANDS = [
  { label: '1–3', color: '#16a34a' },
  { label: '4–10', color: '#f59e0b' },
  { label: '11–20', color: '#dc2626' },
  { label: '20+', color: '#7f1d1d' },
  { label: 'Not checked', color: '#9ca3af' },
] as const;

export function rankColor(state: PinRankState): string {
  if (state === 'disabled' || state === 'unchecked') return '#9ca3af';
  if (state === 'notFound') return '#7f1d1d';
  if (state <= 3) return '#16a34a';
  if (state <= 10) return '#f59e0b';
  return '#dc2626';
}

/** Short text drawn inside the map marker. */
export function rankMarkerText(state: PinRankState): string {
  if (typeof state === 'number') return String(state);
  if (state === 'notFound') return '20+';
  return '';
}

export function rankDescription(state: PinRankState): string {
  if (typeof state === 'number') return `#${state}`;
  if (state === 'notFound') return 'Not in top 20';
  if (state === 'disabled') return 'Pin disabled';
  return 'Not checked in this run';
}
