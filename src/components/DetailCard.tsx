import type { ReactNode } from 'react';

export function DetailCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </div>
  );
}
