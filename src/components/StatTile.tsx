import { TrendIndicator, type TrendDirection } from './TrendIndicator';

interface StatTileProps {
  label: string;
  value: string;
  trend?: {
    value: number | null;
    direction: TrendDirection;
  };
}

export function StatTile({ label, value, trend }: StatTileProps) {
  return (
    <div className="rounded-lg bg-gray-100 px-3 py-2">
      <div className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
        {label}
      </div>
      <div className="mt-1 flex items-center justify-between">
        <span className="text-sm font-bold text-gray-900">{value}</span>
        {trend && <TrendIndicator value={trend.value} direction={trend.direction} />}
      </div>
    </div>
  );
}
