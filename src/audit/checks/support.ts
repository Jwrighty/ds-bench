export function roundRatio(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function formatNames(names: string[]): string {
  return names.length === 0 ? "none" : Array.from(new Set(names)).join(", ");
}

export function hasCommentDescription(comment: string): boolean {
  const description = comment
    .replace(/^\/\*\*/, "")
    .replace(/\*\/$/, "")
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*\*\s?/, "").trim())
    .filter((line) => line.length > 0)
    .filter((line) => !line.startsWith("@"))
    .join(" ")
    .trim();

  return /[A-Za-z0-9]/.test(description);
}
