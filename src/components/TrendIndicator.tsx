export type TrendDirection = 'lowerIsBetter' | 'higherIsBetter';

interface TrendIndicatorProps {
  value: number | null;
  direction: TrendDirection;
}

export function TrendIndicator({ value, direction }: TrendIndicatorProps) {
  if (value === null || value === 0) {
    return <span className="text-xs text-gray-400">—</span>;
  }

  const isGood =
    direction === 'higherIsBetter' ? value > 0 : value < 0;
  const isUp = value > 0;

  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-medium ${
        isGood ? 'text-green-600' : 'text-red-500'
      }`}
    >
      {isUp ? '↗' : '↘'} {value > 0 ? '+' : ''}
      {value}
    </span>
  );
}
