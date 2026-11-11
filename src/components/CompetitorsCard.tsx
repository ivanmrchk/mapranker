import type { Competitor } from '../types/project';

function formatGrowth(value: number | null): string {
  if (value === null) return '—';
  return `${value > 0 ? '+' : ''}${value}/wk`;
}

export function CompetitorsCard({ competitors }: { competitors: Competitor[] }) {
  return (
    <div className="mt-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-bold text-gray-900">Competitor Analysis</h2>
      <p className="mt-1 text-sm text-gray-400">
        Top competitors ranking for your tracked keywords across your active pins.
      </p>

      {competitors.length === 0 ? (
        <p className="mt-6 text-sm text-gray-400">No competitor data yet.</p>
      ) : (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                <th className="pb-2 pr-3 font-semibold">Competitor</th>
                <th className="pb-2 pr-3 font-semibold">Avg Rank</th>
                <th className="pb-2 pr-3 font-semibold">Visibility</th>
                <th className="pb-2 pr-3 font-semibold">Reviews</th>
                <th className="pb-2 pl-3 font-semibold">Review Growth / wk</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {competitors.map((competitor) => (
                <tr key={competitor.id}>
                  <td className="py-3 pr-3 font-medium text-gray-900">{competitor.name}</td>
                  <td className="py-3 pr-3 text-gray-700">
                    {competitor.avgRank !== null ? `#${competitor.avgRank}` : '—'}
                  </td>
                  <td className="py-3 pr-3 text-gray-700">
                    {competitor.visibility !== null ? `${competitor.visibility}%` : '—'}
                  </td>
                  <td className="py-3 pr-3 text-gray-700">
                    {competitor.reviewCount !== null ? competitor.reviewCount : '—'}
                  </td>
                  <td className="py-3 pl-3 text-gray-700">
                    {formatGrowth(competitor.reviewGrowthPerWeek)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
