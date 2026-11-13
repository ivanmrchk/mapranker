export interface LatLng {
  lat: number;
  lng: number;
}

export const GRID_SIZES = [3, 5, 7, 9] as const;
export const GRID_SPACINGS_KM = [0.5, 1, 2, 3] as const;
export const DEFAULT_GRID_SIZE = 7;
export const DEFAULT_GRID_SPACING_KM = 1;

const KM_PER_DEGREE_LAT = 111.32;

/**
 * A size×size square grid of points centered on `center`, `spacingKm` apart.
 * Keep in sync with server/src/lib/geo.ts.
 */
export function generateGrid(center: LatLng, size: number, spacingKm: number): LatLng[] {
  const dLat = spacingKm / KM_PER_DEGREE_LAT;
  const dLng = spacingKm / (KM_PER_DEGREE_LAT * Math.cos((center.lat * Math.PI) / 180));
  const half = (size - 1) / 2;
  const points: LatLng[] = [];
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      points.push({
        lat: center.lat + (half - row) * dLat,
        lng: center.lng + (col - half) * dLng,
      });
    }
  }
  return points;
}

/** A square lattice: points at origin + whole multiples of the steps. */
export interface GridLattice {
  readonly origin: LatLng;
  readonly latStep: number;
  readonly lngStep: number;
  readonly spacingKm: number;
}

/** How close (in fractions of a grid step) a point must be to count as on the lattice. */
const ON_GRID_TOLERANCE = 0.005;
/** Fewer aligned pins than this isn't evidence of a grid. */
const MIN_PINS_ON_GRID = 4;

/**
 * Finds the grid the pins were generated on, even after some were moved, removed or added
 * by hand. Grids aren't stored, but every generated pin sits at an exact multiple of the
 * spacing from the others, so this tries each pin as the origin with each spacing and keeps
 * the lattice most pins lie on. Largest spacing first: a 3 km grid also fits a 0.5 km
 * lattice, and the coarser one is the grid that was actually made.
 */
export function detectGrid(pins: readonly LatLng[]): GridLattice | null {
  let best: { lattice: GridLattice; pinsOnGrid: number } | null = null;
  const spacingsLargestFirst = [...GRID_SPACINGS_KM].sort((a, b) => b - a);
  for (const spacingKm of spacingsLargestFirst) {
    for (const origin of pins) {
      const lattice = latticeAt(origin, spacingKm);
      const pinsOnGrid = pins.filter((p) => isOnLattice(p, lattice)).length;
      if (!best || pinsOnGrid > best.pinsOnGrid) best = { lattice, pinsOnGrid };
    }
  }
  return best && best.pinsOnGrid >= MIN_PINS_ON_GRID ? best.lattice : null;
}

/** The lattice point nearest to `point`. */
export function snapToGrid(point: LatLng, lattice: GridLattice): LatLng {
  return {
    lat: lattice.origin.lat + Math.round((point.lat - lattice.origin.lat) / lattice.latStep) * lattice.latStep,
    lng: lattice.origin.lng + Math.round((point.lng - lattice.origin.lng) / lattice.lngStep) * lattice.lngStep,
  };
}

function latticeAt(origin: LatLng, spacingKm: number): GridLattice {
  // Same step sizes as generateGrid; the longitude step uses the origin's latitude, which
  // differs from the generating center's by far less than the tolerance over a grid's span.
  return {
    origin,
    spacingKm,
    latStep: spacingKm / KM_PER_DEGREE_LAT,
    lngStep: spacingKm / (KM_PER_DEGREE_LAT * Math.cos((origin.lat * Math.PI) / 180)),
  };
}

function isOnLattice(point: LatLng, lattice: GridLattice): boolean {
  const offsetFromWhole = (steps: number) => Math.abs(steps - Math.round(steps));
  return (
    offsetFromWhole((point.lat - lattice.origin.lat) / lattice.latStep) < ON_GRID_TOLERANCE &&
    offsetFromWhole((point.lng - lattice.origin.lng) / lattice.lngStep) < ON_GRID_TOLERANCE
  );
}
