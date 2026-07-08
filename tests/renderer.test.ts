import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderAuditReport } from "../src/render/terminal.ts";
import type { AuditReport } from "../src/audit/types.ts";

describe("terminal renderer", () => {
  it("renders the default report as a summary with capped top findings", () => {
    const report = baseReport({
      findings: [
        finding({
          checkId: "api.types-resolve",
          severity: "critical",
          outcome: "pass",
          detail: "30/30 exports typecheck",
        }),
        finding({
          checkId: "docs.usage-examples",
          category: "docs",
          severity: "critical",
          outcome: "fail",
          detail: "1/2 exported components have importable usage examples; missing: Card",
        }),
        finding({
          checkId: "deprecation.marked",
          category: "deprecation",
          severity: "warning",
          outcome: "na",
          detail: "no deprecated exports detected",
        }),
      ],
    });

    const output = renderAuditReport(report);

    assert.match(output, /DS Bench Audit: missing-usage-examples/);
    assert.match(output, /Score: 50 \/ 100 - Not agent-ready/);
    assert.match(output, /Applicable Checks: 1 \/ 1/);
    assert.match(output, /Category Scores\nCategory\s+Score\s+Checks/);
    assert.match(output, /Top Findings\n1\. \[critical\] docs\.usage-examples/);
    assert.match(output, /Missing: Card/);
    assert.match(output, /Fix: Add one canonical story\/example per component\./);
    assert.match(output, /Full Detail\n  Run with --verbose for all evidence:/);
    assert.match(output, /Result: 50\/100 - Not agent-ready/);
    assert.doesNotMatch(output, /Evidence:/);
    assert.doesNotMatch(output, /Receipt:/);
    assert.doesNotMatch(output, /api\.types-resolve/);
    assert.doesNotMatch(output, /deprecation\.marked/);
  });

  it("orders failures by severity and shows only the top five by default", () => {
    const report = baseReport({
      findings: [
        finding({ checkId: "warning.one", severity: "warning", detail: "warning one" }),
        finding({ checkId: "warning.two", severity: "warning", detail: "warning two" }),
        finding({ checkId: "info.one", severity: "info", detail: "info one" }),
        finding({ checkId: "critical.one", severity: "critical", detail: "critical one" }),
        finding({ checkId: "warning.three", severity: "warning", detail: "warning three" }),
        finding({ checkId: "info.two", severity: "info", detail: "info two" }),
      ],
    });

    const output = renderAuditReport(report);

    assert.match(
      output,
      /Top Findings\n1\. \[critical\] critical\.one[\s\S]*2\. \[warning\] warning\.one[\s\S]*4\. \[warning\] warning\.three[\s\S]*5\. \[info\] info\.one/,
    );
    assert.match(output, /Showing 5 of 6 failing findings\. Run with --verbose to see all evidence\./);
    assert.doesNotMatch(output, /6\. \[info\] info\.two/);
  });

  it("summarizes long collections in normal output and expands them in verbose output", () => {
    const report = baseReport({
      findings: [
        finding({
          checkId: "tokens.hardcoded-values",
          category: "tokens",
          severity: "warning",
          detail:
            "12 magic values across 10 style LOC (120 per 100 LOC); token references: 0; offenders: one, two, three, four, five, six, seven, eight, nine, ten, eleven, twelve",
          evidence: ["one", "two", "three"],
          fix: "Use tokens.",
          receipt: "Hardcoded values are copied.",
        }),
      ],
    });

    const normalOutput = renderAuditReport(report);
    const verboseOutput = renderAuditReport(report, { mode: "verbose" });

    assert.match(normalOutput, /Offenders: 12 total; showing 8\./);
    assert.match(normalOutput, /  eight/);
    assert.doesNotMatch(normalOutput, /  nine/);
    assert.match(normalOutput, /Run with --verbose to see all 12\./);

    assert.match(verboseOutput, /Offenders: 12 total; showing 12\./);
    assert.match(verboseOutput, /  twelve/);
    assert.match(verboseOutput, /Evidence \(3\):/);
    assert.match(verboseOutput, /Receipt: Hardcoded values are copied\./);
  });

  it("renders compact output for CI summaries", () => {
    const report = baseReport({
      composite: 96,
      findings: [
        finding({
          checkId: "docs.usage-examples",
          severity: "critical",
          detail: "28/30 exported components have importable usage examples; missing: MetricCard, StatusPill",
        }),
        finding({ checkId: "tokens.hardcoded-values", category: "tokens", severity: "warning" }),
      ],
    });

    assert.equal(
      renderAuditReport(report, { mode: "compact" }),
      `DS Bench missing-usage-examples: 96/100 - Agent-ready with gaps - 1 critical - 1 warning - 0 info
Critical: docs.usage-examples - Missing MetricCard, StatusPill
`,
    );
  });

  it("renders verbose mode with all findings, evidence, and receipts", () => {
    const report = baseReport({
      findings: [
        finding({
          checkId: "docs.usage-examples",
          severity: "critical",
          outcome: "fail",
          evidence: ["Card"],
        }),
        finding({
          checkId: "api.types-resolve",
          severity: "critical",
          outcome: "pass",
          detail: "30/30 exports typecheck",
          evidence: [],
        }),
      ],
    });

    const output = renderAuditReport(report, { mode: "verbose" });

    assert.match(output, /Findings\n\[fail\] critical docs\.usage-examples/);
    assert.match(output, /Evidence \(1\):\n    Card/);
    assert.match(output, /Receipt: Agents recreate components they can't see used/);
    assert.match(output, /\[pass\] api\.types-resolve/);
    assert.match(output, /Full Detail\n  Run with --json for machine-readable output\./);
    assert.match(output, /Next: run `ds-bench audit \/fixtures\/missing-usage-examples --json`/);
    assert.doesNotMatch(output, /\[pass\] api\.types-resolve[\s\S]*Fix:/);
  });

  it("emits ANSI styling only when color is enabled and NO_COLOR is unset", () => {
    const report = baseReport({
      findings: [
        finding({ checkId: "docs.usage-examples", severity: "critical", outcome: "fail" }),
      ],
    });
    const originalNoColor = process.env.NO_COLOR;

    try {
      delete process.env.NO_COLOR;
      assert.match(renderAuditReport(report, { color: true }), /\u001b\[/);
      assert.doesNotMatch(renderAuditReport(report, { color: false }), /\u001b\[/);
      assert.match(renderAuditReport(report, { color: false }), /Score: 50 \/ 100 - Not agent-ready/);

      process.env.NO_COLOR = "1";
      assert.doesNotMatch(renderAuditReport(report, { color: true }), /\u001b\[/);
      assert.match(renderAuditReport(report, { color: true }), /1\. \[critical\] docs\.usage-examples/);
    } finally {
      if (originalNoColor === undefined) {
        delete process.env.NO_COLOR;
      } else {
        process.env.NO_COLOR = originalNoColor;
      }
    }
  });
});

function baseReport(overrides: Partial<AuditReport> = {}): AuditReport {
  return {
    rubricVersion: "ARS v0.2",
    toolVersion: "0.0.0",
    scoredCheckCount: 22,
    registryFingerprint: "176a3461",
    target: {
      name: "missing-usage-examples",
      path: "/fixtures/missing-usage-examples",
      detectedCarriers: ["Storybook stories/MDX", "TypeScript exports", "package.json exports/types"],
    },
    weights: {
      source: "default",
      values: {
        docs: 25,
        api: 20,
        guidance: 15,
        tokens: 15,
        deprecation: 15,
        agent: 10,
      },
    },
    composite: 50,
    applicability: {
      applicable: 1,
      total: 1,
      confidence: "high",
    },
    categories: [
      { id: "docs", score: 50, applicable: 1, total: 1, weightRedistributed: false },
      { id: "api", score: null, applicable: 0, total: 0, weightRedistributed: true },
      { id: "guidance", score: null, applicable: 0, total: 0, weightRedistributed: true },
      { id: "tokens", score: null, applicable: 0, total: 0, weightRedistributed: true },
      { id: "deprecation", score: null, applicable: 0, total: 0, weightRedistributed: true },
      { id: "agent", score: null, applicable: 0, total: 0, weightRedistributed: true },
    ],
    findings: [],
    ...overrides,
  };
}

type FindingOverrides = Partial<AuditReport["findings"][number]> & {
  detail?: string;
};

function finding(overrides: FindingOverrides = {}): AuditReport["findings"][number] {
  const { detail, ...findingOverrides } = overrides;

  return {
    checkId: "docs.usage-examples",
    category: "docs",
    severity: "critical",
    outcome: "fail",
    evidence: ["Card"],
    fix: "Add one canonical story/example per component.",
    receipt: "Agents recreate components they can't see used (Atlassian DESIGN.md experiment).",
    ...findingOverrides,
    measure: {
      kind: overrides.measure?.kind ?? "ratio",
      value: overrides.measure?.value ?? 0.5,
      detail: overrides.measure?.detail ?? detail ?? "1/2 exported components have importable usage examples; missing: Card",
    },
  };
}
