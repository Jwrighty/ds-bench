import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderAuditReport } from "../src/render/terminal.ts";
import type { AuditReport } from "../src/audit/types.ts";

describe("terminal renderer", () => {
  it("renders a stable report snapshot", () => {
    const report: AuditReport = {
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
      ],
    };

    assert.equal(
      renderAuditReport(report),
      `ds-bench audit: missing-usage-examples
target: /fixtures/missing-usage-examples
rubric: ARS v0.2 (22 scored checks, registry 176a3461) | tool: 0.0.0

composite score: 50/100
applicable checks: 1/1 (high confidence)
detected carriers: Storybook stories/MDX, TypeScript exports, package.json exports/types

categories:
  Docs & examples         [#####.....]    50 (1/1)
  API clarity             [N/A       ]   N/A (0/0) weight redistributed
  Usage guidance          [N/A       ]   N/A (0/0) weight redistributed
  Token hygiene           [N/A       ]   N/A (0/0) weight redistributed
  Deprecation signalling  [N/A       ]   N/A (0/0) weight redistributed
  Agent metadata          [N/A       ]   N/A (0/0) weight redistributed

findings:
  [critical] docs.usage-examples - fail
    measure: 1/2 exported components have importable usage examples; missing: Card
    evidence: Card
    fix: Add one canonical story/example per component.
    receipt: Agents recreate components they can't see used (Atlassian DESIGN.md experiment).
`,
    );
  });

  it("caps long measure detail lists in terminal output", () => {
    const report: AuditReport = {
      rubricVersion: "ARS v0.2",
      toolVersion: "0.0.0",
      scoredCheckCount: 22,
      registryFingerprint: "176a3461",
      target: {
        name: "long-report",
        path: "/fixtures/long-report",
        detectedCarriers: [],
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
      composite: 0,
      applicability: {
        applicable: 1,
        total: 1,
        confidence: "high",
      },
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
    };

    const output = renderAuditReport(report);

    assert.match(
      output,
      /offenders \(showing 8 of 12\): one, two, three, four, five, six, seven, eight/,
    );
    assert.doesNotMatch(output, /nine, ten, eleven, twelve/);
  });
});
