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
    assert.equal(report.composite, 46.4);
    assert.deepEqual(report.applicability, {
      applicable: 10,
      total: 13,
      confidence: "medium",
    });
    assert.equal(report.categories.length, 6);
    assert.deepEqual(report.categories[0], {
      id: "docs",
      score: 50,
      applicable: 4,
      total: 4,
      weightRedistributed: false,
    });
    assert.deepEqual(report.categories[1], {
      id: "api",
      score: 100,
      applicable: 4,
      total: 4,
      weightRedistributed: false,
    });
    assert.deepEqual(report.categories[4], {
      id: "deprecation",
      score: null,
      applicable: 0,
      total: 2,
      weightRedistributed: true,
    });

    assert.equal(report.findings.length, 13);
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
    assert.deepEqual(report.findings[10], {
      checkId: "deprecation.migration-notes",
      category: "deprecation",
      severity: "warning",
      outcome: "na",
      measure: {
        kind: "ratio",
        value: 0,
        detail: "0 @deprecated-marked exports found; migration notes are not applicable.",
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

  it("checks api.prop-type-soundness against failure and clean fixtures", async () => {
    const failing = await audit(m1FixturePath("unsound-prop-types"));
    const clean = await audit(m1FixturePath("prop-types-sound"));

    assert.deepEqual(finding(failing, "api.prop-type-soundness").measure, {
      kind: "ratio",
      value: 0.5,
      detail: "3/6 exported component props use any/unknown; offenders: Button.data (any), Button.metadata (unknown), Dialog.payload (unknown)",
    });
    assert.equal(finding(failing, "api.prop-type-soundness").outcome, "fail");
    assert.deepEqual(finding(failing, "api.prop-type-soundness").evidence, [
      "Button.data (any)",
      "Button.metadata (unknown)",
      "Dialog.payload (unknown)",
    ]);
    assert.equal(finding(clean, "api.prop-type-soundness").outcome, "pass");
    assert.deepEqual(finding(clean, "api.prop-type-soundness").measure, {
      kind: "ratio",
      value: 0,
      detail: "0/2 exported component props use any/unknown; offenders: none",
    });
  });

  it("reports api.prop-type-soundness as N/A when no TypeScript types ship", async () => {
    const report = await audit(m1FixturePath("typeless-api"));

    assert.equal(finding(report, "api.types-resolve").outcome, "fail");
    assert.equal(finding(report, "api.prop-type-soundness").outcome, "na");
    assert.deepEqual(finding(report, "api.prop-type-soundness").measure, {
      kind: "ratio",
      value: 0,
      detail: "No TypeScript types found; api.types-resolve carries the importability failure.",
    });
  });

  it("checks api.name-coherence against failure and clean fixtures", async () => {
    const failing = await audit(m1FixturePath("name-coherence-mismatch"));
    const clean = await audit(m1FixturePath("name-coherence-clean"));

    assert.deepEqual(finding(failing, "api.name-coherence").measure, {
      kind: "count",
      value: 3,
      detail:
        "3 component name carrier mismatches: Button source file src/Primary.ts, Button story file src/Badge.stories.tsx, Card manifest file src/Tile.ts",
    });
    assert.equal(finding(failing, "api.name-coherence").outcome, "fail");
    assert.deepEqual(finding(failing, "api.name-coherence").evidence, [
      "Button source file src/Primary.ts",
      "Button story file src/Badge.stories.tsx",
      "Card manifest file src/Tile.ts",
    ]);
    assert.equal(finding(clean, "api.name-coherence").outcome, "pass");
    assert.equal(finding(clean, "api.name-coherence").measure.value, 0);
  });

  it("checks api.barrel-completeness against failure and clean fixtures", async () => {
    const failing = await audit(m1FixturePath("incomplete-barrel"));
    const clean = await audit(m1FixturePath("barrel-complete"));

    assert.deepEqual(finding(failing, "api.barrel-completeness").measure, {
      kind: "count",
      value: 1,
      detail: "1 component is deep-import-only and missing from the root barrel: Card",
    });
    assert.equal(finding(failing, "api.barrel-completeness").outcome, "fail");
    assert.deepEqual(finding(failing, "api.barrel-completeness").evidence, ["Card"]);
    assert.equal(finding(clean, "api.barrel-completeness").outcome, "pass");
    assert.deepEqual(finding(clean, "api.barrel-completeness").measure, {
      kind: "count",
      value: 0,
      detail: "0 components are deep-import-only and missing from the root barrel: none",
    });
  });

  it("aggregates all four API clarity checks into the API category score", async () => {
    const report = await audit(m1FixturePath("api-category-aggregate"));
    const apiCategory = report.categories.find((category) => category.id === "api");

    assert.equal(finding(report, "api.types-resolve").outcome, "pass");
    assert.equal(finding(report, "api.prop-type-soundness").measure.value, 1);
    assert.equal(finding(report, "api.name-coherence").measure.value, 1);
    assert.equal(finding(report, "api.barrel-completeness").measure.value, 1);
    assert.deepEqual(apiCategory, {
      id: "api",
      score: 37.5,
      applicable: 4,
      total: 4,
      weightRedistributed: false,
    });
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

  it("counts member-expression JSX as importable component usage", async () => {
    const report = await audit(m1FixturePath("compound-jsx-usage"));

    assert.equal(finding(report, "docs.usage-examples").outcome, "pass");
    assert.equal(
      finding(report, "docs.usage-examples").measure.detail,
      "1/1 exported components have importable usage examples; missing: none",
    );
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

  it("checks docs.prop-descriptions against failure and clean fixtures", async () => {
    const failing = await audit(m1FixturePath("missing-prop-descriptions"));
    const clean = await audit(m1FixturePath("prop-descriptions-clean"));

    assert.deepEqual(finding(failing, "docs.prop-descriptions").measure, {
      kind: "ratio",
      value: 0.5,
      detail: "1/2 exported components have documented public props; missing: Card",
    });
    assert.equal(finding(failing, "docs.prop-descriptions").outcome, "fail");
    assert.deepEqual(finding(failing, "docs.prop-descriptions").evidence, ["Card: title"]);
    assert.equal(finding(clean, "docs.prop-descriptions").outcome, "pass");
    assert.equal(finding(clean, "docs.prop-descriptions").measure.value, 1);
  });

  it("checks docs.example-imports-real against failure and clean fixtures", async () => {
    const failing = await audit(m1FixturePath("dead-example-import"));
    const clean = await audit(m1FixturePath("example-imports-clean"));

    assert.deepEqual(finding(failing, "docs.example-imports-real").measure, {
      kind: "ratio",
      value: 0.5,
      detail: "1/2 example component imports resolve against exported components; unresolved: GhostButton",
    });
    assert.equal(finding(failing, "docs.example-imports-real").outcome, "fail");
    assert.deepEqual(finding(failing, "docs.example-imports-real").evidence, ["GhostButton"]);
    assert.equal(finding(clean, "docs.example-imports-real").outcome, "pass");
    assert.equal(finding(clean, "docs.example-imports-real").measure.value, 1);
  });

  it("reports docs.example-imports-real as N/A when zero examples exist", async () => {
    const report = await audit(join(repoRoot, "fixtures/missing-vs-na/no-carrier-anywhere"));

    assert.equal(finding(report, "docs.example-imports-real").outcome, "na");
    assert.deepEqual(finding(report, "docs.example-imports-real").measure, {
      kind: "ratio",
      value: 0,
      detail: "No examples exist; docs.usage-examples carries the absence.",
    });
  });

  it("checks docs.undocumented-exports against failure and clean fixtures", async () => {
    const failing = await audit(m1FixturePath("undocumented-exports"));
    const clean = await audit(m1FixturePath("documented-exports-clean"));

    assert.deepEqual(finding(failing, "docs.undocumented-exports").measure, {
      kind: "count",
      value: 1,
      detail: "1 exported symbol has no docs presence anywhere: Card",
    });
    assert.equal(finding(failing, "docs.undocumented-exports").outcome, "fail");
    assert.deepEqual(finding(failing, "docs.undocumented-exports").evidence, ["Card"]);
    assert.equal(finding(clean, "docs.undocumented-exports").outcome, "pass");
    assert.deepEqual(finding(clean, "docs.undocumented-exports").measure, {
      kind: "count",
      value: 0,
      detail: "0 exported symbols have no docs presence anywhere: none",
    });
  });

  it("aggregates all four Docs & examples checks into the docs category score", async () => {
    const report = await audit(m1FixturePath("docs-category-aggregate"));
    const docsCategory = report.categories.find((category) => category.id === "docs");

    assert.equal(finding(report, "docs.prop-descriptions").measure.value, 0.5);
    assert.equal(finding(report, "docs.usage-examples").measure.value, 0.5);
    assert.equal(finding(report, "docs.example-imports-real").measure.value, 0.5);
    assert.equal(finding(report, "docs.undocumented-exports").measure.value, 1);
    assert.deepEqual(docsCategory, {
      id: "docs",
      score: 50,
      applicable: 4,
      total: 4,
      weightRedistributed: false,
    });
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

  it("scopes token hygiene to library package files while keeping repo-wide carriers", async () => {
    const report = await audit(join(repoRoot, "fixtures/token-scope/library-vs-app"));
    const tokenFinding = finding(report, "tokens.hardcoded-values");

    assert.equal(finding(report, "docs.usage-examples").outcome, "pass");
    assert.equal(finding(report, "agent.manifest-coverage").outcome, "pass");
    assert.equal(tokenFinding.outcome, "fail");
    assert.match(tokenFinding.measure.detail, /packages\/react\/src\/Button\.css/);
    assert.doesNotMatch(tokenFinding.measure.detail, /apps\/demo/);
    assert.deepEqual(tokenFinding.evidence, ["#123456 in packages/react/src/Button.css:2"]);
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

  it("uses precise markdown deprecation statements instead of proximity matches", async () => {
    const report = await audit(join(repoRoot, "fixtures/deprecation/heuristic-precision"));

    assert.equal(finding(report, "deprecation.marked").outcome, "fail");
    assert.equal(
      finding(report, "deprecation.marked").measure.detail,
      "0/1 known-deprecated exports carry @deprecated; missing: Modal",
    );
    assert.deepEqual(finding(report, "deprecation.marked").evidence, ["Modal"]);
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

    assert.equal(report.applicability.applicable, 13);
    assert.equal(report.applicability.total, 13);
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
      [
        "critical",
        "critical",
        "critical",
        "critical",
        "warning",
        "warning",
        "warning",
        "warning",
        "warning",
        "warning",
        "warning",
        "warning",
        "info",
      ],
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
