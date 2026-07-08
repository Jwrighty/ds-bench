import { CATEGORY_LABELS } from "../audit/categories.ts";
import type { AuditFinding, AuditReport } from "../audit/types.ts";

const MAX_RENDERED_DETAIL_ITEMS = 8;
const MAX_RENDERED_DETAIL_LENGTH = 500;

export function renderAuditReport(report: AuditReport): string {
  const lines = [
    `ds-bench audit: ${report.target.name}`,
    `target: ${report.target.path}`,
    `rubric: ${report.rubricVersion} (${report.scoredCheckCount} scored checks, registry ${report.registryFingerprint}) | tool: ${report.toolVersion}`,
    "",
    `composite score: ${formatScore(report.composite)}/100`,
    `applicable checks: ${report.applicability.applicable}/${report.applicability.total} (${report.applicability.confidence} confidence)`,
    `detected carriers: ${report.target.detectedCarriers.length === 0 ? "none" : report.target.detectedCarriers.join(", ")}`,
    "",
    "categories:",
    ...report.categories.map(
      (category) =>
        `  ${CATEGORY_LABELS[category.id].padEnd(23)} ${renderBar(category.score)} ${formatCategoryScore(category.score)} (${category.applicable}/${category.total})${category.weightRedistributed ? " weight redistributed" : ""}`,
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
    `    measure: ${formatMeasureDetail(finding.measure.detail)}`,
    `    evidence: ${finding.evidence.length === 0 ? "none" : finding.evidence.join(", ")}`,
    `    fix: ${finding.fix}`,
    `    receipt: ${finding.receipt}`,
  ];
}

function formatMeasureDetail(detail: string): string {
  const listMatch = /^(?<prefix>.*?\b(?<label>offenders|missing|unresolved)):\s+(?<items>.+)$/s.exec(detail);
  const itemText = listMatch?.groups?.items;
  if (itemText) {
    const items = splitDetailItems(itemText, listMatch.groups?.label);
    if (items.length > MAX_RENDERED_DETAIL_ITEMS) {
      const prefix = listMatch.groups?.prefix ?? "";
      return `${prefix} (showing ${MAX_RENDERED_DETAIL_ITEMS} of ${items.length}): ${items
        .slice(0, MAX_RENDERED_DETAIL_ITEMS)
        .join(", ")}`;
    }
  }

  if (detail.length <= MAX_RENDERED_DETAIL_LENGTH) {
    return detail;
  }

  return `${detail.slice(0, MAX_RENDERED_DETAIL_LENGTH).trimEnd()}... (truncated)`;
}

function splitDetailItems(itemText: string, label: string | undefined): string[] {
  if (label === "offenders") {
    const offenderItems = itemText.split(/,\s+(?=[^,]+ in )/);
    return offenderItems.length > 1 ? offenderItems : itemText.split(/,\s+/);
  }

  return itemText.split(/,\s+/);
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
