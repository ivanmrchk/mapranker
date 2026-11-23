import { formatDateTime } from '../lib/formatDateTime';

const DAY_MS = 86_400_000;

interface ReviewChangeProps {
  /** Reviews gained (negative: lost) since `since`; null without an earlier observation. */
  change: number | null;
  since: string | null;
  /** When the current count was seen. */
  seenAt: string;
}

/** How much the review count changed, and over how many days (scans aren't always a week apart). */
export function ReviewChange({ change, since, seenAt }: ReviewChangeProps) {
  if (change === null || since === null) return null;
  const days = Math.max(1, Math.round((Date.parse(seenAt) - Date.parse(since)) / DAY_MS));
  const { text, color } = changeDisplay(change);
  return (
    <div className="text-[11px]" title={`Since ${formatDateTime(since)}`}>
      <span className={color}>{text}</span> <span className="text-[10px] text-gray-400">in {days}d</span>
    </div>
  );
}

function changeDisplay(change: number): { text: string; color: string } {
  if (change > 0) return { text: `▲${change}`, color: 'font-semibold text-green-600' };
  if (change < 0) return { text: `▼${-change}`, color: 'font-semibold text-red-500' };
  return { text: '+0', color: 'text-gray-400' };
}
