import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type {
  KeywordDetail,
  KeywordRunDetail,
  KeywordRunResult,
  Pin,
  PinBatchResult,
  PinRankPoint,
  ProjectDetail,
} from '../types/project';
import { api } from '../lib/api';
import { generateGrid, type LatLng } from '../lib/grid';
import type { PinRankState } from '../lib/rank';
import { StatTile } from './StatTile';
import { RunsDropdown } from './RunsDropdown';
import { PinMap } from './PinMap';
import { PinInspectionPanel } from './PinInspectionPanel';
import { GridModal, type GridOptions } from './GridModal';
import { MapLegend } from './MapLegend';
import { ErrorBanner } from './ErrorBanner';

export interface EditablePin extends Pin {
  isNew?: boolean;
}

function newPin(point: LatLng): EditablePin {
  return {
    id: `new-${crypto.randomUUID()}`,
    lat: point.lat,
    lng: point.lng,
    enabled: true,
    lastCheckedAt: null,
    isNew: true,
  };
}

export function KeywordMapPage() {
  const { id, keywordId } = useParams<{ id: string; keywordId: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [keyword, setKeyword] = useState<KeywordDetail | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [run, setRun] = useState<KeywordRunDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [pins, setPins] = useState<EditablePin[]>([]);
  const [pinsLoaded, setPinsLoaded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editSnapshot, setEditSnapshot] = useState<EditablePin[] | null>(null);
  const [placingPin, setPlacingPin] = useState(false);
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingDeletes, setPendingDeletes] = useState<Set<string>>(new Set());
  const [gridModalOpen, setGridModalOpen] = useState(false);
  const [fitKey, setFitKey] = useState(0);
  const [checkingPinId, setCheckingPinId] = useState<string | null>(null);
  const mapCenter = useRef<LatLng | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setNotFound(false);
    Promise.all([
      api<KeywordDetail>(`/api/projects/${id}/keywords/${keywordId}`),
      api<ProjectDetail>(`/api/projects/${id}`),
    ])
      .then(([keywordData, projectData]) => {
        if (cancelled) return;
        setKeyword(keywordData);
        setProject(projectData);
        setSelectedRunId(keywordData.runs[0]?.id ?? null);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        if (/not found/i.test(err.message)) setNotFound(true);
        else setError(err.message);
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
    api<KeywordRunDetail>(`/api/projects/${id}/keywords/${keywordId}/runs/${selectedRunId}`)
      .then((data) => {
        if (!cancelled) setRun(data);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(`Couldn't load that run: ${err.message}`);
      });
    return () => {
      cancelled = true;
    };
  }, [id, keywordId, selectedRunId]);

  useEffect(() => {
    let cancelled = false;
    setPinsLoaded(false);
    api<Pin[]>(`/api/projects/${id}/pins`)
      .then((data) => {
        if (!cancelled) setPins(data);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(`Couldn't load pins: ${err.message}`);
      })
      .finally(() => {
        if (!cancelled) setPinsLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  /** Applies a run result returned by the server: updates the keyword, run list, run and pins. */
  function applyRunResult(data: KeywordRunResult) {
    setKeyword((prev) =>
      prev
        ? {
            ...prev,
            ...data.keyword,
            runs: prev.runs.some((r) => r.id === data.run.id)
              ? prev.runs
              : [{ id: data.run.id, date: data.run.date }, ...prev.runs],
          }
        : prev,
    );
    setRun(data.run);
    setSelectedRunId(data.run.id);
    const checkedAt = new Map(data.run.pinResults.map((r) => [r.pinId, r.checkedAt]));
    setPins((prev) =>
      prev.map((p) => {
        const at = checkedAt.get(p.id);
        return at && (!p.lastCheckedAt || at > p.lastCheckedAt) ? { ...p, lastCheckedAt: at } : p;
      }),
    );
  }

  async function handleRunAllPins() {
    if (!id || !keywordId || isRunning) return;
    setIsRunning(true);
    setError(null);
    try {
      applyRunResult(
        await api<KeywordRunResult>(`/api/projects/${id}/keywords/${keywordId}/run`, {
          method: 'POST',
        }),
      );
    } catch (err) {
      setError(`Run failed: ${(err as Error).message}`);
    } finally {
      setIsRunning(false);
    }
  }

  async function handleCheckPin(pinId: string) {
    if (!id || !keywordId || checkingPinId) return;
    setCheckingPinId(pinId);
    setError(null);
    try {
      applyRunResult(
        await api<KeywordRunResult>(
          `/api/projects/${id}/keywords/${keywordId}/pins/${pinId}/check`,
          { method: 'POST' },
        ),
      );
    } catch (err) {
      setError(`Pin check failed: ${(err as Error).message}`);
    } finally {
      setCheckingPinId(null);
    }
  }

  function handleEnterEdit() {
    setEditSnapshot(pins);
    setEditing(true);
    setError(null);
  }

  function handleCancelEdit() {
    const snapshot = editSnapshot;
    if (snapshot) setPins(snapshot);
    setEditing(false);
    setEditSnapshot(null);
    setPlacingPin(false);
    setPendingDeletes(new Set());
    setSelectedPinId(selectedPinId && snapshot?.some((p) => p.id === selectedPinId) ? selectedPinId : null);
    setFitKey((k) => k + 1);
  }

  async function handleSaveEdit() {
    if (!id || isSaving) return;
    setIsSaving(true);
    setError(null);
    const snapshotById = new Map((editSnapshot ?? []).map((p) => [p.id, p]));
    const batch = {
      create: pins
        .filter((p) => p.isNew)
        .map((p) => ({ tempId: p.id, lat: p.lat, lng: p.lng, enabled: p.enabled })),
      update: pins
        .filter((p) => {
          const original = snapshotById.get(p.id);
          return (
            !p.isNew &&
            original &&
            (original.lat !== p.lat || original.lng !== p.lng || original.enabled !== p.enabled)
          );
        })
        .map((p) => ({ id: p.id, lat: p.lat, lng: p.lng, enabled: p.enabled })),
      delete: Array.from(pendingDeletes),
    };
    try {
      const result = await api<PinBatchResult>(`/api/projects/${id}/pins`, {
        method: 'PUT',
        body: batch,
      });
      setPins(result.pins);
      setSelectedPinId((prev) => (prev ? (result.idMap[prev] ?? prev) : prev));
      setKeyword((prev) =>
        prev ? { ...prev, pinsTotal: result.pins.filter((p) => p.enabled).length } : prev,
      );
      setEditing(false);
      setEditSnapshot(null);
      setPlacingPin(false);
      setPendingDeletes(new Set());
    } catch (err) {
      // Nothing was saved (the server applies the batch all-or-nothing); stay in edit mode.
      setError(`Couldn't save pins: ${(err as Error).message}`);
    } finally {
      setIsSaving(false);
    }
  }

  function handleDragPin(pinId: string, lat: number, lng: number) {
    setPins((prev) => prev.map((p) => (p.id === pinId ? { ...p, lat, lng } : p)));
  }

  function handleMapClick(lat: number, lng: number) {
    if (!editing || !placingPin) return;
    const pin = newPin({ lat, lng });
    setPins((prev) => [...prev, pin]);
    setSelectedPinId(pin.id);
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

  function handleOpenGrid() {
    if (!editing) handleEnterEdit();
    setGridModalOpen(true);
  }

  function handleGenerateGrid({ size, spacingKm, centerOn }: GridOptions) {
    const center =
      centerOn === 'business' && project?.lat != null && project.lng != null
        ? { lat: project.lat, lng: project.lng }
        : mapCenter.current;
    if (!center) return;
    setPendingDeletes((prev) => {
      const next = new Set(prev);
      for (const p of pins) if (!p.isNew) next.add(p.id);
      return next;
    });
    setPins(generateGrid(center, size, spacingKm).map(newPin));
    setSelectedPinId(null);
    setPlacingPin(false);
    setGridModalOpen(false);
    setFitKey((k) => k + 1);
  }

  const handleCenterChange = useCallback((center: LatLng) => {
    mapCenter.current = center;
  }, []);

  const resultByPin = new Map<string, PinRankPoint>(
    (run?.pinResults ?? []).map((r) => [r.pinId, r]),
  );
  function getRankState(pin: EditablePin): PinRankState {
    if (!pin.enabled) return 'disabled';
    const result = pin.isNew ? undefined : resultByPin.get(pin.id);
    if (!result) return 'unchecked';
    return result.rank ?? 'notFound';
  }

  const selectedPin = pins.find((p) => p.id === selectedPinId) ?? null;
  // Includes unsaved pins while editing, so the count matches what's on the map.
  const enabledPinCount = pins.filter((p) => p.enabled).length;
  const business =
    project && project.lat !== null && project.lng !== null
      ? { lat: project.lat, lng: project.lng, label: project.businessLabel }
      : null;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(`/projects/${id}`)}
          aria-label="Back to project"
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
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {keyword ? keyword.text : notFound ? 'Keyword not found' : 'Loading…'}
          </h1>
          {project && <p className="text-sm text-gray-400">{project.name}</p>}
        </div>
      </div>

      <ErrorBanner message={error} onDismiss={() => setError(null)} />

      {!isLoading && keyword && (
        <>
          <div className="mt-6 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleRunAllPins}
              disabled={isRunning || editing || enabledPinCount === 0}
              title={editing ? 'Save or cancel your pin edits first' : undefined}
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

          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile label="Active Pins" value={String(enabledPinCount)} />
            <StatTile
              label="Checked Pins"
              value={run ? `${run.pinsChecked} / ${run.pinsTotal}` : '—'}
            />
            <StatTile
              label="Avg Ranking"
              value={run?.avgRank != null ? `#${run.avgRank}` : '—'}
              trend={run ? { value: run.avgRankTrend, direction: 'lowerIsBetter' } : undefined}
            />
            <StatTile
              label="Visibility (Top 3)"
              value={run?.visibility != null ? `${run.visibility}%` : '—'}
              trend={run ? { value: run.visibilityTrend, direction: 'higherIsBetter' } : undefined}
            />
          </div>
        </>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <h2 className="text-base font-bold text-gray-900">Pin Map</h2>
          <MapLegend />
        </div>
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <button
                type="button"
                onClick={handleOpenGrid}
                className="rounded-md border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                Generate Grid
              </button>
              <button
                type="button"
                onClick={() => setPlacingPin((v) => !v)}
                className={`rounded-md px-3 py-2 text-xs font-semibold ${
                  placingPin
                    ? 'bg-blue-600 text-white'
                    : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                {placingPin ? 'Click the map…' : 'Add Pin'}
              </button>
              <button
                type="button"
                onClick={handleCancelEdit}
                disabled={isSaving}
                className="rounded-md border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
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
              className="rounded-md border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
            >
              Edit Pins
            </button>
          )}
        </div>
      </div>

      {pinsLoaded && pins.length === 0 && !editing && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          <span>
            {business
              ? 'This project has no pins yet.'
              : "This project has no pins yet, and its address couldn't be found on the map. Move the map to the business, then generate a grid centered on the map."}
          </span>
          <button
            type="button"
            onClick={handleOpenGrid}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
          >
            Generate Grid
          </button>
        </div>
      )}

      <div className="mt-3 flex h-[560px] gap-4">
        <div className="flex-[7] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          {pinsLoaded && !isLoading && (
            <PinMap
              pins={pins}
              getRankState={getRankState}
              business={business}
              editing={editing}
              placingPin={placingPin}
              selectedPinId={selectedPinId}
              fitKey={fitKey}
              onSelectPin={setSelectedPinId}
              onDragPin={handleDragPin}
              onMapClick={handleMapClick}
              onCenterChange={handleCenterChange}
            />
          )}
        </div>
        <div className="flex-[3] overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <PinInspectionPanel
            pin={selectedPin}
            rankState={selectedPin ? getRankState(selectedPin) : 'unchecked'}
            keywordText={keyword?.text ?? ''}
            editing={editing}
            isChecking={checkingPinId !== null && checkingPinId === selectedPinId}
            onCheck={handleCheckPin}
            onToggleEnabled={handleToggleEnabled}
            onDelete={handleDeletePin}
          />
        </div>
      </div>

      <GridModal
        key={gridModalOpen ? 'open' : 'closed'}
        isOpen={gridModalOpen}
        hasBusinessLocation={business !== null}
        currentPinCount={pins.length}
        onClose={() => setGridModalOpen(false)}
        onGenerate={handleGenerateGrid}
      />
    </div>
  );
}
