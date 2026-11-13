import { useEffect, useState } from 'react';
import type { PinCompetitor, PinInsights } from '../types/project';
import { api } from '../lib/api';
import { LineChart } from './LineChart';
import { rankAxis } from '../lib/rank';
import { businessProfileUrl } from '../lib/mapsUrl';

/** A rank that wasn't in the top 20 is plotted one step below it. */
const NOT_FOUND_VALUE = 21;

function shortDate(iso: string) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function longDate(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function RankHistoryChart({ history }: { history: PinInsights['history'] }) {
  if (history.length === 0) {
    return <p className="mt-2 text-xs text-gray-400">No checks at this pin yet.</p>;
  }
  const values = history.map((h) => h.rank ?? NOT_FOUND_VALUE);
  const { top, bottom, tickCount } = rankAxis(values, NOT_FOUND_VALUE);
  const sameDay = new Set(history.map((h) => shortDate(h.date))).size < history.length;
  return (
    <div className="mt-2">
      <LineChart
        points={history.map((h, i) => ({
          label: sameDay ? `${shortDate(h.date)} ${new Date(h.date).getHours()}h` : shortDate(h.date),
          value: values[i],
          detail: longDate(h.date),
        }))}
        color="#2563eb"
        domainTop={top}
        domainBottom={bottom}
        tickCount={tickCount}
        maxXLabels={6}
        formatTick={(v) => (v > NOT_FOUND_VALUE - 0.5 ? '20+' : String(Math.round(v)))}
        formatValue={(v) => (v >= NOT_FOUND_VALUE ? 'Not in top 20' : `#${v}`)}
      />
    </div>
  );
}

/** The business name, linked to its Google Maps profile when its ID allows one. */
function BusinessName({ c }: { c: PinCompetitor }) {
  const profileUrl = businessProfileUrl(c);
  if (!profileUrl) return <>{c.name}</>;
  return (
    <a
      href={profileUrl}
      target="_blank"
      rel="noopener noreferrer"
      title="Open the Google Maps profile"
      className="hover:underline"
    >
      {c.name}
    </a>
  );
}

function Movement({ c, hasPrevious }: { c: PinCompetitor; hasPrevious: boolean }) {
  if (!hasPrevious) return null;
  if (c.isNew) {
    return <span className="text-[10px] font-bold text-blue-600" title="Not in the top 20 last scan">NEW</span>;
  }
  if (c.previousPosition === null || c.previousPosition === c.position) {
    return <span className="text-[11px] text-gray-300" title="Same spot as last scan">–</span>;
  }
  const up = c.position < c.previousPosition;
  const by = Math.abs(c.position - c.previousPosition);
  return (
    <span
      className={`text-[11px] font-semibold ${up ? 'text-green-600' : 'text-red-500'}`}
      title={`Was #${c.previousPosition}`}
    >
      {up ? '▲' : '▼'}
      {by}
    </span>
  );
}

function ReviewGrowth({ c }: { c: PinCompetitor }) {
  if (c.reviewsGained === null) return null;
  const since = c.reviewsSince ? `since ${longDate(c.reviewsSince)}` : '';
  if (c.reviewsGained === 0) {
    return <span className="text-[11px] text-gray-300" title={`No new reviews ${since}`}>+0</span>;
  }
  return (
    <span className="text-[11px] font-semibold text-green-600" title={`${c.reviewsGained} new reviews ${since}`}>
      ▲{c.reviewsGained}
    </span>
  );
}

function CompetitorsTable({ insights }: { insights: PinInsights }) {
  const { competitors, previousScan, scan } = insights;
  if (!scan) {
    return <p className="mt-2 text-xs text-gray-400">This pin wasn't checked in the selected run.</p>;
  }
  if (competitors.length === 0) {
    return (
      <p className="mt-2 text-xs text-gray-400">
        No results list was saved for this check. Run the pin again to see competitors.
      </p>
    );
  }
  const youListed = competitors.some((c) => c.isYou);
  return (
    <>
      <p className="mt-0.5 text-[11px] text-gray-400">
        {previousScan
          ? `Movement vs. the scan on ${longDate(previousScan.date)}. Reviews: last 7 days.`
          : 'First scan with competitor data at this pin. Movement shows from the next scan.'}
      </p>
      <table className="mt-2 w-full text-xs">
        <thead>
          <tr className="border-b border-gray-200 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-400">
            <th className="pb-1.5 pr-2 font-semibold">#</th>
            <th className="pb-1.5 pr-2 font-semibold">Business</th>
            <th className="pb-1.5 text-right font-semibold">Reviews</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {competitors.map((c) => (
            <tr key={c.placeId} className={c.isYou ? 'bg-blue-50' : undefined}>
              <td className="whitespace-nowrap py-1.5 pl-1 pr-2 align-top">
                <span className="font-semibold text-gray-900">{c.position}</span>{' '}
                <Movement c={c} hasPrevious={previousScan !== null} />
              </td>
              <td className="py-1.5 pr-2 align-top">
                <div className={`leading-tight ${c.isYou ? 'font-bold text-blue-700' : 'font-medium text-gray-900'}`}>
                  <BusinessName c={c} />
                  {c.isYou && <span className="font-normal text-blue-500"> (you)</span>}
                </div>
                {c.rating !== null && (
                  <div className="text-[10px] text-gray-400">★ {c.rating.toFixed(1)}</div>
                )}
              </td>
              <td className="whitespace-nowrap py-1.5 pr-1 text-right align-top">
                <div className="text-gray-700">{c.reviewCount ?? '—'}</div>
                <ReviewGrowth c={c} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!youListed && (
        <p className="mt-2 rounded-md bg-gray-50 px-2 py-1.5 text-[11px] text-gray-500">
          Your business isn't in the top 20 at this pin.
        </p>
      )}
    </>
  );
}

interface PinInsightsSectionProps {
  projectId: string;
  keywordId: string;
  pinId: string;
  runId: string | null;
  /** Changes when this pin's result changes (e.g. after Check This Pin), to reload. */
  resultVersion: string | null;
}

export function PinInsightsSection({
  projectId,
  keywordId,
  pinId,
  runId,
  resultVersion,
}: PinInsightsSectionProps) {
  const [insights, setInsights] = useState<PinInsights | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    const query = runId ? `?runId=${encodeURIComponent(runId)}` : '';
    api<PinInsights>(`/api/projects/${projectId}/keywords/${keywordId}/pins/${pinId}/insights${query}`)
      .then((data) => {
        if (!cancelled) setInsights(data);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, keywordId, pinId, runId, resultVersion]);

  if (error) {
    return <p className="mt-5 text-xs text-red-600">Couldn't load pin history: {error}</p>;
  }
  // The parent remounts this per pin (key={pinId}), so this only shows on first load.
  if (!insights) {
    return <p className="mt-5 text-xs text-gray-400">Loading pin history…</p>;
  }

  return (
    <>
      <section className="mt-5 border-t border-gray-100 pt-5">
        <h4 className="text-xs font-bold uppercase tracking-wide text-gray-500">Rank at This Pin</h4>
        <RankHistoryChart history={insights.history} />
      </section>
      <section className="mt-5 border-t border-gray-100 pt-5">
        <h4 className="text-xs font-bold uppercase tracking-wide text-gray-500">Competitors at This Pin</h4>
        <CompetitorsTable insights={insights} />
      </section>
    </>
  );
}
