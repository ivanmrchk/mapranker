import { useState } from 'react';
import { Polyline, useMap, useMapEvents } from 'react-leaflet';
import type { GridLattice } from '../lib/grid';

const LINE_STYLE = { color: '#6b7280', weight: 1, opacity: 0.7, dashArray: '4 6', interactive: false } as const;
/** Zoomed out this far, the lines would blur into a gray wash; hide them instead. */
const MAX_LINES_PER_DIRECTION = 120;

/** Dotted lines of the pin grid, extended across whatever part of the map is in view. */
export function GridOverlay({ lattice }: { lattice: GridLattice }) {
  const map = useMap();
  const [bounds, setBounds] = useState(() => map.getBounds());
  useMapEvents({ moveend: () => setBounds(map.getBounds()) });

  const latLines = linesWithin(bounds.getSouth(), bounds.getNorth(), lattice.origin.lat, lattice.latStep);
  const lngLines = linesWithin(bounds.getWest(), bounds.getEast(), lattice.origin.lng, lattice.lngStep);
  if (!latLines || !lngLines) return null;

  return (
    <>
      {latLines.map((lat) => (
        <Polyline
          key={`lat${lat}`}
          positions={[
            [lat, bounds.getWest()],
            [lat, bounds.getEast()],
          ]}
          pathOptions={LINE_STYLE}
        />
      ))}
      {lngLines.map((lng) => (
        <Polyline
          key={`lng${lng}`}
          positions={[
            [bounds.getSouth(), lng],
            [bounds.getNorth(), lng],
          ]}
          pathOptions={LINE_STYLE}
        />
      ))}
    </>
  );
}

/** Grid line positions (origin + whole steps) between `from` and `to`; null if too many to draw. */
function linesWithin(from: number, to: number, origin: number, step: number): number[] | null {
  const first = Math.ceil((from - origin) / step);
  const last = Math.floor((to - origin) / step);
  if (last - first + 1 > MAX_LINES_PER_DIRECTION) return null;
  const lines: number[] = [];
  for (let k = first; k <= last; k++) lines.push(origin + k * step);
  return lines;
}
