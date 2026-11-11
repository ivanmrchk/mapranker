import { useEffect, useState } from 'react';
import type { Project } from '../types/project';

interface DeleteProjectModalProps {
  project: Project | null;
  onClose: () => void;
  onConfirm: (project: Project) => void;
}

export function DeleteProjectModal({ project, onClose, onConfirm }: DeleteProjectModalProps) {
  const [confirmText, setConfirmText] = useState('');

  useEffect(() => {
    setConfirmText('');
  }, [project]);

  if (!project) return null;

  const canDelete = confirmText === project.name;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canDelete || !project) return;
    onConfirm(project);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Delete Project</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <p className="mb-4 text-sm text-gray-600">
          This will permanently delete{' '}
          <span className="font-semibold text-gray-900">{project.name}</span> and all of its
          tracked data. This can't be undone.
        </p>

        <form onSubmit={handleSubmit}>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Type <span className="font-semibold">{project.name}</span> to confirm
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            autoFocus
            className="mb-6 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          />

          <button
            type="submit"
            disabled={!canDelete}
            className="w-full rounded-md bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-300"
          >
            Delete Project
          </button>
        </form>
      </div>
    </div>
  );
}
