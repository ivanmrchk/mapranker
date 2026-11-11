import type { EditablePin } from './KeywordMapPage';
import { rankColor, rankDescription, type PinRankState } from '../lib/rank';
import { PinInsightsSection } from './PinInsightsSection';

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
  rankState: PinRankState;
  projectId: string;
  keywordId: string;
  keywordText: string;
  /** The run being viewed; competitor data is shown for this run. */
  runId: string | null;
  /** When this pin was checked in the viewed run; a change reloads the pin history. */
  resultCheckedAt: string | null;
  editing: boolean;
  isChecking: boolean;
  onCheck: (pinId: string) => void;
  onToggleEnabled: (pinId: string) => void;
  onDelete: (pinId: string) => void;
}

export function PinInspectionPanel({
  pin,
  rankState,
  projectId,
  keywordId,
  keywordText,
  runId,
  resultCheckedAt,
  editing,
  isChecking,
  onCheck,
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

  const checkBlockedReason = editing
    ? 'Save or cancel your pin edits first.'
    : pin.isNew
      ? 'Save this pin before checking it.'
      : !pin.enabled
        ? 'Enable this pin to check it.'
        : null;

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
          <dt className="text-xs text-gray-400">Ranking (selected run)</dt>
          <dd className="flex items-center gap-2 font-medium text-gray-900">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ background: rankColor(rankState) }}
            />
            {pin.isNew ? 'Not saved yet' : rankDescription(rankState)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-gray-400">Last Checked</dt>
          <dd className="font-medium text-gray-900">{formatDate(pin.lastCheckedAt)}</dd>
        </div>
        <div>
          <dt className="text-xs text-gray-400">Coordinates</dt>
          <dd className="font-medium text-gray-900">
            {pin.lat.toFixed(5)}, {pin.lng.toFixed(5)}
          </dd>
        </div>
      </dl>

      <div className="mt-6">
        <button
          type="button"
          onClick={() => onCheck(pin.id)}
          disabled={checkBlockedReason !== null || isChecking}
          className="w-full rounded-md bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
        >
          {isChecking ? 'Checking…' : 'Check This Pin'}
        </button>
        <p className="mt-1.5 text-[11px] text-gray-400">
          {checkBlockedReason ??
            `Checks “${keywordText}” at this pin now and updates the latest run.`}
        </p>
      </div>

      <div className="mt-5 flex flex-col gap-2 border-t border-gray-100 pt-5">
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
          <p className="text-xs text-gray-400">
            Use Edit Pins to move, disable, or remove this pin.
          </p>
        )}
      </div>

      {!pin.isNew && (
        <PinInsightsSection
          key={pin.id}
          projectId={projectId}
          keywordId={keywordId}
          pinId={pin.id}
          runId={runId}
          resultVersion={resultCheckedAt}
        />
      )}
    </div>
  );
}
