import { CATEGORY_LABELS } from "../audit/categories.ts";
import type { AuditFinding, AuditReport } from "../audit/types.ts";

const NORMAL_FINDING_LIMIT = 5;
const SUMMARY_ITEM_LIMIT = 8;
const WRAP_WIDTH = 112;

export type RenderMode = "normal" | "compact" | "verbose";

type RenderOptions = {
  color?: boolean;
  mode?: RenderMode;
};

type Style = {
  outcome(value: string, outcome: AuditFinding["outcome"]): string;
  severity(value: string, severity: AuditFinding["severity"]): string;
  score(value: string, report: AuditReport): string;
};

type DetailParts = {
  summary: string;
  label: string | null;
  items: string[];
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
  score: (value) => value,
};

const SEVERITY_RANK = {
  critical: 0,
  warning: 1,
  info: 2,
} satisfies Record<AuditFinding["severity"], number>;

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

export function renderAuditReport(report: AuditReport, options: RenderOptions = {}): string {
  const mode = options.mode ?? "normal";
  const style = shouldUseColor(options) ? colorStyle : plainStyle;

  if (mode === "compact") {
    return renderCompactReport(report, style);
  }

  const lines = [
    ...renderHeader(report, style),
    "",
    ...renderCategoryTable(report),
    "",
    ...(mode === "verbose" ? renderVerboseFindings(report, style) : renderTopFindings(report, style)),
    "",
    ...renderFullDetailHint(report, mode),
    "",
    ...renderFooter(report, mode, style),
  ];

  return `${lines.join("\n")}\n`;
}

function renderCompactReport(report: AuditReport, style: Style): string {
  const failures = orderFindings(report.findings).filter((finding) => finding.outcome === "fail");
  const counts = countFailingSeverities(failures);
  const topFinding = failures[0];
  const lines = [
    `DS Bench ${report.target.name}: ${style.score(`${formatScore(report.composite)}/100`, report)} - ${verdictFor(report)} - ${formatSeverityCounts(counts)}`,
  ];

  if (topFinding) {
    const detail = parseDetail(topFinding.measure.detail);
    const shortDetail = detail.label && detail.items.length > 0
      ? `${formatDetailLabel(detail.label)} ${detail.items.slice(0, 3).join(", ")}`
      : detail.summary;
    lines.push(
      `${capitalize(topFinding.severity)}: ${topFinding.checkId} - ${clip(shortDetail, 88)}`,
    );
  } else {
    lines.push("No failing findings.");
  }

  return `${lines.join("\n")}\n`;
}

function renderHeader(report: AuditReport, style: Style): string[] {
  return [
    `ds-bench audit ${report.target.name}`,
    "",
    `DS Bench Audit: ${report.target.name}`,
    `Score: ${style.score(`${formatScore(report.composite)} / 100`, report)} - ${verdictFor(report)}`,
    `Applicable Checks: ${report.applicability.applicable} / ${report.applicability.total}`,
    `Confidence: ${report.applicability.confidence}`,
    `Target: ${report.target.path}`,
    ...wrapText(
      `Carriers: ${report.target.detectedCarriers.length === 0 ? "none" : report.target.detectedCarriers.join(", ")}`,
      "",
      "  ",
    ),
  ];
}

function renderCategoryTable(report: AuditReport): string[] {
  const rows = report.categories.map((category) => ({
    category: CATEGORY_LABELS[category.id],
    score: category.score === null ? "N/A" : formatScore(category.score),
    checks: `${category.applicable}/${category.total}${category.weightRedistributed ? " redistributed" : ""}`,
  }));
  const categoryWidth = Math.max("Category".length, ...rows.map((row) => row.category.length));
  const scoreWidth = Math.max("Score".length, ...rows.map((row) => row.score.length));
  const checksWidth = Math.max("Checks".length, ...rows.map((row) => row.checks.length));
  const rule = `${"-".repeat(categoryWidth)}  ${"-".repeat(scoreWidth)}  ${"-".repeat(checksWidth)}`;

  return [
    "Category Scores",
    `${"Category".padEnd(categoryWidth)}  ${"Score".padStart(scoreWidth)}  ${"Checks".padEnd(checksWidth)}`,
    rule,
    ...rows.map(
      (row) =>
        `${row.category.padEnd(categoryWidth)}  ${row.score.padStart(scoreWidth)}  ${row.checks}`,
    ),
    "",
    "Legend: redistributed = N/A category weight moved to applicable categories.",
  ];
}

function renderTopFindings(report: AuditReport, style: Style): string[] {
  const failures = orderFindings(report.findings).filter((finding) => finding.outcome === "fail");
  const shown = failures.slice(0, NORMAL_FINDING_LIMIT);

  if (shown.length === 0) {
    return ["Top Findings", "No failing findings."];
  }

  const lines = [
    "Top Findings",
    ...shown.flatMap((finding, index) => renderSummaryFinding(finding, index + 1, style)),
  ];

  if (failures.length > shown.length) {
    lines.push(
      `Showing ${shown.length} of ${failures.length} failing findings. Run with --verbose to see all evidence.`,
    );
  }

  return lines;
}

function renderSummaryFinding(finding: AuditFinding, number: number, style: Style): string[] {
  const detail = parseDetail(finding.measure.detail);
  const lines = [
    `${number}. ${style.severity(`[${finding.severity}]`, finding.severity)} ${finding.checkId}`,
    ...wrapText(detail.summary, "   ", "   "),
    ...renderDetailItems(detail, "   ", SUMMARY_ITEM_LIMIT),
    ...wrapText(`Fix: ${finding.fix}`, "   ", "     "),
    "",
  ];

  return lines;
}

function renderVerboseFindings(report: AuditReport, style: Style): string[] {
  const findings = orderFindings(report.findings);

  if (findings.length === 0) {
    return ["Findings", "No findings."];
  }

  return [
    "Findings",
    ...findings.flatMap((finding) => renderVerboseFinding(finding, style)),
  ];
}

function renderVerboseFinding(finding: AuditFinding, style: Style): string[] {
  const detail = parseDetail(finding.measure.detail);
  const status = style.outcome(`[${finding.outcome}]`, finding.outcome);
  const heading = finding.outcome === "fail"
    ? `${status} ${style.severity(finding.severity, finding.severity)} ${finding.checkId}`
    : `${status} ${finding.checkId}`;
  const lines = [
    heading,
    ...wrapText(`Measure: ${detail.summary}`, "  ", "    "),
    ...renderDetailItems(detail, "  ", Number.POSITIVE_INFINITY),
    ...renderEvidence(finding.evidence),
  ];

  if (finding.outcome === "fail") {
    lines.push(
      ...wrapText(`Fix: ${finding.fix}`, "  ", "    "),
      ...wrapText(`Receipt: ${finding.receipt}`, "  ", "    "),
    );
  }

  lines.push("");
  return lines;
}

function renderEvidence(evidence: string[]): string[] {
  if (evidence.length === 0) {
    return ["  Evidence: none"];
  }

  return [
    `  Evidence (${evidence.length}):`,
    ...evidence.flatMap((item) => wrapText(clip(item, WRAP_WIDTH - 4), "    ", "    ")),
  ];
}

function renderFullDetailHint(report: AuditReport, mode: RenderMode): string[] {
  if (mode === "verbose") {
    return ["Full Detail", "  Run with --json for machine-readable output."];
  }

  return [
    "Full Detail",
    `  Run with --verbose for all evidence: ds-bench audit ${report.target.path} --verbose`,
    "  Run with --json for machine-readable output.",
  ];
}

function renderFooter(report: AuditReport, mode: RenderMode, style: Style): string[] {
  const failures = report.findings.filter((finding) => finding.outcome === "fail");
  const counts = countFailingSeverities(failures);
  const next = mode === "verbose"
    ? `Next: run \`ds-bench audit ${report.target.path} --json\` for machine-readable output`
    : `Next: run \`ds-bench audit ${report.target.path} --verbose\` for full evidence`;

  return [
    "-".repeat(44),
    `Result: ${style.score(`${formatScore(report.composite)}/100`, report)} - ${verdictFor(report)}`,
    `Findings: ${formatSeverityCounts(counts)}`,
    `Checks: ${report.applicability.applicable}/${report.applicability.total} applicable - confidence: ${report.applicability.confidence}`,
    next,
    "-".repeat(44),
  ];
}

function renderDetailItems(detail: DetailParts, indent: string, limit: number): string[] {
  if (!detail.label || detail.items.length === 0) {
    return [];
  }

  const shown = detail.items.slice(0, limit);
  const label = formatDetailLabel(detail.label);

  if (detail.items.length === 1) {
    return wrapText(`${label}: ${shown[0]}`, indent, `${indent}  `);
  }

  return [
    `${indent}${label}: ${detail.items.length} total; showing ${shown.length}.`,
    ...shown.flatMap((item) => wrapText(clip(item, WRAP_WIDTH - indent.length - 2), `${indent}  `, `${indent}  `)),
    ...(shown.length < detail.items.length
      ? [`${indent}Run with --verbose to see all ${detail.items.length}.`]
      : []),
  ];
}

function parseDetail(detail: string): DetailParts {
  const listMatch =
    /^(?<summary>.*?)(?:;\s*)?(?<label>offenders|missing|unresolved|invalid|dead references):\s+(?<items>.+)$/s.exec(
      detail,
    );

  if (!listMatch?.groups) {
    return { summary: detail, label: null, items: [] };
  }

  const label = listMatch.groups.label;
  const items = splitDetailItems(listMatch.groups.items, label).filter((item) => item !== "none");

  return {
    summary: sentenceCase(listMatch.groups.summary.trim()),
    label,
    items,
  };
}

function splitDetailItems(itemText: string, label: string | undefined): string[] {
  if (label === "offenders") {
    const offenderItems = itemText.split(/,\s+(?=[^,]+ in )/);
    return offenderItems.length > 1 ? offenderItems : itemText.split(/,\s+/);
  }

  return itemText.split(/,\s+/);
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

function verdictFor(report: AuditReport): string {
  const hasFailures = report.findings.some((finding) => finding.outcome === "fail");

  if (report.composite >= 90) {
    return hasFailures ? "Agent-ready with gaps" : "Agent-ready";
  }
  if (report.composite >= 70) {
    return "Needs targeted work";
  }
  return "Not agent-ready";
}

function countFailingSeverities(findings: AuditFinding[]): Record<AuditFinding["severity"], number> {
  return {
    critical: findings.filter((finding) => finding.severity === "critical").length,
    warning: findings.filter((finding) => finding.severity === "warning").length,
    info: findings.filter((finding) => finding.severity === "info").length,
  };
}

function formatSeverityCounts(counts: Record<AuditFinding["severity"], number>): string {
  return `${counts.critical} ${pluralize("critical", counts.critical)} - ${counts.warning} ${pluralize("warning", counts.warning)} - ${counts.info} info`;
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
  score(value, report) {
    if (report.composite >= 90) {
      return wrap(value, ANSI.bold, ANSI.green);
    }
    if (report.composite >= 70) {
      return wrap(value, ANSI.bold, ANSI.yellow);
    }
    return wrap(value, ANSI.bold, ANSI.red);
  },
};

function wrap(value: string, ...codes: string[]): string {
  return `${codes.join("")}${value}${ANSI.reset}`;
}

function wrapText(text: string, firstIndent: string, nextIndent: string): string[] {
  const maxFirstWidth = WRAP_WIDTH - firstIndent.length;
  const maxNextWidth = WRAP_WIDTH - nextIndent.length;
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  let currentMax = maxFirstWidth;

  for (const word of words) {
    if (current.length === 0) {
      current = word;
      continue;
    }

    if (`${current} ${word}`.length > currentMax) {
      lines.push(`${lines.length === 0 ? firstIndent : nextIndent}${current}`);
      current = word;
      currentMax = maxNextWidth;
    } else {
      current = `${current} ${word}`;
    }
  }

  if (current.length > 0) {
    lines.push(`${lines.length === 0 ? firstIndent : nextIndent}${current}`);
  }

  return lines.length === 0 ? [firstIndent.trimEnd()] : lines;
}

function formatDetailLabel(label: string): string {
  switch (label) {
    case "dead references":
      return "Dead references";
    case "offenders":
      return "Offenders";
    default:
      return capitalize(label);
  }
}

function sentenceCase(value: string): string {
  return value.length === 0 ? value : `${value[0].toUpperCase()}${value.slice(1)}`;
}

function capitalize(value: string): string {
  return value.length === 0 ? value : `${value[0].toUpperCase()}${value.slice(1)}`;
}

function pluralize(label: string, count: number): string {
  return count === 1 ? label : `${label}s`;
}

function clip(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

function formatScore(score: number): string {
  return Number.isInteger(score) ? String(score) : score.toFixed(1);
}
