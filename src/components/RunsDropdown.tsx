import type { KeywordRunSummary, RunStatus } from '../types/project';

const STATUS_SUFFIX: Record<RunStatus, string> = {
  Running: ' (running…)',
  Completed: '',
  Stopped: ' (stopped)',
};

function formatRunLabel(isoDate: string): string {
  return new Date(isoDate).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

interface RunsDropdownProps {
  runs: KeywordRunSummary[];
  selectedRunId: string | null;
  onChange: (runId: string) => void;
}

export function RunsDropdown({ runs, selectedRunId, onChange }: RunsDropdownProps) {
  if (runs.length === 0) {
    return (
      <span className="text-sm text-gray-400">No runs yet</span>
    );
  }

  return (
    <select
      value={selectedRunId ?? ''}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      {runs.map((run) => (
        <option key={run.id} value={run.id}>
          {formatRunLabel(run.date)}
          {STATUS_SUFFIX[run.status]}
        </option>
      ))}
    </select>
  );
}
