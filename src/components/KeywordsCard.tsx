import { useState } from 'react';
import type { Keyword } from '../types/project';

interface KeywordsCardProps {
  keywords: Keyword[];
  onAdd: (text: string) => Promise<void>;
  onDelete: (keywordId: string) => Promise<void>;
  onRun: (keywordId: string) => Promise<void>;
  onViewMap: (keywordId: string) => void;
}

export function KeywordsCard({ keywords, onAdd, onDelete, onRun, onViewMap }: KeywordsCardProps) {
  const [newKeyword, setNewKeyword] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleAddSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = newKeyword.trim();
    if (!text || isAdding) return;
    setIsAdding(true);
    try {
      await onAdd(text);
      setNewKeyword('');
    } finally {
      setIsAdding(false);
    }
  }

  async function handleRunClick(keywordId: string) {
    setRunningId(keywordId);
    try {
      await onRun(keywordId);
    } finally {
      setRunningId(null);
    }
  }

  async function handleDeleteClick(keywordId: string) {
    setDeletingId(keywordId);
    try {
      await onDelete(keywordId);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="mt-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-bold text-gray-900">Keywords</h2>

      <form onSubmit={handleAddSubmit} className="mt-4 flex gap-2">
        <input
          type="text"
          value={newKeyword}
          onChange={(e) => setNewKeyword(e.target.value)}
          placeholder="Add a keyword…"
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={!newKeyword.trim() || isAdding}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
        >
          Add Keyword
        </button>
      </form>

      {keywords.length === 0 ? (
        <p className="mt-6 text-sm text-gray-400">No keywords yet.</p>
      ) : (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                <th className="pb-2 pr-3 font-semibold">Keyword</th>
                <th className="pb-2 pr-3 font-semibold">Avg Rank</th>
                <th className="pb-2 pr-3 font-semibold">Visibility</th>
                <th className="pb-2 pl-3 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {keywords.map((keyword) => (
                <tr key={keyword.id}>
                  <td className="py-3 pr-3 font-medium text-gray-900">{keyword.text}</td>
                  <td className="py-3 pr-3 text-gray-700">
                    {keyword.avgRank !== null ? `#${keyword.avgRank}` : '—'}
                  </td>
                  <td className="py-3 pr-3 text-gray-700">
                    {keyword.visibility !== null ? `${keyword.visibility}%` : '—'}
                  </td>
                  <td className="py-3 pl-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => handleRunClick(keyword.id)}
                        disabled={runningId === keyword.id}
                        className="rounded-md border border-gray-200 px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {runningId === keyword.id ? 'Running…' : 'Run'}
                      </button>
                      <button
                        type="button"
                        onClick={() => onViewMap(keyword.id)}
                        className="rounded-md border border-gray-200 px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                      >
                        View Map
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteClick(keyword.id)}
                        disabled={deletingId === keyword.id}
                        aria-label={`Delete ${keyword.text}`}
                        className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 20 20"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="h-4 w-4"
                        >
                          <path d="M4.167 5.833h11.666M8.333 9.167v4.166M11.667 9.167v4.166M5 5.833l.667 9.167a1.667 1.667 0 0 0 1.666 1.5h5.334a1.667 1.667 0 0 0 1.666-1.5L15 5.833M7.5 5.833V4.167A1.667 1.667 0 0 1 9.167 2.5h1.666a1.667 1.667 0 0 1 1.667 1.667v1.666" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
