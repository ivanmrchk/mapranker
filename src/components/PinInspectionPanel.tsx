import type { EditablePin } from './KeywordMapPage';

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

interface PinInspectionPanelProps {
  pin: EditablePin | null;
  rank: number | null;
  editing: boolean;
  onToggleEnabled: (pinId: string) => void;
  onDelete: (pinId: string) => void;
}

export function PinInspectionPanel({
  pin,
  rank,
  editing,
  onToggleEnabled,
  onDelete,
}: PinInspectionPanelProps) {
  if (!pin) {
    return (
      <div className="flex h-full items-center justify-center p-5 text-center">
        <p className="text-sm text-gray-400">Pick a pin for inspection.</p>
      </div>
    );
  }

  const rankLabel = !pin.enabled
    ? 'Pin disabled'
    : pin.isNew
      ? 'Not yet scanned'
      : rank !== null
        ? `#${rank}`
        : 'Not checked in this run';

  return (
    <div className="p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-900">{pin.isNew ? 'New Pin' : 'Pin'}</h3>
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
            pin.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
          }`}
        >
          {pin.enabled ? 'Enabled' : 'Disabled'}
        </span>
      </div>

      <dl className="mt-4 space-y-3 text-sm">
        <div>
          <dt className="text-xs text-gray-400">Coordinates</dt>
          <dd className="font-medium text-gray-900">
            {pin.lat.toFixed(5)}, {pin.lng.toFixed(5)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-gray-400">Ranking (selected run)</dt>
          <dd className="font-medium text-gray-900">{rankLabel}</dd>
        </div>
        <div>
          <dt className="text-xs text-gray-400">Last Checked</dt>
          <dd className="font-medium text-gray-900">{formatDate(pin.lastCheckedAt)}</dd>
        </div>
      </dl>

      <div className="mt-6 flex flex-col gap-2">
        {editing ? (
          <>
            <button
              type="button"
              onClick={() => onToggleEnabled(pin.id)}
              className="rounded-md border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
            >
              {pin.enabled ? 'Disable Pin' : 'Enable Pin'}
            </button>
            <button
              type="button"
              onClick={() => onDelete(pin.id)}
              className="rounded-md border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50"
            >
              Remove Pin
            </button>
          </>
        ) : (
          <p className="text-xs text-gray-400">Enter edit mode to enable, disable, or remove this pin.</p>
        )}
      </div>
    </div>
  );
}
