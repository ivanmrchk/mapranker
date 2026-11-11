import { useEffect, useState } from 'react';
import type { NewProjectInput, Project } from '../types/project';
import { ProjectCard } from './ProjectCard';
import { CreateProjectModal } from './CreateProjectModal';
import { DeleteProjectModal } from './DeleteProjectModal';
import { ErrorBanner } from './ErrorBanner';
import { api } from '../lib/api';

export function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [projectPendingDeletion, setProjectPendingDeletion] = useState<Project | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/projects')
      .then((res) => res.json())
      .then((data: Project[]) => {
        if (!cancelled) setProjects(data);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleCreateProject(input: NewProjectInput) {
    setError(null);
    try {
      const newProject = await api<Project>('/api/projects', { method: 'POST', body: input });
      setProjects((prev) => [...prev, newProject]);
      setIsModalOpen(false);
    } catch (err) {
      setIsModalOpen(false);
      setError(`Couldn't create project: ${(err as Error).message}`);
    }
  }

  async function handleDeleteProject(project: Project) {
    const res = await fetch(`/api/projects/${project.id}`, { method: 'DELETE' });
    if (res.ok) {
      setProjects((prev) => prev.filter((p) => p.id !== project.id));
    }
    setProjectPendingDeletion(null);
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          + New Project
        </button>
      </div>

      <ErrorBanner message={error} onDismiss={() => setError(null)} />

      {isLoading ? (
        <p className="mt-6 text-sm text-gray-500">Loading projects…</p>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onDeleteClick={setProjectPendingDeletion}
            />
          ))}
        </div>
      )}

      <CreateProjectModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreate={handleCreateProject}
      />

      <DeleteProjectModal
        project={projectPendingDeletion}
        onClose={() => setProjectPendingDeletion(null)}
        onConfirm={handleDeleteProject}
      />
    </div>
  );
}
