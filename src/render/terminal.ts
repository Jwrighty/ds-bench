import { CATEGORY_LABELS } from "../audit/categories.ts";
import type { AuditFinding, AuditReport } from "../audit/types.ts";

export function renderAuditReport(report: AuditReport): string {
  const lines = [
    `ds-bench audit: ${report.target.name}`,
    `target: ${report.target.path}`,
    `rubric: ${report.rubricVersion} | tool: ${report.toolVersion}`,
    "",
    `composite score: ${formatScore(report.composite)}/100`,
    `applicable checks: ${report.applicability.applicable}/${report.applicability.total} (${report.applicability.confidence} confidence)`,
    `detected carriers: ${report.target.detectedCarriers.length === 0 ? "none" : report.target.detectedCarriers.join(", ")}`,
    "",
    "categories:",
    ...report.categories.map(
      (category) =>
        `  ${CATEGORY_LABELS[category.id].padEnd(23)} ${renderBar(category.score)} ${formatCategoryScore(category.score)} (${category.applicable}/${category.total})`,
    ),
    "",
    "findings:",
    ...report.findings.flatMap(renderFinding),
  ];

  return `${lines.join("\n")}\n`;
}

function renderFinding(finding: AuditFinding): string[] {
  return [
    `  [${finding.severity}] ${finding.checkId} - ${finding.outcome}`,
    `    measure: ${finding.measure.detail}`,
    `    evidence: ${finding.evidence.length === 0 ? "none" : finding.evidence.join(", ")}`,
    `    fix: ${finding.fix}`,
    `    receipt: ${finding.receipt}`,
  ];
}

function renderBar(score: number | null): string {
  if (score === null) {
    return "[N/A       ]";
  }

  const filled = Math.round(score / 10);
  return `[${"#".repeat(filled)}${".".repeat(10 - filled)}]`;
}

function formatCategoryScore(score: number | null): string {
  return score === null ? "N/A".padStart(5) : `${formatScore(score)}`.padStart(5);
}

function formatScore(score: number): string {
  return Number.isInteger(score) ? String(score) : score.toFixed(1);
}
