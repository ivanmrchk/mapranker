export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function mean(values: readonly number[]): number | null {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}
