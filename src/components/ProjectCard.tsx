import { useNavigate } from 'react-router-dom';
import type { Project } from '../types/project';
import { StatTile } from './StatTile';

function formatDate(isoDate: string | null): string {
  if (!isoDate) return '—';
  const date = new Date(`${isoDate}T00:00:00`);
  return date.toLocaleDateString('en-US', {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
  });
}

interface ProjectCardProps {
  project: Project;
  onDeleteClick: (project: Project) => void;
}

export function ProjectCard({ project, onDeleteClick }: ProjectCardProps) {
  const navigate = useNavigate();

  return (
    <div
      className="group relative cursor-pointer rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
      role="link"
      tabIndex={0}
      onClick={() => navigate(`/projects/${project.id}`)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') navigate(`/projects/${project.id}`);
      }}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDeleteClick(project);
        }}
        aria-label={`Delete ${project.name}`}
        className="absolute -left-2 -top-2 z-10 rounded-full border border-gray-200 bg-white p-1.5 text-gray-400 opacity-0 shadow-sm transition-opacity hover:border-red-200 hover:bg-red-50 hover:text-red-600 focus:opacity-100 focus-visible:outline-2 focus-visible:outline-red-500 group-hover:opacity-100"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-3.5 w-3.5"
        >
          <path d="M4.167 5.833h11.666M8.333 9.167v4.166M11.667 9.167v4.166M5 5.833l.667 9.167a1.667 1.667 0 0 0 1.666 1.5h5.334a1.667 1.667 0 0 0 1.666-1.5L15 5.833M7.5 5.833V4.167A1.667 1.667 0 0 1 9.167 2.5h1.666a1.667 1.667 0 0 1 1.667 1.667v1.666" />
        </svg>
      </button>
      <h3 className="text-base font-bold text-gray-900">{project.name}</h3>
      <p className="mt-1 text-sm text-gray-400">Place ID: {project.placeId}</p>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <StatTile label="Last Run" value={formatDate(project.lastRun)} />
        <StatTile label="Keywords" value={String(project.keywordCount)} />
        <StatTile
          label="Avg Rank"
          value={project.avgRank !== null ? `#${project.avgRank}` : '—'}
          trend={{ value: project.avgRankTrend, direction: 'lowerIsBetter' }}
        />
        <StatTile
          label="Visibility"
          value={project.visibility !== null ? `${project.visibility}%` : '—'}
          trend={{ value: project.visibilityTrend, direction: 'higherIsBetter' }}
        />
      </div>
    </div>
  );
}
