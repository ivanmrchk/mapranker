import { useState } from 'react';
import {
  DEFAULT_GRID_SIZE,
  DEFAULT_GRID_SPACING_KM,
  GRID_SIZES,
  GRID_SPACINGS_KM,
} from '../lib/grid';

export interface GridOptions {
  size: number;
  spacingKm: number;
  centerOn: 'business' | 'map';
}

interface GridModalProps {
  isOpen: boolean;
  hasBusinessLocation: boolean;
  currentPinCount: number;
  onClose: () => void;
  onGenerate: (options: GridOptions) => void;
}

export function GridModal({
  isOpen,
  hasBusinessLocation,
  currentPinCount,
  onClose,
  onGenerate,
}: GridModalProps) {
  const [size, setSize] = useState<number>(DEFAULT_GRID_SIZE);
  const [spacingKm, setSpacingKm] = useState<number>(DEFAULT_GRID_SPACING_KM);
  const [centerOn, setCenterOn] = useState<GridOptions['centerOn']>(
    hasBusinessLocation ? 'business' : 'map',
  );

  if (!isOpen) return null;

  const effectiveCenter = hasBusinessLocation ? centerOn : 'map';
  const spanKm = (size - 1) * spacingKm;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onGenerate({ size, spacingKm, centerOn: effectiveCenter });
  }

  const selectClass =
    'w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Generate Pin Grid</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm font-medium text-gray-700">
              Grid size
              <select
                value={size}
                onChange={(e) => setSize(Number(e.target.value))}
                className={`mt-1 ${selectClass}`}
              >
                {GRID_SIZES.map((s) => (
                  <option key={s} value={s}>
                    {s} × {s} ({s * s} pins)
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium text-gray-700">
              Spacing
              <select
                value={spacingKm}
                onChange={(e) => setSpacingKm(Number(e.target.value))}
                className={`mt-1 ${selectClass}`}
              >
                {GRID_SPACINGS_KM.map((km) => (
                  <option key={km} value={km}>
                    {km} km
                  </option>
                ))}
              </select>
            </label>
          </div>

          <fieldset>
            <legend className="text-sm font-medium text-gray-700">Center on</legend>
            <div className="mt-1 space-y-1.5 text-sm text-gray-700">
              <label className={`flex items-center gap-2 ${hasBusinessLocation ? '' : 'opacity-50'}`}>
                <input
                  type="radio"
                  checked={effectiveCenter === 'business'}
                  disabled={!hasBusinessLocation}
                  onChange={() => setCenterOn('business')}
                />
                Business location
                {!hasBusinessLocation && (
                  <span className="text-xs text-gray-400">(address not found)</span>
                )}
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={effectiveCenter === 'map'}
                  onChange={() => setCenterOn('map')}
                />
                Current map center
              </label>
            </div>
          </fieldset>

          <p className="rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-500">
            Covers about {spanKm} × {spanKm} km.
            {currentPinCount > 0 &&
              ` Replaces the ${currentPinCount} current pins; their past results stay in run history.`}{' '}
            Nothing is saved until you click Save.
          </p>

          <button
            type="submit"
            className="w-full rounded-md bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Generate Grid
          </button>
        </form>
      </div>
    </div>
  );
}
