import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { Keyword, ProjectDetail, ProjectUpdateInput } from '../types/project';
import { api } from '../lib/api';
import { DetailCard } from './DetailCard';
import { TrendIndicator } from './TrendIndicator';
import { TrendsCard } from './TrendsCard';
import { KeywordsCard } from './KeywordsCard';
import { CompetitorsCard } from './CompetitorsCard';
import { StatusBadge } from './StatusBadge';
import { EditProjectModal } from './EditProjectModal';
import { ErrorBanner } from './ErrorBanner';

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setNotFound(false);
    api<ProjectDetail>(`/api/projects/${id}`)
      .then((data) => {
        if (!cancelled) setProject(data);
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
  }, [id]);

  /** Re-reads the project after something that changes its stats (runs, keyword removal). */
  const reloadProject = useCallback(async () => {
    try {
      setProject(await api<ProjectDetail>(`/api/projects/${id}`));
    } catch (err) {
      setError(`Couldn't refresh project: ${(err as Error).message}`);
    }
  }, [id]);

  async function handleAddKeyword(text: string) {
    if (!project) return;
    try {
      const keyword = await api<Keyword>(`/api/projects/${project.id}/keywords`, {
        method: 'POST',
        body: { text },
      });
      setProject((prev) =>
        prev
          ? { ...prev, keywords: [...prev.keywords, keyword], keywordCount: prev.keywordCount + 1 }
          : prev,
      );
    } catch (err) {
      setError(`Couldn't add keyword: ${(err as Error).message}`);
    }
  }

  async function handleDeleteKeyword(keywordId: string) {
    if (!project) return;
    try {
      await api(`/api/projects/${project.id}/keywords/${keywordId}`, { method: 'DELETE' });
      await reloadProject();
    } catch (err) {
      setError(`Couldn't delete keyword: ${(err as Error).message}`);
    }
  }

  /** Starts the run, then opens the keyword's map to follow it pin by pin. */
  async function handleRunKeyword(keywordId: string) {
    if (!project) return;
    try {
      await api(`/api/projects/${project.id}/keywords/${keywordId}/run`, { method: 'POST' });
      navigate(`/projects/${project.id}/keywords/${keywordId}/map`);
    } catch (err) {
      setError(`Couldn't start the run: ${(err as Error).message}`);
    }
  }

  async function handleSaveProject(input: ProjectUpdateInput) {
    if (!project) return;
    const updated = await api<ProjectDetail>(`/api/projects/${project.id}`, {
      method: 'PATCH',
      body: input,
    });
    setProject(updated);
    setIsEditing(false);
  }

  function handleViewMap(keywordId: string) {
    if (!project) return;
    navigate(`/projects/${project.id}/keywords/${keywordId}/map`);
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/')}
            aria-label="Back to projects"
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
            {project ? project.name : notFound ? 'Project not found' : 'Loading…'}
          </h1>
          {project && <StatusBadge status={project.status} />}
        </div>
        {project && (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Edit Project
          </button>
        )}
      </div>

      <ErrorBanner message={error} onDismiss={() => setError(null)} />

      {!isLoading && project && (
        <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <DetailCard title="Pins Tracked">
            <p className="text-2xl font-bold text-gray-900">
              {project.pinsTracked}
              <span className="text-base font-medium text-gray-400"> / {project.pinsTotal}</span>
            </p>
          </DetailCard>

          <DetailCard title="Keywords">
            <p className="text-2xl font-bold text-gray-900">{project.keywordCount}</p>
          </DetailCard>

          <DetailCard title="Average Ranking">
            <p className="flex items-center gap-2 text-2xl font-bold text-gray-900">
              {project.avgRank !== null ? `#${project.avgRank}` : '—'}
              <TrendIndicator value={project.avgRankTrend} direction="lowerIsBetter" />
            </p>
            <p className="mt-1 flex items-center gap-2 text-sm text-gray-500">
              Visibility {project.visibility !== null ? `${project.visibility}%` : '—'}
              <TrendIndicator value={project.visibilityTrend} direction="higherIsBetter" />
            </p>
          </DetailCard>

          <DetailCard title="Google Business Profile">
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-xs text-gray-400">Place ID</dt>
                <dd className="break-all font-medium text-gray-900">{project.placeId}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-400">Address</dt>
                <dd className="font-medium text-gray-900">{project.address || '—'}</dd>
                {project.address && project.lat === null && (
                  <dd className="mt-0.5 text-xs text-amber-600">
                    Couldn't find this address on the map.
                  </dd>
                )}
              </div>
            </dl>
          </DetailCard>
        </div>
      )}

      {!isLoading && project && <TrendsCard history={project.rankHistory} />}

      {!isLoading && project && (
        <KeywordsCard
          keywords={project.keywords}
          onAdd={handleAddKeyword}
          onDelete={handleDeleteKeyword}
          onRun={handleRunKeyword}
          onViewMap={handleViewMap}
        />
      )}

      {!isLoading && project && <CompetitorsCard competitors={project.competitors} />}

      {isEditing && project && (
        <EditProjectModal
          project={project}
          onClose={() => setIsEditing(false)}
          onSave={handleSaveProject}
        />
      )}
    </div>
  );
}
