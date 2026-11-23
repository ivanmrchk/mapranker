import { useEffect, useState } from 'react';
import type { ProjectCompetitor, ProjectCompetitors } from '../types/project';
import { api } from '../lib/api';
import { BusinessName } from './BusinessName';
import { RankMovement } from './RankMovement';
import { ReviewChange } from './ReviewChange';

type SortKey = 'avgRank' | 'movement' | 'visibility' | 'top20Share' | 'reviewCount' | 'reviewChange';

const COLUMNS: readonly { key: SortKey; label: string; hint: string }[] = [
  { key: 'visibility', label: 'Visibility', hint: '% of pins in the top 3, averaged over keywords' },
  { key: 'avgRank', label: 'Avg Rank', hint: 'Averaged over keywords; a pin outside the top 20 counts as 21' },
  { key: 'movement', label: 'Movement', hint: 'Spots gained or lost in average rank, on the pins scanned both times' },
  { key: 'top20Share', label: 'In Top 20', hint: '% of all pin checks where the business is in the top 20' },
  { key: 'reviewCount', label: 'Google Reviews', hint: "Reviews on the business's Google profile" },
  { key: 'reviewChange', label: 'Review Growth', hint: 'Change since the scan closest to a week earlier' },
];

const COLLAPSED_ROW_COUNT = 10;

interface CompetitorsCardProps {
  projectId: string;
  /** Adding or removing a keyword changes which scans are compared, so it reloads the data. */
  keywordCount: number;
}

/** Every business seen in the latest scan of each keyword, ranked against yours. */
export function CompetitorsCard({ projectId, keywordCount }: CompetitorsCardProps) {
  const [data, setData] = useState<ProjectCompetitors | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    api<ProjectCompetitors>(`/api/projects/${projectId}/competitors`)
      .then((loaded) => {
        if (!cancelled) setData(loaded);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, keywordCount]);

  return (
    <div className="mt-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-bold text-gray-900">Competitor Analysis</h2>
      {error && <p className="mt-2 text-sm text-red-600">Couldn't load competitors: {error}</p>}
      {!error && !data && <p className="mt-2 text-sm text-gray-400">Loading competitors…</p>}
      {data && data.competitors.length === 0 && (
        <p className="mt-2 text-sm text-gray-400">No competitor data yet. Run a keyword to see who ranks.</p>
      )}
      {data && data.competitors.length > 0 && <CompetitorsTable data={data} />}
    </div>
  );
}

function CompetitorsTable({ data }: { data: ProjectCompetitors }) {
  const [sortKey, setSortKey] = useState<SortKey>('visibility');
  const [showAll, setShowAll] = useState(false);

  const ranked = [...data.competitors]
    .sort((a, b) => compareBestFirst(a, b, sortKey))
    .map((competitor, i) => ({ competitor, place: i + 1 }));
  // Your own row always shows, at its real place, even below the collapsed list.
  const visible = showAll
    ? ranked
    : ranked.filter(({ competitor, place }) => place <= COLLAPSED_ROW_COUNT || competitor.isYou);
  const youListed = data.competitors.some((c) => c.isYou);

  return (
    <>
      <p className="mt-1 text-sm text-gray-400">{describeScans(data)} Click a column to sort by it.</p>
      <p className="text-sm text-gray-400">{describeComparison(data)}</p>
      {!youListed && (
        <p className="mt-3 rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-500">
          Your business isn't in the top 20 at any pin in these scans.
        </p>
      )}
      <div className="mt-5 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-400">
              <th className="pb-2 pr-3 pl-2 font-semibold">#</th>
              <th className="pb-2 pr-3 font-semibold">Business</th>
              {COLUMNS.map(({ key, label, hint }) => (
                <th key={key} className="pb-2 pr-3 font-semibold" aria-sort={sortAria(key, sortKey)}>
                  <button
                    type="button"
                    title={hint}
                    onClick={() => setSortKey(key)}
                    className={`whitespace-nowrap uppercase tracking-wide hover:text-gray-700 ${
                      key === sortKey ? 'text-gray-900' : ''
                    }`}
                  >
                    {label}
                    {key === sortKey && ' ↓'}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {visible.map(({ competitor, place }) => (
              <CompetitorRow key={competitor.placeId} competitor={competitor} place={place} />
            ))}
          </tbody>
        </table>
      </div>
      {ranked.length > COLLAPSED_ROW_COUNT && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="mt-3 text-sm font-semibold text-blue-600 hover:underline"
        >
          {showAll ? `Show top ${COLLAPSED_ROW_COUNT}` : `Show all ${ranked.length}`}
        </button>
      )}
    </>
  );
}

function CompetitorRow({ competitor: c, place }: { competitor: ProjectCompetitor; place: number }) {
  return (
    <tr className={c.isYou ? 'bg-blue-50' : undefined}>
      <td className="py-3 pr-3 pl-2 text-gray-400">{place}</td>
      <td className="py-3 pr-3">
        <span className={c.isYou ? 'font-bold text-blue-700' : 'font-medium text-gray-900'}>
          <BusinessName business={c} />
        </span>
        {c.isYou && <span className="text-blue-500"> (you)</span>}
        {c.rating !== null && <span className="ml-2 text-xs text-gray-400">★ {c.rating.toFixed(1)}</span>}
      </td>
      <td className="py-3 pr-3 text-gray-700">{c.visibility}%</td>
      <td className="py-3 pr-3 text-gray-700">#{c.avgRank}</td>
      <td className="py-3 pr-3">
        <RankMovement movement={c.movement} />
      </td>
      <td className="py-3 pr-3 text-gray-700">{c.top20Share}%</td>
      <td className="py-3 pr-3 text-gray-700">{c.reviewCount?.toLocaleString('en-US') ?? '—'}</td>
      <td className="py-3 pr-3 text-gray-700">
        {c.reviewChange === null ? (
          '—'
        ) : (
          <ReviewChange change={c.reviewChange} since={c.reviewsSince} seenAt={c.reviewsSeenAt} />
        )}
      </td>
    </tr>
  );
}

/** Best first: a lower average rank is better, everything else higher. Missing values go last. */
function compareBestFirst(a: ProjectCompetitor, b: ProjectCompetitor, key: SortKey): number {
  const [valueA, valueB] = [sortValue(a, key), sortValue(b, key)];
  if (valueA === null || valueB === null) {
    if (valueA !== valueB) return valueA === null ? 1 : -1;
  } else if (valueA !== valueB) {
    return key === 'avgRank' ? valueA - valueB : valueB - valueA;
  }
  return a.avgRank - b.avgRank || a.name.localeCompare(b.name);
}

function sortValue(competitor: ProjectCompetitor, key: SortKey): number | null {
  return key === 'movement' ? (competitor.movement?.spotsGained ?? null) : competitor[key];
}

function sortAria(key: SortKey, sortKey: SortKey) {
  if (key !== sortKey) return undefined;
  return key === 'avgRank' ? 'ascending' : 'descending';
}

function describeScans({ scans }: ProjectCompetitors): string {
  const pinChecks = scans.reduce((total, s) => total + s.pinsChecked, 0);
  const days = scans.map((s) => s.date).sort();
  const [oldest, newest] = [shortDay(days[0]), shortDay(days[days.length - 1])];
  const when = oldest === newest ? oldest : `${oldest} – ${newest}`;
  const keywords = scans.length === 1 ? '1 keyword' : `${scans.length} keywords`;
  return `Latest scan of ${keywords} (${when}), ${pinChecks} pin checks.`;
}

function describeComparison({ scans, comparison }: ProjectCompetitors): string {
  const { pinChecksCompared, keywordsCompared, daysApart } = comparison;
  if (daysApart === null) return 'Movement shows once a keyword has been scanned on two different days.';
  const days = daysApart <= 1 ? 'a day' : `${daysApart} days`;
  return `Movement compares with about ${days} earlier: ${pinChecksCompared} pin checks made both times, in ${keywordsCompared} of ${scans.length} keywords.`;
}

function shortDay(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
