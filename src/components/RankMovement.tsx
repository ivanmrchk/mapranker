import type { ProjectCompetitor } from '../types/project';

/** Spots gained or lost in average rank since about a week earlier; details on hover. */
export function RankMovement({ movement }: { movement: ProjectCompetitor['movement'] }) {
  if (!movement) {
    return (
      <span className="text-gray-400" title="Not in the top 20 on any pin scanned both times">
        —
      </span>
    );
  }
  const { before, now, spotsGained } = movement;
  const { text, color } = spotsDisplay(spotsGained);
  return (
    <span className={color} title={`Avg rank #${before} → #${now} on the compared pin checks`}>
      {text}
    </span>
  );
}

function spotsDisplay(spotsGained: number): { text: string; color: string } {
  if (spotsGained > 0) return { text: `▲${spotsGained}`, color: 'font-semibold text-green-600' };
  if (spotsGained < 0) return { text: `▼${-spotsGained}`, color: 'font-semibold text-red-500' };
  return { text: '–', color: 'text-gray-400' };
}
