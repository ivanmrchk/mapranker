export interface SimulatedBusiness {
  readonly name: string;
  /** Overall strength 0–1: stronger businesses rank higher on average. */
  readonly strength: number;
  readonly rating: number;
  readonly baseReviews: number;
  readonly reviewsPerDay: number;
}

type Row = readonly [name: string, strength: number, rating: number, baseReviews: number, reviewsPerDay: number];

// A fixed cast of made-up local businesses so results stay consistent between scans.
const ROWS: readonly Row[] = [
  ['Bright Spark Electric', 0.82, 4.8, 184, 0.45],
  ['Austin Volt Electricians', 0.74, 4.6, 97, 0.26],
  ['PowerPro Electrical Services', 0.62, 4.4, 52, 0.09],
  ['CircuitWorks Electric', 0.5, 4.2, 21, 0.03],
  ['Lone Star Wiring Co.', 0.7, 4.9, 312, 0.7],
  ['Capital City Electric', 0.68, 4.5, 441, 0.55],
  ['Hill Country Power & Light', 0.6, 4.7, 88, 0.2],
  ['Greenline EV & Electric', 0.66, 5.0, 64, 0.6],
  ['Amped Home Services', 0.58, 4.3, 205, 0.35],
  ['True North Electrical', 0.55, 4.6, 39, 0.12],
  ['Riverside Electric LLC', 0.52, 4.1, 118, 0.08],
  ['Bluebonnet Electrical', 0.63, 4.8, 156, 0.3],
  ['Sparky Pros', 0.47, 3.9, 73, 0.05],
  ['Mueller Electric Contractors', 0.57, 4.7, 27, 0.15],
  ['Pecan Street Electric', 0.45, 4.4, 15, 0.04],
  ['Volta Residential', 0.61, 4.9, 233, 0.9],
  ['Eastside Electrical Repair', 0.42, 4.0, 61, 0.02],
  ['Precision Circuit Solutions', 0.54, 4.5, 94, 0.18],
  ['Longhorn Electric Co.', 0.65, 4.6, 507, 0.4],
  ['Westlake Wiring', 0.49, 4.8, 33, 0.1],
  ['A1 Breaker & Panel', 0.44, 4.2, 47, 0.06],
  ['Northside Power Techs', 0.51, 4.3, 82, 0.11],
  ['Brightway Electric', 0.56, 4.7, 129, 0.25],
  ['Mopac Electrical Services', 0.4, 3.8, 19, 0.02],
  ['SolarEdge Install Austin', 0.53, 4.6, 71, 0.22],
  ['Ironwood Electric', 0.48, 4.5, 58, 0.07],
  ['Shoal Creek Electric', 0.46, 4.9, 24, 0.09],
  ['Brazos Electrical Group', 0.59, 4.4, 166, 0.28],
];

export const SIMULATED_BUSINESSES: readonly SimulatedBusiness[] = ROWS.map(
  ([name, strength, rating, baseReviews, reviewsPerDay]) => ({
    name,
    strength,
    rating,
    baseReviews,
    reviewsPerDay,
  }),
);
