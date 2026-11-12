interface RunControlsProps {
  /** Progress of the run in progress; null when no run is going. */
  activeRun: { pinsChecked: number; pinsTotal: number } | null;
  isRunInProgress: boolean;
  isStarting: boolean;
  isStopping: boolean;
  /** Why a run can't start right now, or null when it can. */
  startBlockedReason: string | null;
  onStart: () => void;
  onStop: () => void;
}

/** "Run All Pins", or, while a run is going, its progress and a Stop button. */
export function RunControls({
  activeRun,
  isRunInProgress,
  isStarting,
  isStopping,
  startBlockedReason,
  onStart,
  onStop,
}: RunControlsProps) {
  if (!isRunInProgress) {
    return (
      <button
        type="button"
        onClick={onStart}
        disabled={isStarting || startBlockedReason !== null}
        title={startBlockedReason ?? undefined}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
      >
        {isStarting ? 'Starting…' : 'Run All Pins'}
      </button>
    );
  }

  const percent = activeRun && activeRun.pinsTotal > 0 ? (activeRun.pinsChecked / activeRun.pinsTotal) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={onStop}
        disabled={isStopping}
        className="rounded-md border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isStopping ? 'Stopping…' : 'Stop Run'}
      </button>
      <div className="w-56">
        <div className="flex justify-between text-xs text-gray-500">
          <span>{isStopping ? 'Finishing the current pin…' : 'Checking pins…'}</span>
          {activeRun && (
            <span className="font-medium text-gray-700">
              {activeRun.pinsChecked} / {activeRun.pinsTotal}
            </span>
          )}
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-200">
          <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${percent}%` }} />
        </div>
      </div>
    </div>
  );
}
