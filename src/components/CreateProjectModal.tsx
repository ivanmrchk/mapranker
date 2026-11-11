import { useState } from 'react';
import type { NewProjectInput } from '../types/project';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (input: NewProjectInput) => void;
}

const EMPTY_FORM: NewProjectInput = { name: '', businessLabel: '', placeId: '', address: '' };

export function CreateProjectModal({ isOpen, onClose, onCreate }: CreateProjectModalProps) {
  const [form, setForm] = useState<NewProjectInput>(EMPTY_FORM);

  if (!isOpen) return null;

  function handleClose() {
    setForm(EMPTY_FORM);
    onClose();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onCreate(form);
    setForm(EMPTY_FORM);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Create Project</h2>
          <button
            type="button"
            onClick={handleClose}
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
            className="mb-4 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <label className="mb-1 block text-sm font-medium text-gray-700">
            Business Label
          </label>
          <input
            type="text"
            value={form.businessLabel}
            onChange={(e) => setForm({ ...form, businessLabel: e.target.value })}
            className="mb-4 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <label className="mb-1 block text-sm font-medium text-gray-700">
            Tracked Place ID
          </label>
          <input
            type="text"
            value={form.placeId}
            onChange={(e) => setForm({ ...form, placeId: e.target.value })}
            className="mb-4 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <label className="mb-1 block text-sm font-medium text-gray-700">
            Address <span className="font-normal text-gray-400">(optional)</span>
          </label>
          <input
            type="text"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            className="mb-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="mb-6 text-xs text-gray-400">
            Used to place a 7 × 7 grid of pins, 1 km apart, around the business. You can move, add,
            or regenerate pins later.
          </p>

          <button
            type="submit"
            className="w-full rounded-md bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Create Project
          </button>
        </form>
      </div>
    </div>
  );
}
