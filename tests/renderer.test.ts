import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderAuditReport } from "../src/render/terminal.ts";
import type { AuditReport } from "../src/audit/types.ts";

describe("terminal renderer", () => {
  it("renders a stable report snapshot", () => {
    const report: AuditReport = baseReport({
      findings: [
        {
          checkId: "docs.usage-examples",
          category: "docs",
          severity: "critical",
          outcome: "fail",
          measure: {
            kind: "ratio",
            value: 0.5,
            detail: "1/2 exported components have importable usage examples; missing: Card",
          },
          evidence: ["Card"],
          fix: "Add one canonical story/example per component.",
          receipt: "Agents recreate components they can't see used (Atlassian DESIGN.md experiment).",
        },
        {
          checkId: "api.types-resolve",
          category: "api",
          severity: "critical",
          outcome: "pass",
          measure: {
            kind: "ratio",
            value: 1,
            detail: "30/30 exports typecheck",
          },
          evidence: [],
          fix: "Repair the package types/exports mapping so every public export is importable.",
          receipt: "Wrong import paths are a documented agent failure mode.",
        },
        {
          checkId: "deprecation.marked",
          category: "deprecation",
          severity: "warning",
          outcome: "na",
          measure: {
            kind: "count",
            value: 0,
            detail: "no deprecated exports detected",
          },
          evidence: [],
          fix: "Add @deprecated to legacy exports.",
          receipt: "Deprecated patterns dominate training data unless current source clearly marks them as deprecated.",
        },
      ],
    });

    assert.equal(
      renderAuditReport(report),
      `ds-bench audit: missing-usage-examples
target: /fixtures/missing-usage-examples
rubric: ARS v0.2 (22 scored checks, registry 176a3461) | tool: 0.0.0

composite score: 50/100
applicable checks: 1/1 (high confidence)
detected carriers: Storybook stories/MDX, TypeScript exports, package.json exports/types

categories:
  legend: (N/M) = applicable/scored checks; weight redistributed = N/A category weight moved to applicable categories.
  Docs & examples         [#####.....]    50 (1/1)
  API clarity             [N/A       ]   N/A (0/0) weight redistributed
  Usage guidance          [N/A       ]   N/A (0/0) weight redistributed
  Token hygiene           [N/A       ]   N/A (0/0) weight redistributed
  Deprecation signalling  [N/A       ]   N/A (0/0) weight redistributed
  Agent metadata          [N/A       ]   N/A (0/0) weight redistributed

findings:
  [fail] critical docs.usage-examples
    measure: 1/2 exported components have importable usage examples; missing: Card
    evidence: Card
    fix: Add one canonical story/example per component.
    receipt: Agents recreate components they can't see used (Atlassian DESIGN.md experiment).
  [pass] api.types-resolve - 30/30 exports typecheck
  [na] deprecation.marked - no deprecated exports detected
`,
    );
  });

  it("caps long measure detail lists in terminal output", () => {
    const report = baseReport({
      target: { name: "long-report", path: "/fixtures/long-report", detectedCarriers: [] },
      composite: 0,
      categories: [
        { id: "docs", score: 0, applicable: 1, total: 1, weightRedistributed: false },
        { id: "api", score: null, applicable: 0, total: 0, weightRedistributed: true },
        { id: "guidance", score: null, applicable: 0, total: 0, weightRedistributed: true },
        { id: "tokens", score: null, applicable: 0, total: 0, weightRedistributed: true },
        { id: "deprecation", score: null, applicable: 0, total: 0, weightRedistributed: true },
        { id: "agent", score: null, applicable: 0, total: 0, weightRedistributed: true },
      ],
      findings: [
        {
          checkId: "tokens.hardcoded-values",
          category: "tokens",
          severity: "warning",
          outcome: "fail",
          measure: {
            kind: "count",
            value: 10,
            detail:
              "12 magic values across 10 style LOC (120 per 100 LOC); token references: 0; offenders: one, two, three, four, five, six, seven, eight, nine, ten, eleven, twelve",
          },
          evidence: ["one", "two", "three"],
          fix: "Use tokens.",
          receipt: "Hardcoded values are copied.",
        },
      ],
    });

    const output = renderAuditReport(report);

    assert.match(
      output,
      /offenders \(showing 8 of 12\): one, two, three, four, five, six, seven, eight/,
    );
    assert.doesNotMatch(output, /nine, ten, eleven, twelve/);
  });

  it("orders failures first by severity and keeps pass/na findings compact", () => {
    const report = baseReport({
      findings: [
        finding({
          checkId: "api.types-resolve",
          severity: "critical",
          outcome: "pass",
          detail: "30/30 exports typecheck",
        }),
        finding({
          checkId: "tokens.hardcoded-values",
          category: "tokens",
          severity: "warning",
          outcome: "fail",
          detail: "2 hardcoded values",
          fix: "Use tokens.",
          receipt: "Hardcoded values are copied.",
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

    assert.match(
      output,
      /findings:\n  \[fail\] critical docs\.usage-examples\n(?:.*\n){4}  \[fail\] warning tokens\.hardcoded-values\n/,
    );
    assert.match(output, /  \[pass\] api\.types-resolve - 30\/30 exports typecheck\n/);
    assert.match(output, /  \[na\] deprecation\.marked - no deprecated exports detected\n/);
    assert.doesNotMatch(output, /\[pass\][\s\S]*fix:/);
    assert.doesNotMatch(output, /\[na\][\s\S]*fix:/);
  });

  it("emits ANSI styling only when color is enabled and NO_COLOR is unset", () => {
    const report = baseReport({
      findings: [
        finding({ checkId: "docs.usage-examples", severity: "critical", outcome: "fail" }),
        finding({ checkId: "api.types-resolve", severity: "critical", outcome: "pass", detail: "30/30 exports typecheck" }),
      ],
    });
    const originalNoColor = process.env.NO_COLOR;

    try {
      delete process.env.NO_COLOR;
      assert.match(renderAuditReport(report, { color: true }), /\u001b\[/);
      assert.doesNotMatch(renderAuditReport(report, { color: false }), /\u001b\[/);
      assert.match(renderAuditReport(report, { color: false }), /  \[fail\] critical docs\.usage-examples/);

      process.env.NO_COLOR = "1";
      assert.doesNotMatch(renderAuditReport(report, { color: true }), /\u001b\[/);
      assert.match(renderAuditReport(report, { color: true }), /  \[fail\] critical docs\.usage-examples/);
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
