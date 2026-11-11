import type { ProjectStatus } from '../types/project';

const STATUS_STYLES: Record<ProjectStatus, string> = {
  Active: 'bg-blue-600 text-white',
  Paused: 'bg-gray-300 text-gray-700',
  Inactive: 'bg-gray-200 text-gray-500',
};

export function StatusBadge({ status }: { status: ProjectStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLES[status]}`}
    >
      {status}
    </span>
  );
}
