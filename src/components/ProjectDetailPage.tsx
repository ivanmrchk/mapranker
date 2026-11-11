import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { Keyword, KeywordRunResult, ProjectDetail } from '../types/project';
import { DetailCard } from './DetailCard';
import { TrendIndicator } from './TrendIndicator';
import { TrendsCard } from './TrendsCard';
import { KeywordsCard } from './KeywordsCard';
import { CompetitorsCard } from './CompetitorsCard';

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setNotFound(false);
    fetch(`/api/projects/${id}`)
      .then((res) => {
        if (res.status === 404) {
          if (!cancelled) setNotFound(true);
          return null;
        }
        return res.json();
      })
      .then((data: ProjectDetail | null) => {
        if (!cancelled && data) setProject(data);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function handleAddKeyword(text: string) {
    if (!project) return;
    const res = await fetch(`/api/projects/${project.id}/keywords`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    const keyword: Keyword = await res.json();
    setProject((prev) =>
      prev
        ? { ...prev, keywords: [...prev.keywords, keyword], keywordCount: prev.keywordCount + 1 }
        : prev,
    );
  }

  async function handleDeleteKeyword(keywordId: string) {
    if (!project) return;
    const res = await fetch(`/api/projects/${project.id}/keywords/${keywordId}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      setProject((prev) =>
        prev
          ? {
              ...prev,
              keywords: prev.keywords.filter((k) => k.id !== keywordId),
              keywordCount: prev.keywordCount - 1,
            }
          : prev,
      );
    }
  }

  async function handleRunKeyword(keywordId: string) {
    if (!project) return;
    const res = await fetch(`/api/projects/${project.id}/keywords/${keywordId}/run`, {
      method: 'POST',
    });
    const { keyword: updated }: KeywordRunResult = await res.json();
    setProject((prev) =>
      prev
        ? { ...prev, keywords: prev.keywords.map((k) => (k.id === keywordId ? updated : k)) }
        : prev,
    );
  }

  function handleViewMap(keywordId: string) {
    if (!project) return;
    navigate(`/projects/${project.id}/keywords/${keywordId}/map`);
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
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
      </div>

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
    </div>
  );
}
