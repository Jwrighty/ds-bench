import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { join } from "node:path";
import { audit, sortFindingsForReport } from "../src/audit/audit.ts";
import { getExportedComponents, getPublicPackage } from "../src/audit/component-inventory.ts";
import { listTextFiles } from "../src/audit/file-system.ts";
import type { AuditFinding } from "../src/audit/types.ts";

const repoRoot = process.cwd();
const fixturePath = join(repoRoot, "fixtures/missing-usage-examples");
const m1FixturePath = (name: string) => join(repoRoot, "fixtures/m1", name);

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
    assert.equal(report.composite, 55.4);
    assert.deepEqual(report.applicability, {
      applicable: 5,
      total: 8,
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
      score: 100,
      applicable: 1,
      total: 1,
      weightRedistributed: false,
    });
    assert.deepEqual(report.categories[4], {
      id: "deprecation",
      score: null,
      applicable: 0,
      total: 2,
      weightRedistributed: true,
    });

    assert.equal(report.findings.length, 8);
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
      checkId: "api.types-resolve",
      category: "api",
      severity: "critical",
      outcome: "pass",
      measure: {
        kind: "ratio",
        value: 1,
        detail: "2/2 exports typecheck from a synthetic package import; unresolved: none",
      },
      evidence: [],
      fix: "Repair the package types/exports mapping so every public export is importable.",
      receipt: "Wrong import paths are a documented agent failure mode.",
    });
    assert.deepEqual(report.findings[3], {
      checkId: "deprecation.marked",
      category: "deprecation",
      severity: "critical",
      outcome: "na",
      measure: {
        kind: "ratio",
        value: 0,
        detail: "0 known-deprecated exports found; deprecation marks are not applicable.",
      },
      evidence: [],
      fix: "Add @deprecated to legacy exports.",
      receipt: "Deprecated patterns dominate training data unless current source clearly marks them as deprecated.",
    });
    assert.deepEqual(report.findings[6], {
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
    assert.notEqual(defaultReport.composite, customReport.composite);

    assert.equal(customReport.weights.source, "custom");
    assert.equal(customReport.weights.values.docs, 10);
    assert.equal(customReport.weights.values.deprecation, 90);
  });

  it("checks api.types-resolve against failure and clean fixtures", async () => {
    const failing = await audit(m1FixturePath("types-do-not-resolve"));
    const clean = await audit(m1FixturePath("types-resolve-clean"));

    assert.deepEqual(finding(failing, "api.types-resolve").measure, {
      kind: "ratio",
      value: 0,
      detail: "package entrypoint for types-do-not-resolve is unresolvable; synthetic package import could not be checked.",
    });
    assert.equal(finding(failing, "api.types-resolve").outcome, "fail");
    assert.deepEqual(finding(failing, "api.types-resolve").evidence, ["types-do-not-resolve"]);
    assert.equal(finding(clean, "api.types-resolve").outcome, "pass");
    assert.equal(finding(clean, "api.types-resolve").measure.value, 1);
  });

  it("derives component inventory from the public package entrypoint in monorepos", async () => {
    const targetPath = join(repoRoot, "fixtures/public-api/monorepo-entrypoint");
    const files = listTextFiles(targetPath);
    const publicPackage = getPublicPackage(files);

    assert.equal(publicPackage?.name, "@example/react");
    assert.equal(publicPackage?.rootRelativePath, "packages/react");
    assert.deepEqual(getExportedComponents(files).components, ["Button", "Card"]);

    const report = await audit(targetPath);
    const affectedChecks = [
      "docs.usage-examples",
      "api.types-resolve",
      "guidance.when-to-use",
      "deprecation.marked",
      "agent.manifest-coverage",
    ];

    for (const checkId of affectedChecks) {
      assert.doesNotMatch(finding(report, checkId).measure.detail, /\b(?:App|Default|GET|RouteWidget)\b/);
      assert.doesNotMatch(finding(report, checkId).evidence.join(", "), /\b(?:App|Default|GET|RouteWidget)\b/);
    }

    assert.equal(finding(report, "api.types-resolve").outcome, "pass");
    assert.equal(finding(report, "docs.usage-examples").measure.detail, "1/2 exported components have importable usage examples; missing: Card");
    assert.equal(finding(report, "agent.manifest-coverage").measure.detail, "1/2 exported components are covered by a manifest; missing: Card");
  });

  it("checks guidance.when-to-use against failure and clean fixtures", async () => {
    const failing = await audit(m1FixturePath("missing-usage-guidance"));
    const clean = await audit(m1FixturePath("usage-guidance-clean"));

    assert.deepEqual(finding(failing, "guidance.when-to-use").measure, {
      kind: "ratio",
      value: 0.5,
      detail: "1/2 exported components include when-to-use guidance; missing: Card",
    });
    assert.equal(finding(failing, "guidance.when-to-use").outcome, "fail");
    assert.deepEqual(finding(failing, "guidance.when-to-use").evidence, ["Card"]);
    assert.equal(finding(clean, "guidance.when-to-use").outcome, "pass");
    assert.equal(finding(clean, "guidance.when-to-use").measure.value, 1);
  });

  it("checks tokens.hardcoded-values against failure and clean fixtures", async () => {
    const failing = await audit(m1FixturePath("hardcoded-token-values"));
    const clean = await audit(m1FixturePath("token-values-clean"));

    assert.equal(finding(failing, "tokens.hardcoded-values").outcome, "fail");
    assert.deepEqual(finding(failing, "tokens.hardcoded-values").measure, {
      kind: "count",
      value: 50,
      detail:
        "3 magic values across 6 style LOC (50 per 100 LOC); token references: 1; offenders: #ff0000 in src/button.css:2, 12px in src/button.css:3, 999 in src/button.css:4",
    });
    assert.deepEqual(finding(failing, "tokens.hardcoded-values").evidence, [
      "#ff0000 in src/button.css:2",
      "12px in src/button.css:3",
      "999 in src/button.css:4",
    ]);
    assert.equal(finding(clean, "tokens.hardcoded-values").outcome, "pass");
    assert.equal(finding(clean, "tokens.hardcoded-values").measure.value, 0);
  });

  it("reports tokens.hardcoded-values as N/A when zero style-LOC is detected", async () => {
    const report = await audit(m1FixturePath("types-resolve-clean"));

    assert.equal(finding(report, "tokens.hardcoded-values").outcome, "na");
    assert.equal(finding(report, "tokens.hardcoded-values").measure.value, 0);
  });

  it("checks deprecation.marked against failure and clean fixtures", async () => {
    const failing = await audit(m1FixturePath("deprecated-without-mark"));
    const clean = await audit(m1FixturePath("deprecated-mark-clean"));

    assert.deepEqual(finding(failing, "deprecation.marked").measure, {
      kind: "ratio",
      value: 0,
      detail: "0/2 known-deprecated exports carry @deprecated; missing: GhostButton, LegacyButton",
    });
    assert.equal(finding(failing, "deprecation.marked").outcome, "fail");
    assert.deepEqual(finding(failing, "deprecation.marked").evidence, ["GhostButton", "LegacyButton"]);
    assert.equal(finding(clean, "deprecation.marked").outcome, "pass");
    assert.equal(finding(clean, "deprecation.marked").measure.value, 1);
  });

  it("reports deprecation.marked as N/A when zero known-deprecated exports are detected", async () => {
    const report = await audit(m1FixturePath("types-resolve-clean"));

    assert.equal(finding(report, "deprecation.marked").outcome, "na");
    assert.deepEqual(finding(report, "deprecation.marked").measure, {
      kind: "ratio",
      value: 0,
      detail: "0 known-deprecated exports found; deprecation marks are not applicable.",
    });
    assert.deepEqual(finding(report, "deprecation.marked").evidence, []);
  });

  it("checks agent.manifest-coverage against failure and clean fixtures", async () => {
    const failing = await audit(m1FixturePath("storybook-without-manifest"));
    const clean = await audit(m1FixturePath("manifest-coverage-clean"));

    assert.deepEqual(finding(failing, "agent.manifest-coverage").measure, {
      kind: "ratio",
      value: 0,
      detail: "0/2 exported components are covered by a manifest; missing: Button, Card",
    });
    assert.equal(finding(failing, "agent.manifest-coverage").outcome, "fail");
    assert.deepEqual(finding(failing, "agent.manifest-coverage").evidence, ["Button", "Card"]);
    assert.equal(finding(clean, "agent.manifest-coverage").outcome, "pass");
    assert.equal(finding(clean, "agent.manifest-coverage").measure.value, 1);
  });

  it("produces six real scored categories on the combined M1 fixture", async () => {
    const report = await audit(m1FixturePath("combined-six-pack"));

    assert.equal(report.applicability.applicable, 8);
    assert.equal(report.applicability.total, 8);
    assert.equal(report.applicability.confidence, "high");
    assert.ok(report.composite > 0);
    assert.equal(finding(report, "deprecation.marked").outcome, "pass");
    assert.equal(finding(report, "deprecation.marked").measure.detail, "1/1 known-deprecated exports carry @deprecated; missing: none");
    assert.equal(report.categories.length, 6);
    for (const category of report.categories) {
      assert.notEqual(category.score, null, `${category.id} should produce a real score`);
      assert.equal(category.applicable > 0, true, `${category.id} should have an applicable check`);
    }

    assert.deepEqual(
      report.findings.map((candidate) => candidate.severity),
      ["critical", "critical", "critical", "critical", "warning", "warning", "warning", "warning"],
    );
    for (const candidate of report.findings) {
      assert.ok(candidate.fix.length > 0, `${candidate.checkId} should carry a fix`);
      assert.ok(candidate.receipt.length > 0, `${candidate.checkId} should carry a receipt`);
    }
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
