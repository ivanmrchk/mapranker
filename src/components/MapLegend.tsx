import { RANK_BANDS } from '../lib/rank';

export function MapLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
      {RANK_BANDS.map((band) => (
        <span key={band.label} className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: band.color }} />
          {band.label}
        </span>
      ))}
      <span className="flex items-center gap-1.5">
        <svg width="10" height="13" viewBox="0 0 24 32" aria-hidden="true">
          <path d="M12 31C12 31 22 18.5 22 11A10 10 0 0 0 2 11C2 18.5 12 31 12 31Z" fill="#2563eb" />
        </svg>
        Business
      </span>
    </div>
  );
}
