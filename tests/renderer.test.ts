import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderAuditReport } from "../src/render/terminal.ts";
import type { AuditReport } from "../src/audit/types.ts";

describe("terminal renderer", () => {
  it("renders a stable report snapshot", () => {
    const report: AuditReport = {
      rubricVersion: "ARS v0",
      toolVersion: "0.0.0",
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
rubric: ARS v0 | tool: 0.0.0

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
});
