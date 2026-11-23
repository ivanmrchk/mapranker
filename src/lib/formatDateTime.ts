/** A date and time in the viewer's time zone, e.g. "Nov 23, 2026, 2:32 PM". */
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
