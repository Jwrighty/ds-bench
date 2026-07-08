import { CATEGORY_ORDER, DEFAULT_WEIGHTS } from "./categories.ts";
import type { AuditCheck, AuditConfig, AuditFinding, CategoryId, Confidence, Severity } from "./types.ts";

const SEVERITY_WEIGHTS: Record<Severity, number> = {
  critical: 4,
  warning: 2,
  info: 1,
};

export type FindingScoreInput = AuditFinding & {
  score: number | null;
};

export function toReportFinding(finding: FindingScoreInput): AuditFinding {
  const { score: _score, ...reportFinding } = finding;
  return reportFinding;
}

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
    weightRedistributed: boolean;
  }>;
};

export function scoreFindings(checks: AuditCheck[], findings: FindingScoreInput[], config: AuditConfig = {}): ScoredReportParts {
  const scoredChecks = checks.filter((check) => check.scored !== false);
  const scoredChecksById = new Map(scoredChecks.map((check) => [check.id, check]));
  const scoredCheckIds = new Set(scoredChecksById.keys());
  const weights = {
    source: config.weights ? ("custom" as const) : ("default" as const),
    values: { ...DEFAULT_WEIGHTS, ...config.weights },
  };

  const categories = CATEGORY_ORDER.map((id) => {
    const categoryChecks = scoredChecks.filter((check) => check.category === id);
    const categoryFindings = findings.filter(
      (finding) => scoredCheckIds.has(finding.checkId) && finding.category === id && finding.outcome !== "na",
    );
    const weightedScores = categoryFindings.map((finding) => {
      const check = scoredChecksById.get(finding.checkId);
      const weight = check ? SEVERITY_WEIGHTS[check.severity] : 0;

      return {
        score: finding.score ?? 0,
        weight,
      };
    });
    const score = weightedScores.length === 0 ? null : roundScore(weightedMean(weightedScores) * 100);

    return {
      id,
      score,
      applicable: categoryFindings.length,
      total: categoryChecks.length,
      weightRedistributed: score === null && weights.values[id] > 0,
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

  const applicabilityFindings = findings.filter((finding) => scoredCheckIds.has(finding.checkId));
  const applicable = applicabilityFindings.filter((finding) => finding.outcome !== "na").length;
  const uncoveredNa = applicabilityFindings.filter((finding) => {
    const check = scoredChecksById.get(finding.checkId);
    const naReason = finding.naReason ?? check?.naReason;
    return finding.outcome === "na" && naReason !== "clean";
  }).length;
  const total = applicable + uncoveredNa;

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

function weightedMean(values: Array<{ score: number; weight: number }>): number {
  const weightTotal = values.reduce((sum, value) => sum + value.weight, 0);
  if (weightTotal === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value.score * value.weight, 0) / weightTotal;
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
