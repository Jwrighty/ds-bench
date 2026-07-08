import type { CheckResult, Measure, NaReason } from "../types.ts";

export function roundRatio(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/** The standard not-applicable result: `detail` says why the check does not apply and which check carries the gap. */
export function naResult(kind: Measure["kind"], detail: string, naReason?: NaReason): CheckResult {
  return {
    outcome: "na",
    ...(naReason ? { naReason } : {}),
    score: null,
    measure: {
      kind,
      value: 0,
      detail,
    },
    evidence: [],
  };
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
