export function roundRatio(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function formatNames(names: string[]): string {
  return names.length === 0 ? "none" : Array.from(new Set(names)).join(", ");
}
