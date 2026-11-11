import type { RankHistoryPoint } from '../types/project';
import { LineChart } from './LineChart';

function shortDate(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00`);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function niceRankDomain(values: number[]): [number, number] {
  const top = Math.max(1, Math.floor(Math.min(...values)) - 1);
  const bottom = Math.ceil(Math.max(...values));
  return [top, bottom];
}

export function TrendsCard({ history }: { history: RankHistoryPoint[] }) {
  if (history.length === 0) return null;

  const rankPoints = history.map((h) => ({ label: shortDate(h.date), value: h.avgRank }));
  const visibilityPoints = history.map((h) => ({ label: shortDate(h.date), value: h.visibility }));
  const [rankTop, rankBottom] = niceRankDomain(history.map((h) => h.avgRank));
  const rankTickCount = Math.max(3, Math.min(6, rankBottom - rankTop + 1));

  return (
    <div className="mt-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-bold text-gray-900">Project Trends</h2>

      <div className="mt-5 grid grid-cols-1 gap-8 sm:grid-cols-2">
        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
            Avg Rank Over Time
          </h3>
          <div className="mt-4">
            <LineChart
              points={rankPoints}
              color="#2563eb"
              domainTop={rankTop}
              domainBottom={rankBottom}
              tickCount={rankTickCount}
              formatTick={(v) => String(Math.round(v))}
              formatValue={(v) => `#${v}`}
            />
          </div>
        </div>

        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
            Visibility Over Time
          </h3>
          <div className="mt-4">
            <LineChart
              points={visibilityPoints}
              color="#16a34a"
              domainTop={100}
              domainBottom={0}
              tickCount={5}
              formatTick={(v) => `${Math.round(v)}%`}
              formatValue={(v) => `${v}%`}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
