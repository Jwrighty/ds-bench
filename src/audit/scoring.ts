import { CATEGORY_ORDER, DEFAULT_WEIGHTS } from "./categories.ts";
import type { AuditCheck, AuditConfig, AuditFinding, CategoryId, Confidence } from "./types.ts";

export type ScoredReportParts = {
  weights: {
    source: "default" | "custom";
    values: Record<CategoryId, number>;
  };
  composite: number;
  applicability: {
    applicable: number;
    total: number;
    confidence: Confidence;
  };
  categories: Array<{
    id: CategoryId;
    score: number | null;
    applicable: number;
    total: number;
  }>;
};

export function scoreFindings(checks: AuditCheck[], findings: AuditFinding[], config: AuditConfig = {}): ScoredReportParts {
  const weights = {
    source: config.weights ? ("custom" as const) : ("default" as const),
    values: { ...DEFAULT_WEIGHTS, ...config.weights },
  };

  const categories = CATEGORY_ORDER.map((id) => {
    const categoryChecks = checks.filter((check) => check.category === id);
    const categoryFindings = findings.filter((finding) => finding.category === id && finding.outcome !== "na");
    const scores = categoryFindings.map((finding) => finding.measure.value);
    const score = scores.length === 0 ? null : roundScore(mean(scores) * 100);

    return {
      id,
      score,
      applicable: categoryFindings.length,
      total: categoryChecks.length,
    };
  });

  const scoredCategories = categories.filter((category) => category.score !== null);
  const weightTotal = scoredCategories.reduce((sum, category) => sum + weights.values[category.id], 0);
  const composite =
    weightTotal === 0
      ? 0
      : roundScore(
          scoredCategories.reduce((sum, category) => {
            return sum + (category.score ?? 0) * weights.values[category.id];
          }, 0) / weightTotal,
        );

  const applicable = findings.filter((finding) => finding.outcome !== "na").length;
  const total = checks.length;

  return {
    weights,
    composite,
    applicability: {
      applicable,
      total,
      confidence: confidenceFor(total === 0 ? 0 : applicable / total),
    },
    categories,
  };
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function roundScore(value: number): number {
  return Math.round(value * 10) / 10;
}

function confidenceFor(applicabilityRatio: number): Confidence {
  if (applicabilityRatio >= 0.9) {
    return "high";
  }

  if (applicabilityRatio >= 0.7) {
    return "medium";
  }

  return "low";
}
