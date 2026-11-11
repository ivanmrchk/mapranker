import { useState } from 'react';
import type { ProjectDetail, ProjectStatus, ProjectUpdateInput } from '../types/project';

const STATUSES: { value: ProjectStatus; hint: string }[] = [
  { value: 'Active', hint: 'Included in the weekly scheduled run' },
  { value: 'Paused', hint: 'Skipped by the schedule; manual runs still work' },
  { value: 'Inactive', hint: 'Archived' },
];

interface EditProjectModalProps {
  project: ProjectDetail;
  onClose: () => void;
  onSave: (input: ProjectUpdateInput) => Promise<void>;
}

/** Mount only while open, so the form starts from the project's current values. */
export function EditProjectModal({ project, onClose, onSave }: EditProjectModalProps) {
  const [form, setForm] = useState<Required<ProjectUpdateInput>>({
    name: project.name,
    businessLabel: project.businessLabel,
    placeId: project.placeId,
    address: project.address,
    status: project.status,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addressChanged = form.address.trim() !== project.address;
  const canSave = form.name.trim() && form.businessLabel.trim() && form.placeId.trim();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave || isSaving) return;
    setIsSaving(true);
    setError(null);
    try {
      await onSave({
        name: form.name.trim(),
        businessLabel: form.businessLabel.trim(),
        placeId: form.placeId.trim(),
        address: form.address.trim(),
        status: form.status,
      });
    } catch (err) {
      setError((err as Error).message);
      setIsSaving(false);
    }
  }

  const inputClass =
    'mb-4 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Edit Project</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <label className="mb-1 block text-sm font-medium text-gray-700">Name</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className={inputClass}
          />

          <label className="mb-1 block text-sm font-medium text-gray-700">Business Label</label>
          <input
            type="text"
            value={form.businessLabel}
            onChange={(e) => setForm({ ...form, businessLabel: e.target.value })}
            className={inputClass}
          />

          <label className="mb-1 block text-sm font-medium text-gray-700">Tracked Place ID</label>
          <input
            type="text"
            value={form.placeId}
            onChange={(e) => setForm({ ...form, placeId: e.target.value })}
            className={inputClass}
          />

          <label className="mb-1 block text-sm font-medium text-gray-700">Address</label>
          <input
            type="text"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            className={`${inputClass} ${addressChanged ? '!mb-1' : ''}`}
          />
          {addressChanged && (
            <p className="mb-4 text-xs text-gray-400">
              The business location will be looked up again. Existing pins stay where they are; use
              Generate Grid on a keyword map to re-center them.
            </p>
          )}

          <label className="mb-1 block text-sm font-medium text-gray-700">Status</label>
          <select
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value as ProjectStatus })}
            className="mb-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.value}
              </option>
            ))}
          </select>
          <p className="mb-6 text-xs text-gray-400">
            {STATUSES.find((s) => s.value === form.status)?.hint}
          </p>

          {error && (
            <p role="alert" className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={!canSave || isSaving}
            className="w-full rounded-md bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
          >
            {isSaving ? 'Saving…' : 'Save Changes'}
          </button>
        </form>
      </div>
    </div>
  );
}
