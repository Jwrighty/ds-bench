import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { join } from "node:path";
import { audit, sortFindingsForReport } from "../src/audit/audit.ts";
import type { AuditFinding } from "../src/audit/types.ts";

const repoRoot = process.cwd();
const fixturePath = join(repoRoot, "fixtures/missing-usage-examples");

describe("audit seam", () => {
  it("returns the ARS v0 report contract for a missing usage examples fixture", async () => {
    const report = await audit(fixturePath);

    assert.equal(report.rubricVersion, "ARS v0");
    assert.equal(report.toolVersion, "0.0.0");
    assert.equal(report.target.name, "missing-usage-examples");
    assert.deepEqual(report.weights, {
      source: "default",
      values: {
        docs: 25,
        api: 20,
        guidance: 15,
        tokens: 15,
        deprecation: 15,
        agent: 10,
      },
    });
    assert.equal(report.composite, 75);
    assert.deepEqual(report.applicability, {
      applicable: 2,
      total: 3,
      confidence: "low",
    });
    assert.equal(report.categories.length, 6);
    assert.deepEqual(report.categories[0], {
      id: "docs",
      score: 75,
      applicable: 2,
      total: 2,
      weightRedistributed: false,
    });
    assert.deepEqual(report.categories[1], {
      id: "api",
      score: null,
      applicable: 0,
      total: 0,
      weightRedistributed: true,
    });
    assert.deepEqual(report.categories[4], {
      id: "deprecation",
      score: null,
      applicable: 0,
      total: 1,
      weightRedistributed: true,
    });

    assert.equal(report.findings.length, 3);
    assert.deepEqual(report.findings[0], {
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
    });
    assert.deepEqual(report.findings[1], {
      checkId: "docs.example-imports-real",
      category: "docs",
      severity: "critical",
      outcome: "pass",
      measure: {
        kind: "ratio",
        value: 1,
        detail: "1/1 example component imports resolve against exported components; unresolved: none",
      },
      evidence: [],
      fix: "Correct or delete examples with dead imports.",
      receipt: "Wrong import paths are a documented agent failure mode (Astryx self-checks).",
    });
    assert.deepEqual(report.findings[2], {
      checkId: "deprecation.migration-notes",
      category: "deprecation",
      severity: "warning",
      outcome: "na",
      measure: {
        kind: "ratio",
        value: 0,
        detail: "0 deprecated exports found; migration notes are not applicable.",
      },
      evidence: [],
      fix: "Append replacement guidance to every @deprecated mark.",
      receipt: "A bare deprecation mark does not redirect an agent away from deprecated training-data gravity.",
    });
  });

  it("treats adopted carriers without the signal as failures", async () => {
    const report = await audit(join(repoRoot, "fixtures/missing-vs-na/adopted-carrier-without-signal"));

    assert.equal(finding(report, "docs.usage-examples").outcome, "fail");
    assert.equal(finding(report, "docs.example-imports-real").outcome, "fail");
  });

  it("treats no usage-example carrier anywhere as a missing signal, not N/A", async () => {
    const report = await audit(join(repoRoot, "fixtures/missing-vs-na/no-carrier-anywhere"));

    assert.equal(finding(report, "docs.usage-examples").outcome, "fail");
    assert.equal(finding(report, "docs.example-imports-real").outcome, "na");
  });

  it("reports structurally inapplicable deprecation migration notes as N/A", async () => {
    const report = await audit(join(repoRoot, "fixtures/missing-vs-na/structurally-inapplicable"));

    assert.equal(finding(report, "deprecation.migration-notes").outcome, "na");
    assert.equal(report.categories.find((category) => category.id === "deprecation")?.weightRedistributed, true);
  });

  it("applies custom weights from config without mutating default ARS v0 weights", async () => {
    const targetPath = join(repoRoot, "fixtures/scoring/deprecation-without-migration");

    const defaultReport = await audit(targetPath);
    const customReport = await audit(targetPath, { weights: { docs: 10, deprecation: 90 } });

    assert.equal(defaultReport.weights.source, "default");
    assert.equal(defaultReport.weights.values.docs, 25);
    assert.equal(defaultReport.weights.values.deprecation, 15);
    assert.equal(defaultReport.composite, 62.5);

    assert.equal(customReport.weights.source, "custom");
    assert.equal(customReport.weights.values.docs, 10);
    assert.equal(customReport.weights.values.deprecation, 90);
    assert.equal(customReport.composite, 10);
  });
});

describe("sortFindingsForReport", () => {
  it("orders findings critical, then warning, then info regardless of input order", () => {
    const info = stubFinding("info-check", "info");
    const warning = stubFinding("warning-check", "warning");
    const critical = stubFinding("critical-check", "critical");

    const sorted = sortFindingsForReport([info, warning, critical]);

    assert.deepEqual(
      sorted.map((finding) => finding.checkId),
      ["critical-check", "warning-check", "info-check"],
    );
  });
});

function stubFinding(checkId: string, severity: AuditFinding["severity"]): AuditFinding {
  return {
    checkId,
    category: "docs",
    severity,
    outcome: "pass",
    measure: { kind: "ratio", value: 1, detail: "stub" },
    evidence: [],
    fix: "stub",
    receipt: "stub",
  };
}

type Report = Awaited<ReturnType<typeof audit>>;

function finding(report: Report, checkId: string) {
  const match = report.findings.find((candidate) => candidate.checkId === checkId);
  assert.ok(match, `expected ${checkId} finding`);
  return match;
}
