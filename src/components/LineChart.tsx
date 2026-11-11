import { useState, type PointerEvent } from 'react';

interface LineChartPoint {
  label: string;
  value: number;
  /** Shown in the hover tooltip instead of `label` when given. */
  detail?: string;
}

interface LineChartProps {
  points: LineChartPoint[];
  color: string;
  domainTop: number;
  domainBottom: number;
  tickCount?: number;
  /** At most this many x-axis labels are drawn (always including the latest point). */
  maxXLabels?: number;
  formatTick?: (value: number) => string;
  formatValue?: (value: number) => string;
}

const VIEW_WIDTH = 320;
const VIEW_HEIGHT = 180;
const PAD_LEFT = 30;
// Room for half of the last x-axis label (e.g. "11/11"), which is centered on the last point.
const PAD_RIGHT = 14;
const PAD_TOP = 10;
const PAD_BOTTOM = 20;
const PLOT_WIDTH = VIEW_WIDTH - PAD_LEFT - PAD_RIGHT;
const PLOT_HEIGHT = VIEW_HEIGHT - PAD_TOP - PAD_BOTTOM;

export function LineChart({
  points,
  color,
  domainTop,
  domainBottom,
  tickCount = 4,
  maxXLabels = 8,
  formatTick = (v) => String(v),
  formatValue = (v) => String(v),
}: LineChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const labelStep = Math.max(1, Math.ceil(points.length / maxXLabels));

  const x = (i: number) =>
    PAD_LEFT + (points.length === 1 ? PLOT_WIDTH / 2 : (i / (points.length - 1)) * PLOT_WIDTH);
  const y = (value: number) =>
    PAD_TOP + ((value - domainTop) / (domainBottom - domainTop)) * PLOT_HEIGHT;

  const ticks = Array.from({ length: tickCount }, (_, i) =>
    domainTop + (i / (tickCount - 1)) * (domainBottom - domainTop),
  );

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(p.value)}`).join(' ');

  function handlePointerMove(e: PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * VIEW_WIDTH;
    const ratio = (relX - PAD_LEFT) / PLOT_WIDTH;
    const idx = Math.round(ratio * (points.length - 1));
    setHoverIndex(Math.min(points.length - 1, Math.max(0, idx)));
  }

  const hovered = hoverIndex !== null ? points[hoverIndex] : null;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
        className="w-full touch-none"
        onPointerMove={handlePointerMove}
        onPointerLeave={() => setHoverIndex(null)}
      >
        {ticks.map((tick, i) => (
          <g key={i}>
            <line
              x1={PAD_LEFT}
              x2={VIEW_WIDTH - PAD_RIGHT}
              y1={y(tick)}
              y2={y(tick)}
              stroke="#e5e7eb"
              strokeWidth={1}
            />
            <text
              x={PAD_LEFT - 6}
              y={y(tick)}
              textAnchor="end"
              dominantBaseline="middle"
              className="fill-gray-400"
              fontSize={9}
            >
              {formatTick(tick)}
            </text>
          </g>
        ))}

        {points.map((p, i) =>
          (points.length - 1 - i) % labelStep === 0 ? (
            <text
              key={i}
              x={x(i)}
              y={VIEW_HEIGHT - 4}
              textAnchor="middle"
              className="fill-gray-400"
              fontSize={9}
            >
              {p.label}
            </text>
          ) : null,
        )}

        {hoverIndex !== null && (
          <line
            x1={x(hoverIndex)}
            x2={x(hoverIndex)}
            y1={PAD_TOP}
            y2={VIEW_HEIGHT - PAD_BOTTOM}
            stroke="#9ca3af"
            strokeWidth={1}
            strokeDasharray="3 3"
          />
        )}

        <path
          d={linePath}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {points.map((p, i) => (
          <circle
            key={i}
            cx={x(i)}
            cy={y(p.value)}
            r={hoverIndex === i ? 5 : 4}
            fill="white"
            stroke={color}
            strokeWidth={2}
          />
        ))}
      </svg>

      {hovered && hoverIndex !== null && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[calc(100%+10px)] whitespace-nowrap rounded-md border border-gray-200 bg-white px-2 py-1 text-xs shadow-md"
          style={{
            left: `${(x(hoverIndex) / VIEW_WIDTH) * 100}%`,
            top: `${(y(hovered.value) / VIEW_HEIGHT) * 100}%`,
          }}
        >
          <div className="font-semibold text-gray-900">{formatValue(hovered.value)}</div>
          <div className="text-gray-400">{hovered.detail ?? hovered.label}</div>
        </div>
      )}
    </div>
  );
}
