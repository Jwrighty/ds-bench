import { CATEGORY_LABELS } from "../audit/categories.ts";
import type { AuditFinding, AuditReport } from "../audit/types.ts";

const MAX_RENDERED_DETAIL_ITEMS = 8;
const MAX_RENDERED_DETAIL_LENGTH = 500;

type RenderOptions = {
  color?: boolean;
};

type Style = {
  outcome(value: string, outcome: AuditFinding["outcome"]): string;
  severity(value: string, severity: AuditFinding["severity"]): string;
};

const ANSI = {
  reset: "\u001b[0m",
  bold: "\u001b[1m",
  dim: "\u001b[2m",
  red: "\u001b[31m",
  yellow: "\u001b[33m",
  green: "\u001b[32m",
};

const plainStyle: Style = {
  outcome: (value) => value,
  severity: (value) => value,
};

const SEVERITY_RANK = {
  critical: 0,
  warning: 1,
  info: 2,
} satisfies Record<AuditFinding["severity"], number>;

export function renderAuditReport(report: AuditReport, options: RenderOptions = {}): string {
  const style = shouldUseColor(options) ? colorStyle : plainStyle;
  const findings = orderFindings(report.findings);
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
    `  legend: (N/M) = applicable/scored checks; weight redistributed = N/A category weight moved to applicable categories.`,
    ...report.categories.map(
      (category) =>
        `  ${CATEGORY_LABELS[category.id].padEnd(23)} ${renderBar(category.score)} ${formatCategoryScore(category.score)} (${category.applicable}/${category.total})${category.weightRedistributed ? " weight redistributed" : ""}`,
    ),
    "",
    "findings:",
    ...findings.flatMap((finding) => renderFinding(finding, style)),
  ];

  return `${lines.join("\n")}\n`;
}

function renderFinding(finding: AuditFinding, style: Style): string[] {
  if (finding.outcome !== "fail") {
    return [
      `  ${style.outcome(`[${finding.outcome}]`, finding.outcome)} ${finding.checkId} - ${formatMeasureDetail(finding.measure.detail)}`,
    ];
  }

  return [
    `  ${style.outcome("[fail]", finding.outcome)} ${style.severity(finding.severity, finding.severity)} ${finding.checkId}`,
    `    measure: ${formatMeasureDetail(finding.measure.detail)}`,
    `    evidence: ${finding.evidence.length === 0 ? "none" : finding.evidence.join(", ")}`,
    `    fix: ${finding.fix}`,
    `    receipt: ${finding.receipt}`,
  ];
}

function orderFindings(findings: AuditFinding[]): AuditFinding[] {
  return findings
    .map((finding, index) => ({ finding, index }))
    .sort((left, right) => {
      const leftOutcome = left.finding.outcome === "fail" ? 0 : 1;
      const rightOutcome = right.finding.outcome === "fail" ? 0 : 1;

      if (leftOutcome !== rightOutcome) {
        return leftOutcome - rightOutcome;
      }

      if (leftOutcome === 0) {
        const severityDelta =
          severityRank(left.finding.severity) - severityRank(right.finding.severity);
        if (severityDelta !== 0) {
          return severityDelta;
        }
      }

      return left.index - right.index;
    })
    .map(({ finding }) => finding);
}

function severityRank(severity: AuditFinding["severity"]): number {
  return SEVERITY_RANK[severity];
}

function shouldUseColor(options: RenderOptions): boolean {
  const colorCapable = options.color ?? Boolean(process.stdout.isTTY);
  return colorCapable && process.env.NO_COLOR === undefined;
}

const colorStyle: Style = {
  outcome(value, outcome) {
    return wrap(value, ...OUTCOME_STYLES[outcome]);
  },
  severity(value, severity) {
    return wrap(value, ...SEVERITY_STYLES[severity]);
  },
};

const OUTCOME_STYLES = {
  fail: [ANSI.bold, ANSI.red],
  pass: [ANSI.green],
  na: [ANSI.dim],
} satisfies Record<AuditFinding["outcome"], string[]>;

const SEVERITY_STYLES = {
  critical: [ANSI.bold, ANSI.red],
  warning: [ANSI.yellow],
  info: [ANSI.dim],
} satisfies Record<AuditFinding["severity"], string[]>;

function wrap(value: string, ...codes: string[]): string {
  return `${codes.join("")}${value}${ANSI.reset}`;
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
