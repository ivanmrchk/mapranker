import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { KeywordDetail, KeywordRunDetail, KeywordRunResult, Pin } from '../types/project';
import { StatTile } from './StatTile';
import { RunsDropdown } from './RunsDropdown';
import { PinMap } from './PinMap';
import { PinInspectionPanel } from './PinInspectionPanel';

export interface EditablePin extends Pin {
  isNew?: boolean;
}

export function KeywordMapPage() {
  const { id, keywordId } = useParams<{ id: string; keywordId: string }>();
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState<KeywordDetail | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [run, setRun] = useState<KeywordRunDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const [pins, setPins] = useState<EditablePin[]>([]);
  const [pinsLoaded, setPinsLoaded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editSnapshot, setEditSnapshot] = useState<EditablePin[] | null>(null);
  const [placingPin, setPlacingPin] = useState(false);
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingDeletes, setPendingDeletes] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setNotFound(false);
    fetch(`/api/projects/${id}/keywords/${keywordId}`)
      .then((res) => {
        if (res.status === 404) {
          if (!cancelled) setNotFound(true);
          return null;
        }
        return res.json();
      })
      .then((data: KeywordDetail | null) => {
        if (cancelled || !data) return;
        setKeyword(data);
        setSelectedRunId(data.runs[0]?.id ?? null);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, keywordId]);

  useEffect(() => {
    if (!selectedRunId) {
      setRun(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/projects/${id}/keywords/${keywordId}/runs/${selectedRunId}`)
      .then((res) => res.json())
      .then((data: KeywordRunDetail) => {
        if (!cancelled) setRun(data);
      });
    return () => {
      cancelled = true;
    };
  }, [id, keywordId, selectedRunId]);

  useEffect(() => {
    let cancelled = false;
    setPinsLoaded(false);
    fetch(`/api/projects/${id}/pins`)
      .then((res) => res.json())
      .then((data: Pin[]) => {
        if (!cancelled) setPins(data);
      })
      .finally(() => {
        if (!cancelled) setPinsLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function handleRunAllPins() {
    if (!id || !keywordId || isRunning) return;
    setIsRunning(true);
    try {
      const res = await fetch(`/api/projects/${id}/keywords/${keywordId}/run`, {
        method: 'POST',
      });
      const data: KeywordRunResult = await res.json();
      setKeyword((prev) =>
        prev
          ? { ...prev, ...data.keyword, runs: [{ id: data.run.id, date: data.run.date }, ...prev.runs] }
          : prev,
      );
      setRun(data.run);
      setSelectedRunId(data.run.id);
    } finally {
      setIsRunning(false);
    }
  }

  function handleEnterEdit() {
    setEditSnapshot(pins);
    setEditing(true);
  }

  function handleCancelEdit() {
    const snapshot = editSnapshot;
    if (snapshot) setPins(snapshot);
    setEditing(false);
    setEditSnapshot(null);
    setPlacingPin(false);
    setPendingDeletes(new Set());
    setSelectedPinId(selectedPinId && snapshot?.some((p) => p.id === selectedPinId) ? selectedPinId : null);
  }

  async function handleSaveEdit() {
    if (!id || isSaving) return;
    setIsSaving(true);
    try {
      const snapshotById = new Map((editSnapshot ?? []).map((p) => [p.id, p]));
      const updatedPins: EditablePin[] = await Promise.all(
        pins.map(async (pin): Promise<EditablePin> => {
          if (pin.isNew) {
            const res = await fetch(`/api/projects/${id}/pins`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ lat: pin.lat, lng: pin.lng, enabled: pin.enabled }),
            });
            const created: Pin = await res.json();
            if (selectedPinId === pin.id) setSelectedPinId(created.id);
            return created;
          }
          const original = snapshotById.get(pin.id);
          const moved = original && (original.lat !== pin.lat || original.lng !== pin.lng);
          const toggled = original && original.enabled !== pin.enabled;
          if (moved || toggled) {
            const res = await fetch(`/api/projects/${id}/pins/${pin.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ lat: pin.lat, lng: pin.lng, enabled: pin.enabled }),
            });
            const updated: Pin = await res.json();
            return updated;
          }
          return pin;
        }),
      );
      await Promise.all(
        Array.from(pendingDeletes).map((pinId) =>
          fetch(`/api/projects/${id}/pins/${pinId}`, { method: 'DELETE' }),
        ),
      );
      setPins(updatedPins);
      setEditing(false);
      setEditSnapshot(null);
      setPlacingPin(false);
      setPendingDeletes(new Set());
    } finally {
      setIsSaving(false);
    }
  }

  function handleDragPin(pinId: string, lat: number, lng: number) {
    setPins((prev) => prev.map((p) => (p.id === pinId ? { ...p, lat, lng } : p)));
  }

  function handleMapClick(lat: number, lng: number) {
    if (!editing || !placingPin) return;
    const tempId = `new-${crypto.randomUUID()}`;
    setPins((prev) => [
      ...prev,
      { id: tempId, lat, lng, enabled: true, lastCheckedAt: null, isNew: true },
    ]);
    setSelectedPinId(tempId);
    setPlacingPin(false);
  }

  function handleToggleEnabled(pinId: string) {
    if (!editing) return;
    setPins((prev) => prev.map((p) => (p.id === pinId ? { ...p, enabled: !p.enabled } : p)));
  }

  function handleDeletePin(pinId: string) {
    if (!editing) return;
    const pin = pins.find((p) => p.id === pinId);
    if (!pin) return;
    if (!pin.isNew) {
      setPendingDeletes((prev) => new Set(prev).add(pinId));
    }
    setPins((prev) => prev.filter((p) => p.id !== pinId));
    setSelectedPinId((prev) => (prev === pinId ? null : prev));
  }

  const rankByPin = new Map((run?.pinResults ?? []).map((r) => [r.pinId, r.rank]));
  const selectedPin = pins.find((p) => p.id === selectedPinId) ?? null;
  const selectedRank = selectedPin ? (rankByPin.get(selectedPin.id) ?? null) : null;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="Back"
          className="rounded-md p-2 text-gray-500 hover:bg-gray-200 hover:text-gray-900"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
          >
            <path d="M12.5 4.167 6.667 10l5.833 5.833" />
          </svg>
        </button>
        <h1 className="text-2xl font-bold text-gray-900">
          {keyword ? keyword.text : notFound ? 'Keyword not found' : 'Loading…'}
        </h1>
      </div>

      {!isLoading && keyword && (
        <>
          <div className="mt-6 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleRunAllPins}
              disabled={isRunning}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
            >
              {isRunning ? 'Running…' : 'Run All Pins'}
            </button>
            <RunsDropdown
              runs={keyword.runs}
              selectedRunId={selectedRunId}
              onChange={setSelectedRunId}
            />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatTile label="Pins" value={String(run?.pinsTotal ?? keyword.pinsTotal)} />
            <StatTile label="Checked Pins" value={String(run?.pinsChecked ?? 0)} />
            <StatTile
              label="Avg Ranking"
              value={run?.avgRank !== null && run?.avgRank !== undefined ? `#${run.avgRank}` : '—'}
              trend={run ? { value: run.avgRankTrend, direction: 'lowerIsBetter' } : undefined}
            />
          </div>
        </>
      )}

      <div className="mt-6 flex items-center justify-between gap-3">
        <h2 className="text-base font-bold text-gray-900">Pin Map</h2>
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <button
                type="button"
                onClick={() => setPlacingPin((v) => !v)}
                className={`rounded-md px-3 py-2 text-xs font-semibold ${
                  placingPin
                    ? 'bg-blue-600 text-white'
                    : 'border border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {placingPin ? 'Click the map…' : 'Add Pin'}
              </button>
              <button
                type="button"
                onClick={handleCancelEdit}
                disabled={isSaving}
                className="rounded-md border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={isSaving}
                className="rounded-md bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
              >
                {isSaving ? 'Saving…' : 'Save'}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleEnterEdit}
              className="rounded-md border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
            >
              Edit Pins
            </button>
          )}
        </div>
      </div>

      <div className="mt-3 flex h-[560px] gap-4">
        <div className="flex-[7] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          {pinsLoaded && (
            <PinMap
              pins={pins}
              rankByPin={rankByPin}
              editing={editing}
              placingPin={placingPin}
              selectedPinId={selectedPinId}
              onSelectPin={setSelectedPinId}
              onDragPin={handleDragPin}
              onMapClick={handleMapClick}
            />
          )}
        </div>
        <div className="flex-[3] overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <PinInspectionPanel
            pin={selectedPin}
            rank={selectedRank}
            editing={editing}
            onToggleEnabled={handleToggleEnabled}
            onDelete={handleDeletePin}
          />
        </div>
      </div>
    </div>
  );
}
