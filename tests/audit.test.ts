import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { audit, sortFindingsForReport } from "../src/audit/audit.ts";
import { getExportedComponents, getPublicPackage } from "../src/audit/component-inventory.ts";
import { listTextFiles } from "../src/audit/file-system.ts";
import type { AuditFinding } from "../src/audit/types.ts";

const repoRoot = process.cwd();
const fixturePath = join(repoRoot, "fixtures/missing-usage-examples");
const m1FixturePath = (name: string) => join(repoRoot, "fixtures/m1", name);
const agentMetadataFixturePath = (name: string) => join(repoRoot, "fixtures/agent-metadata", name);

describe("audit seam", () => {
  it("returns the ARS v0.3 report contract for a missing usage examples fixture", async () => {
    const report = await audit(fixturePath);

    assert.equal(report.rubricVersion, "ARS v0.3");
    const packageVersion = (JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8")) as { version: string }).version;
    assert.equal(report.toolVersion, packageVersion);
    assert.equal(report.scoredCheckCount, 22);
    assert.equal(report.registryFingerprint, "176a3461");
    assert.equal(report.target.name, "missing-usage-examples");
    // Reports are versioned artifacts — the target must never leak an absolute machine path.
    assert.ok(!report.target.path.startsWith("/"), `target.path leaks absolute path: ${report.target.path}`);
    assert.match(report.target.path, /fixtures\/missing-usage-examples$/);
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
    assert.equal(report.composite, 40.7);
    assert.deepEqual(report.applicability, {
      applicable: 14,
      total: 17,
      confidence: "medium",
    });
    assert.equal(report.categories.length, 6);
    assert.deepEqual(report.categories[0], {
      id: "docs",
      score: 58.3,
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
      total: 3,
      weightRedistributed: true,
    });

    assert.equal(report.findings.length, 23);
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
      naReason: "clean",
      measure: {
        kind: "ratio",
        value: 0,
        detail: "0 known-deprecated exports found; deprecation marks are not applicable.",
      },
      evidence: [],
      fix: "Add @deprecated to legacy exports.",
      receipt: "Deprecated patterns dominate training data unless current source clearly marks them as deprecated.",
    });
    assert.deepEqual(finding(report, "deprecation.migration-notes"), {
      checkId: "deprecation.migration-notes",
      category: "deprecation",
      severity: "warning",
      outcome: "na",
      naReason: "clean",
      measure: {
        kind: "ratio",
        value: 0,
        detail: "0 @deprecated marks found; migration notes are not applicable (deprecation.marked carries unmarked deprecations).",
      },
      evidence: [],
      fix: "Append replacement guidance to every @deprecated mark.",
      receipt: "A bare deprecation mark does not redirect an agent away from deprecated training-data gravity.",
    });
    assert.equal(finding(report, "tokens.naming-consistency").naReason, "uncovered");
    assert.equal(finding(report, "guidance.confusable-pairs").naReason, "clean");
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
    assert.equal(finding(report, "docs.example-imports-real").naReason, "uncovered");
  });

  it("reports structurally inapplicable deprecation migration notes as N/A", async () => {
    const report = await audit(join(repoRoot, "fixtures/missing-vs-na/structurally-inapplicable"));

    assert.equal(finding(report, "deprecation.migration-notes").outcome, "na");
    assert.equal(finding(report, "deprecation.migration-notes").naReason, "clean");
    assert.equal(report.categories.find((category) => category.id === "deprecation")?.weightRedistributed, true);
  });

  it("applies custom weights from config without mutating default ARS v0.3 weights", async () => {
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

  it("reports api.types-resolve as N/A for an unbuilt source checkout whose entrypoints point at missing dist output", async () => {
    const report = await audit(m1FixturePath("types-unbuilt-checkout"));

    assert.equal(finding(report, "api.types-resolve").outcome, "na");
    assert.deepEqual(finding(report, "api.types-resolve").measure, {
      kind: "ratio",
      value: 0,
      detail:
        "entrypoints point at build output absent from this checkout (unbuilt source clone); types resolution not assessed: dist/index.d.ts, dist/index.js",
    });
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

  it("does not flag compound components grouped in the parent's file, but still flags real aliases", async () => {
    const report = await audit(m1FixturePath("name-coherence-compound"));
    const nameCoherence = finding(report, "api.name-coherence");

    assert.equal(nameCoherence.outcome, "fail");
    assert.deepEqual(nameCoherence.measure, {
      kind: "count",
      value: 3,
      detail:
        "3 component name carrier mismatches: MetricCard source file src/Stat.tsx, Radio source file src/RadioGroup.tsx, StatusPill source file src/Badge.tsx",
    });
    assert.deepEqual(nameCoherence.evidence, [
      "MetricCard source file src/Stat.tsx",
      "Radio source file src/RadioGroup.tsx",
      "StatusPill source file src/Badge.tsx",
    ]);
    // Compound parts sharing the parent's file + name prefix are healthy, not mismatches.
    assert.doesNotMatch(nameCoherence.measure.detail, /CardHeader|CardBody|CardFooter|TableRow|TableCell|TableHeaderCell/);
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
      score: 50,
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

  it("checks guidance.alternatives-resolve against failure and clean fixtures", async () => {
    const failing = await audit(m1FixturePath("alternatives-do-not-resolve"));
    const clean = await audit(m1FixturePath("alternatives-resolve-clean"));

    assert.deepEqual(finding(failing, "guidance.alternatives-resolve").measure, {
      kind: "ratio",
      value: 0,
      detail: "0/1 alternatives/instead component references resolve to exported components; unresolved: GhostButton",
    });
    assert.equal(finding(failing, "guidance.alternatives-resolve").outcome, "fail");
    assert.deepEqual(finding(failing, "guidance.alternatives-resolve").evidence, ["GhostButton"]);
    assert.equal(finding(clean, "guidance.alternatives-resolve").outcome, "pass");
    assert.deepEqual(finding(clean, "guidance.alternatives-resolve").measure, {
      kind: "ratio",
      value: 1,
      detail: "2/2 alternatives/instead component references resolve to exported components; unresolved: none",
    });
  });

  it("ignores unmarked capitalized prose in alternatives guidance", async () => {
    const report = await audit(m1FixturePath("alternatives-prose-overmatch"));

    assert.equal(finding(report, "guidance.alternatives-resolve").outcome, "na");
    assert.deepEqual(finding(report, "guidance.alternatives-resolve").measure, {
      kind: "ratio",
      value: 0,
      detail: "No alternatives/instead component references found; alternatives resolution is not applicable.",
    });
  });

  it("ignores changelog migration prose in alternatives guidance", async () => {
    const report = await audit(m1FixturePath("alternatives-changelog-only"));

    assert.equal(finding(report, "guidance.alternatives-resolve").outcome, "na");
    assert.deepEqual(finding(report, "guidance.alternatives-resolve").measure, {
      kind: "ratio",
      value: 0,
      detail: "No alternatives/instead guidance content found; alternatives resolution is not applicable.",
    });
  });

  it("ignores placeholder names but still fails real unresolved alternatives guidance", async () => {
    const report = await audit(m1FixturePath("alternatives-placeholders-filtered"));

    assert.equal(finding(report, "guidance.alternatives-resolve").outcome, "fail");
    assert.deepEqual(finding(report, "guidance.alternatives-resolve").measure, {
      kind: "ratio",
      value: 0,
      detail: "0/1 alternatives/instead component references resolve to exported components; unresolved: GhostButton",
    });
    assert.deepEqual(finding(report, "guidance.alternatives-resolve").evidence, ["GhostButton"]);
  });

  it("counts structured alternatives fields and fails unresolved structured references", async () => {
    const clean = await audit(m1FixturePath("structured-alternatives-resolve-clean"));
    const failing = await audit(m1FixturePath("structured-alternatives-do-not-resolve"));

    assert.equal(finding(clean, "guidance.alternatives-resolve").outcome, "pass");
    assert.deepEqual(finding(clean, "guidance.alternatives-resolve").measure, {
      kind: "ratio",
      value: 1,
      detail: "2/2 alternatives/instead component references resolve to exported components; unresolved: none",
    });
    assert.equal(finding(failing, "guidance.alternatives-resolve").outcome, "fail");
    assert.deepEqual(finding(failing, "guidance.alternatives-resolve").measure, {
      kind: "ratio",
      value: 0,
      detail: "0/1 alternatives/instead component references resolve to exported components; unresolved: GhostButton",
    });
    assert.deepEqual(finding(failing, "guidance.alternatives-resolve").evidence, ["GhostButton"]);
  });

  it("reports guidance.alternatives-resolve as N/A when no alternatives content exists", async () => {
    const report = await audit(m1FixturePath("usage-guidance-clean"));

    assert.equal(finding(report, "guidance.alternatives-resolve").outcome, "na");
    assert.deepEqual(finding(report, "guidance.alternatives-resolve").measure, {
      kind: "ratio",
      value: 0,
      detail: "No alternatives/instead guidance content found; alternatives resolution is not applicable.",
    });
  });

  it("checks guidance.confusable-pairs against failure and clean fixtures", async () => {
    const failing = await audit(m1FixturePath("confusable-pairs-missing"));
    const clean = await audit(m1FixturePath("confusable-pairs-clean"));

    assert.deepEqual(finding(failing, "guidance.confusable-pairs").measure, {
      kind: "ratio",
      value: 0,
      detail: "0/1 detected confusable pairs reference each other; missing: Dialog/Popover",
    });
    assert.equal(finding(failing, "guidance.confusable-pairs").outcome, "fail");
    assert.deepEqual(finding(failing, "guidance.confusable-pairs").evidence, ["Dialog/Popover"]);
    assert.equal(finding(clean, "guidance.confusable-pairs").outcome, "pass");
    assert.deepEqual(finding(clean, "guidance.confusable-pairs").measure, {
      kind: "ratio",
      value: 1,
      detail: "1/1 detected confusable pairs reference each other; missing: none",
    });
  });

  it("checks guidance.confusable-pairs from .meta.ts structured guidance", async () => {
    const clean = await audit(m1FixturePath("confusable-pairs-meta-clean"));
    const missingDirection = await audit(m1FixturePath("confusable-pairs-meta-missing-direction"));

    assert.equal(finding(clean, "guidance.confusable-pairs").outcome, "pass");
    assert.deepEqual(finding(clean, "guidance.confusable-pairs").measure, {
      kind: "ratio",
      value: 1,
      detail: "1/1 detected confusable pairs reference each other; missing: none",
    });
    assert.equal(finding(missingDirection, "guidance.confusable-pairs").outcome, "fail");
    assert.deepEqual(finding(missingDirection, "guidance.confusable-pairs").measure, {
      kind: "ratio",
      value: 0,
      detail: "0/1 detected confusable pairs reference each other; missing: Checkbox/Switch",
    });
    assert.deepEqual(finding(missingDirection, "guidance.confusable-pairs").evidence, ["Checkbox/Switch"]);
  });

  it("checks guidance.confusable-pairs from per-component manifest JSON entries", async () => {
    const report = await audit(m1FixturePath("confusable-pairs-manifest-clean"));

    assert.equal(finding(report, "guidance.confusable-pairs").outcome, "pass");
    assert.deepEqual(finding(report, "guidance.confusable-pairs").measure, {
      kind: "ratio",
      value: 1,
      detail: "1/1 detected confusable pairs reference each other; missing: none",
    });
  });

  it("reports guidance.confusable-pairs as N/A when fewer than two seed pair members are present", async () => {
    const report = await audit(m1FixturePath("usage-guidance-clean"));

    assert.equal(finding(report, "guidance.confusable-pairs").outcome, "na");
    assert.deepEqual(finding(report, "guidance.confusable-pairs").measure, {
      kind: "ratio",
      value: 0,
      detail: "Fewer than 2 seed confusable-pair members are in inventory; disambiguation is not applicable.",
    });
  });

  it("reports guidance.confusable-pairs as N/A when seed members exist without a complete configured pair", async () => {
    const report = await audit(m1FixturePath("confusable-pairs-unpaired-members"));

    assert.equal(finding(report, "guidance.confusable-pairs").outcome, "na");
    assert.deepEqual(finding(report, "guidance.confusable-pairs").measure, {
      kind: "ratio",
      value: 0,
      detail: "No complete seed pair among Button, Dialog; disambiguation is not applicable.",
    });
    assert.deepEqual(finding(report, "guidance.confusable-pairs").evidence, []);
  });

  it("aggregates all three Usage guidance checks into the guidance category score", async () => {
    const report = await audit(m1FixturePath("guidance-category-aggregate"));
    const guidanceCategory = report.categories.find((category) => category.id === "guidance");

    assert.equal(finding(report, "guidance.when-to-use").measure.value, 0.5);
    assert.equal(finding(report, "guidance.alternatives-resolve").measure.value, 1);
    assert.equal(finding(report, "guidance.confusable-pairs").measure.value, 1);
    assert.deepEqual(guidanceCategory, {
      id: "guidance",
      score: 83.3,
      applicable: 3,
      total: 3,
      weightRedistributed: false,
    });
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
      detail: "1 exported symbol has no documentation evidence: Card",
    });
    assert.equal(finding(failing, "docs.undocumented-exports").outcome, "fail");
    assert.deepEqual(finding(failing, "docs.undocumented-exports").evidence, ["Card"]);
    assert.equal(finding(clean, "docs.undocumented-exports").outcome, "pass");
    assert.deepEqual(finding(clean, "docs.undocumented-exports").measure, {
      kind: "count",
      value: 0,
      detail: "0 exported symbols have no documentation evidence: none",
    });
  });

  it("does not credit an export named only in an audit-log prose mention", async () => {
    const report = await audit(m1FixturePath("doc-evidence-audit-log"));
    const undocumented = finding(report, "docs.undocumented-exports");

    assert.equal(undocumented.outcome, "fail");
    assert.equal(undocumented.measure.value, 1);
    assert.deepEqual(undocumented.evidence, ["Widget"]);
  });

  it("credits meaningful source documentation, examples, sections, tables, and described manifests", async () => {
    for (const fixture of [
      "doc-evidence-markdown-section",
      "doc-evidence-api-table",
      "doc-evidence-example-import",
      "doc-evidence-manifest-described",
    ]) {
      const undocumented = finding(await audit(m1FixturePath(fixture)), "docs.undocumented-exports");
      assert.equal(undocumented.outcome, "pass", `${fixture} should be documented`);
      assert.equal(undocumented.measure.value, 0, `${fixture} should have zero undocumented exports`);
    }
  });

  it("does not credit a name-only manifest inventory entry", async () => {
    const undocumented = finding(await audit(m1FixturePath("doc-evidence-manifest-name-only")), "docs.undocumented-exports");

    assert.equal(undocumented.outcome, "fail");
    assert.equal(undocumented.measure.value, 1);
    assert.deepEqual(undocumented.evidence, ["Widget"]);
  });

  it("does not credit exports named only in task-brief, changelog, or ADR prose", async () => {
    const undocumented = finding(await audit(m1FixturePath("doc-evidence-incidental-prose")), "docs.undocumented-exports");

    assert.equal(undocumented.outcome, "fail");
    assert.equal(undocumented.measure.value, 3);
    assert.deepEqual(undocumented.evidence, ["AdrWidget", "ChangeWidget", "TaskWidget"]);
  });

  it("fails the audit-log false pass while citing the section that genuinely documents an export", async () => {
    const report = await audit(m1FixturePath("docs-presence-file-citation"));
    const undocumented = finding(report, "docs.undocumented-exports");
    const zombie = finding(report, "deprecation.zombie-exports");

    // RecipeConfig is named only in an audit-log prose gap note — no longer credited (the Issue 30 false pass, now closed).
    assert.equal(undocumented.outcome, "fail");
    assert.equal(undocumented.measure.value, 1);
    assert.deepEqual(undocumented.evidence, ["RecipeConfig"]);
    // MetricCard has a dedicated `# MetricCard` section, so it passes and is cited; Button passes via its own JSDoc.
    assert.match(undocumented.measure.detail, /MetricCard via docs\/MetricCard\.md/);
    assert.doesNotMatch(undocumented.measure.detail, /RecipeConfig via/);
    assert.doesNotMatch(undocumented.measure.detail, /Button via/);

    // Button's overview.md line is prose, not a section/table, so it joins RecipeConfig as a zombie; MetricCard's section carries it.
    assert.equal(zombie.outcome, "fail");
    assert.deepEqual(zombie.evidence, ["Button", "RecipeConfig"]);
    assert.match(zombie.measure.detail, /MetricCard via docs\/MetricCard\.md/);
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
    // Auxiliary surfaces are not the styling habits agents imitate: test/story
    // files, Storybook config, and changelog markdown must never contribute
    // offenders (a changelog PR ref like #4424 must not read as a hex color).
    const failingDetail = finding(failing, "tokens.hardcoded-values").measure.detail;
    assert.doesNotMatch(failingDetail, /\.test\.|\.stories\.|\.storybook|CHANGELOG/);
    assert.doesNotMatch(failingDetail, /#4424|#2392/);
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

  it("scopes token sources to library package files", async () => {
    const report = await audit(join(repoRoot, "fixtures/token-scope/token-sources-app-css"));
    const machineReadableFinding = finding(report, "tokens.machine-readable");
    const namingFinding = finding(report, "tokens.naming-consistency");

    assert.equal(machineReadableFinding.outcome, "pass");
    assert.deepEqual(machineReadableFinding.measure, {
      kind: "ratio",
      value: 1,
      detail: "1/1 token sources are present and parseable; invalid: none",
    });
    assert.equal(namingFinding.outcome, "pass");
    assert.doesNotMatch(namingFinding.measure.detail, /observe|sidebar/);
  });

  it("excludes app token sources when the library package is the repo root", async () => {
    const report = await audit(join(repoRoot, "fixtures/token-scope/token-sources-root-package"));
    const machineReadableFinding = finding(report, "tokens.machine-readable");
    const namingFinding = finding(report, "tokens.naming-consistency");

    assert.equal(machineReadableFinding.outcome, "pass");
    assert.deepEqual(machineReadableFinding.measure, {
      kind: "ratio",
      value: 1,
      detail: "1/1 token sources are present and parseable; invalid: none",
    });
    assert.equal(namingFinding.outcome, "pass");
    assert.doesNotMatch(namingFinding.measure.detail, /observe|sidebar/);
  });

  it("ignores token package build scripts when data token sources exist", async () => {
    const report = await audit(join(repoRoot, "fixtures/token-scope/token-sources-build-script-noise"));
    const machineReadableFinding = finding(report, "tokens.machine-readable");
    const namingFinding = finding(report, "tokens.naming-consistency");

    assert.equal(machineReadableFinding.outcome, "pass");
    assert.deepEqual(machineReadableFinding.measure, {
      kind: "ratio",
      value: 1,
      detail: "1/1 token sources are present and parseable; invalid: none",
    });
    assert.equal(namingFinding.outcome, "pass");
    assert.doesNotMatch(namingFinding.measure.detail, /truth|transforms|format|outputReferences/);
    assert.deepEqual(namingFinding.evidence, []);
  });

  it("accepts numeric-scale token segments like 2xl while still flagging camelCase leaves", async () => {
    const report = await audit(join(repoRoot, "fixtures/token-scope/token-naming-numeric-scale"));
    const namingFinding = finding(report, "tokens.naming-consistency");

    assert.equal(namingFinding.outcome, "fail");
    assert.deepEqual(namingFinding.measure, {
      kind: "ratio",
      value: 0.167,
      detail:
        "2/12 token names violate the dominant dot-kebab pattern; offenders: base.font.size.2Xl, base.font.lineHeight.tight",
    });
    assert.deepEqual(namingFinding.evidence, ["base.font.size.2Xl", "base.font.lineHeight.tight"]);
    // 2xl / 3xl is a standard scale-naming convention (Tailwind, Radix, ...), not a violation.
    assert.doesNotMatch(namingFinding.measure.detail, /size\.2xl|size\.3xl/);
  });

  it("reports tokens.hardcoded-values as N/A when zero style-LOC is detected", async () => {
    const report = await audit(m1FixturePath("types-resolve-clean"));

    assert.equal(finding(report, "tokens.hardcoded-values").outcome, "na");
    assert.equal(finding(report, "tokens.hardcoded-values").measure.value, 0);
  });

  it("checks tokens.machine-readable against failure and clean fixtures", async () => {
    const failing = await audit(join(repoRoot, "fixtures/scoring/tokens-unreadable"));
    const clean = await audit(join(repoRoot, "fixtures/scoring/tokens-machine-readable-clean"));

    assert.deepEqual(finding(failing, "tokens.machine-readable").measure, {
      kind: "ratio",
      value: 0,
      detail: "0/1 token sources are present and parseable; invalid: tokens.json (DTCG token color.brand is missing $type)",
    });
    assert.equal(finding(failing, "tokens.machine-readable").outcome, "fail");
    assert.deepEqual(finding(failing, "tokens.machine-readable").evidence, [
      "tokens.json (DTCG token color.brand is missing $type)",
    ]);
    assert.equal(finding(clean, "tokens.machine-readable").outcome, "pass");
    assert.deepEqual(finding(clean, "tokens.machine-readable").measure, {
      kind: "ratio",
      value: 1,
      detail: "1/1 token sources are present and parseable; invalid: none",
    });
  });

  it("checks tokens.naming-consistency against failure and clean fixtures", async () => {
    const failing = await audit(join(repoRoot, "fixtures/scoring/tokens-naming-inconsistent"));
    const clean = await audit(join(repoRoot, "fixtures/scoring/tokens-naming-clean"));

    assert.deepEqual(finding(failing, "tokens.naming-consistency").measure, {
      kind: "ratio",
      value: 0.25,
      detail: "1/4 token names violate the dominant kebab pattern; offenders: colorAccent",
    });
    assert.equal(finding(failing, "tokens.naming-consistency").outcome, "fail");
    assert.deepEqual(finding(failing, "tokens.naming-consistency").evidence, ["colorAccent"]);
    assert.equal(finding(clean, "tokens.naming-consistency").outcome, "pass");
    assert.equal(finding(clean, "tokens.naming-consistency").measure.value, 0);
  });

  it("classifies compound dot paths with kebab and numeric segments as one convention", async () => {
    const report = await audit(join(repoRoot, "fixtures/scoring/tokens-naming-compound"));

    assert.equal(finding(report, "tokens.naming-consistency").outcome, "pass");
    assert.deepEqual(finding(report, "tokens.naming-consistency").measure, {
      kind: "ratio",
      value: 0,
      detail: "0/3 token names violate the dominant dot-kebab pattern; offenders: none",
    });
  });

  it("fails genuinely mixed token naming conventions", async () => {
    const report = await audit(join(repoRoot, "fixtures/scoring/tokens-naming-mixed"));

    assert.equal(finding(report, "tokens.naming-consistency").outcome, "fail");
    assert.deepEqual(finding(report, "tokens.naming-consistency").measure, {
      kind: "ratio",
      value: 0.333,
      detail: "1/3 token names violate the dominant dot-kebab pattern; offenders: colorAccent",
    });
    assert.deepEqual(finding(report, "tokens.naming-consistency").evidence, ["colorAccent"]);
  });

  it("compares token naming conventions within each carrier", async () => {
    const report = await audit(join(repoRoot, "fixtures/scoring/tokens-naming-cross-carrier"));
    const machineReadableFinding = finding(report, "tokens.machine-readable");
    const namingFinding = finding(report, "tokens.naming-consistency");

    assert.equal(machineReadableFinding.outcome, "pass");
    assert.deepEqual(machineReadableFinding.measure, {
      kind: "ratio",
      value: 1,
      detail: "2/2 token sources are present and parseable; invalid: none",
    });
    assert.equal(namingFinding.outcome, "pass");
    assert.equal(namingFinding.measure.value, 0);
    assert.match(namingFinding.measure.detail, /carrier-local dominant patterns/);
    assert.deepEqual(namingFinding.evidence, []);
  });

  it("still harvests token names from TS object token packages without data sources", async () => {
    const report = await audit(join(repoRoot, "fixtures/scoring/tokens-naming-ts-object"));
    const machineReadableFinding = finding(report, "tokens.machine-readable");
    const namingFinding = finding(report, "tokens.naming-consistency");

    assert.equal(machineReadableFinding.outcome, "pass");
    assert.deepEqual(machineReadableFinding.measure, {
      kind: "ratio",
      value: 1,
      detail: "1/1 token sources are present and parseable; invalid: none",
    });
    assert.equal(namingFinding.outcome, "pass");
    assert.deepEqual(namingFinding.measure, {
      kind: "ratio",
      value: 0,
      detail: "0/2 token names violate the dominant dot-kebab pattern; offenders: none",
    });
  });

  it("reports unmodeled token naming conventions as a classifier-gap N/A", async () => {
    const report = await audit(join(repoRoot, "fixtures/scoring/tokens-naming-unmodeled"));

    assert.equal(finding(report, "tokens.naming-consistency").outcome, "na");
    assert.deepEqual(finding(report, "tokens.naming-consistency").measure, {
      kind: "ratio",
      value: 0,
      detail: "Token names use an unmodeled naming convention; naming consistency is not applicable until the classifier is taught that convention.",
    });
  });

  it("reports all DTCG validation errors found in a token file", async () => {
    const report = await audit(join(repoRoot, "fixtures/scoring/tokens-multiple-invalid"));

    assert.equal(finding(report, "tokens.machine-readable").outcome, "fail");
    assert.deepEqual(finding(report, "tokens.machine-readable").evidence, [
      "tokens.json (DTCG token easing.out is missing $type; DTCG token easing.snap is missing $type; DTCG token spring.gentle is missing $type; DTCG token spring.snappy is missing $type)",
    ]);
  });

  it("reports tokens.naming-consistency as N/A when no token names are available", async () => {
    const report = await audit(m1FixturePath("types-resolve-clean"));

    assert.equal(finding(report, "tokens.machine-readable").outcome, "fail");
    assert.equal(finding(report, "tokens.naming-consistency").outcome, "na");
    assert.deepEqual(finding(report, "tokens.naming-consistency").measure, {
      kind: "ratio",
      value: 0,
      detail: "No token names found; naming consistency is not applicable (tokens.machine-readable carries the missing-token-source gap).",
    });
    assert.deepEqual(finding(report, "tokens.naming-consistency").evidence, []);
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

  it("keeps unmarked deprecations out of deprecation.migration-notes (deprecation.marked carries the gap)", async () => {
    const report = await audit(m1FixturePath("deprecated-without-mark"));

    assert.equal(finding(report, "deprecation.marked").outcome, "fail");
    assert.equal(finding(report, "deprecation.migration-notes").outcome, "na");
    assert.deepEqual(finding(report, "deprecation.migration-notes").measure, {
      kind: "ratio",
      value: 0,
      detail: "0 @deprecated marks found; migration notes are not applicable (deprecation.marked carries unmarked deprecations).",
    });
    assert.deepEqual(finding(report, "deprecation.migration-notes").evidence, []);
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

  it("checks deprecation.migration-notes against failure and clean fixtures", async () => {
    const failing = await audit(join(repoRoot, "fixtures/scoring/deprecation-without-migration"));
    const clean = await audit(join(repoRoot, "fixtures/scoring/deprecation-migration-clean"));

    assert.deepEqual(finding(failing, "deprecation.migration-notes").measure, {
      kind: "ratio",
      value: 0,
      detail: "0/1 @deprecated marks name a replacement or migration path; missing: LegacyButton",
    });
    assert.equal(finding(failing, "deprecation.migration-notes").outcome, "fail");
    assert.deepEqual(finding(failing, "deprecation.migration-notes").evidence, ["LegacyButton"]);
    assert.equal(finding(clean, "deprecation.migration-notes").outcome, "pass");
    assert.equal(finding(clean, "deprecation.migration-notes").measure.value, 1);
  });

  it("checks deprecation.manifest-exclusion against failure and clean fixtures", async () => {
    const failing = await audit(join(repoRoot, "fixtures/scoring/deprecation-manifest-included"));
    const clean = await audit(join(repoRoot, "fixtures/scoring/deprecation-manifest-clean"));

    assert.deepEqual(finding(failing, "deprecation.manifest-exclusion").measure, {
      kind: "ratio",
      value: 0,
      detail: "0/1 deprecated components are excluded from or tagged in a manifest; missing: LegacyButton",
    });
    assert.equal(finding(failing, "deprecation.manifest-exclusion").outcome, "fail");
    assert.deepEqual(finding(failing, "deprecation.manifest-exclusion").evidence, ["LegacyButton"]);
    assert.equal(finding(clean, "deprecation.manifest-exclusion").outcome, "pass");
    assert.equal(finding(clean, "deprecation.manifest-exclusion").measure.value, 1);
  });

  it("reports deprecation migration and manifest checks as N/A when zero deprecated exports exist", async () => {
    const report = await audit(m1FixturePath("types-resolve-clean"));

    assert.deepEqual(finding(report, "deprecation.migration-notes").measure, {
      kind: "ratio",
      value: 0,
      detail: "0 @deprecated marks found; migration notes are not applicable (deprecation.marked carries unmarked deprecations).",
    });
    assert.equal(finding(report, "deprecation.migration-notes").outcome, "na");
    assert.deepEqual(finding(report, "deprecation.manifest-exclusion").measure, {
      kind: "ratio",
      value: 0,
      detail: "0 deprecated components found; manifest deprecation signalling is not applicable.",
    });
    assert.equal(finding(report, "deprecation.manifest-exclusion").outcome, "na");
  });

  it("reports deprecation.zombie-exports without scoring it", async () => {
    const failing = await audit(join(repoRoot, "fixtures/scoring/deprecation-zombie-exports"));
    const clean = await audit(join(repoRoot, "fixtures/scoring/deprecation-zombie-clean"));
    const deprecationCategory = failing.categories.find((category) => category.id === "deprecation");

    assert.deepEqual(finding(failing, "deprecation.zombie-exports").measure, {
      kind: "count",
      value: 1,
      detail: "1 barrel export is absent from docs/stories: GhostButton; docs/story presence resolved via file: Button via docs.mdx",
    });
    assert.equal(finding(failing, "deprecation.zombie-exports").outcome, "fail");
    assert.deepEqual(finding(failing, "deprecation.zombie-exports").evidence, ["GhostButton"]);
    assert.deepEqual(deprecationCategory, {
      id: "deprecation",
      score: null,
      applicable: 0,
      total: 3,
      weightRedistributed: true,
    });
    assert.equal(finding(clean, "deprecation.zombie-exports").outcome, "pass");
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

  it("checks agent.context-file-quality against doc-rot and clean fixtures", async () => {
    const failing = await audit(agentMetadataFixturePath("doc-rot-agents-md"));
    const clean = await audit(agentMetadataFixturePath("context-file-quality-clean"));

    assert.deepEqual(finding(failing, "agent.context-file-quality").measure, {
      kind: "ratio",
      value: 0.5,
      detail: "1/2 agent context component references resolve against exported components; dead references: GhostButton",
    });
    assert.equal(finding(failing, "agent.context-file-quality").outcome, "fail");
    assert.deepEqual(finding(failing, "agent.context-file-quality").evidence, ["GhostButton"]);
    assert.equal(finding(clean, "agent.context-file-quality").outcome, "pass");
    assert.equal(finding(clean, "agent.context-file-quality").measure.value, 1);
  });

  it("checks agent.llms-txt locally while validating external URL syntax only", async () => {
    const failing = await audit(agentMetadataFixturePath("llms-txt-broken"));
    const clean = await audit(agentMetadataFixturePath("llms-txt-clean"));

    assert.deepEqual(finding(failing, "agent.llms-txt").measure, {
      kind: "ratio",
      value: 0.25,
      detail: "1/4 llms.txt references are valid; invalid references: ./docs/missing.md, ./docs/raw-missing.md, https://%zz",
    });
    assert.equal(finding(failing, "agent.llms-txt").outcome, "fail");
    assert.deepEqual(finding(failing, "agent.llms-txt").evidence, ["./docs/missing.md", "./docs/raw-missing.md", "https://%zz"]);
    assert.equal(finding(clean, "agent.llms-txt").outcome, "pass");
    assert.equal(finding(clean, "agent.llms-txt").measure.value, 1);
  });

  it("distinguishes importing metadata examples from rebuild-style examples", async () => {
    const failing = await audit(agentMetadataFixturePath("reimplementation-spec-design-md"));
    const clean = await audit(agentMetadataFixturePath("instruction-manual-clean"));

    assert.deepEqual(finding(failing, "agent.instruction-manual").measure, {
      kind: "ratio",
      value: 0,
      detail: "0/1 metadata code examples import system components; rebuild examples: DESIGN.md#example-1",
    });
    assert.equal(finding(failing, "agent.instruction-manual").outcome, "fail");
    assert.deepEqual(finding(failing, "agent.instruction-manual").evidence, ["DESIGN.md#example-1"]);
    assert.equal(finding(clean, "agent.instruction-manual").outcome, "pass");
    assert.equal(finding(clean, "agent.instruction-manual").measure.value, 1);
  });

  it("reports agent.instruction-manual as N/A when no agent metadata files exist", async () => {
    const report = await audit(agentMetadataFixturePath("mcp-missing"));

    assert.deepEqual(finding(report, "agent.instruction-manual").measure, {
      kind: "ratio",
      value: 0,
      detail: "0 agent metadata files found; instruction-manual orientation is not applicable.",
    });
    assert.equal(finding(report, "agent.instruction-manual").outcome, "na");
  });

  it("checks agent.mcp-present against missing and detected fixtures", async () => {
    const failing = await audit(agentMetadataFixturePath("mcp-missing"));
    const clean = await audit(agentMetadataFixturePath("mcp-present"));

    assert.deepEqual(finding(failing, "agent.mcp-present").measure, {
      kind: "count",
      value: 0,
      detail: "0 MCP package/config carriers detected: none",
    });
    assert.equal(finding(failing, "agent.mcp-present").outcome, "fail");
    assert.deepEqual(finding(failing, "agent.mcp-present").evidence, []);
    assert.equal(finding(clean, "agent.mcp-present").outcome, "pass");
    assert.equal(finding(clean, "agent.mcp-present").measure.value, 1);
  });

  it("aggregates all five agent metadata checks", async () => {
    const report = await audit(agentMetadataFixturePath("category-aggregate"));
    const agentCategory = report.categories.find((category) => category.id === "agent");

    assert.deepEqual(
      ["agent.context-file-quality", "agent.manifest-coverage", "agent.llms-txt", "agent.instruction-manual", "agent.mcp-present"].map(
        (checkId) => finding(report, checkId).outcome,
      ),
      ["pass", "pass", "pass", "pass", "pass"],
    );
    assert.deepEqual(agentCategory, {
      id: "agent",
      score: 100,
      applicable: 5,
      total: 5,
      weightRedistributed: false,
    });
  });

  it("produces six real scored categories on the combined M1 fixture", async () => {
    const report = await audit(m1FixturePath("combined-six-pack"));

    assert.equal(report.applicability.applicable, 19);
    assert.equal(report.applicability.total, 21);
    assert.equal(report.applicability.confidence, "high");
    assert.ok(report.composite > 0);
    assert.equal(finding(report, "deprecation.marked").outcome, "pass");
    assert.equal(finding(report, "deprecation.marked").measure.detail, "1/1 known-deprecated exports carry @deprecated; missing: none");
    assert.equal(report.categories.length, 6);
    for (const category of report.categories) {
      assert.notEqual(category.score, null, `${category.id} should produce a real score`);
      assert.equal(category.applicable > 0, true, `${category.id} should have an applicable check`);
    }

    assert.deepEqual(report.findings.map((candidate) => candidate.severity), [
      "critical",
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
      "warning",
      "warning",
      "warning",
      "warning",
      "warning",
      "info",
      "info",
      "info",
      "info",
      "info",
    ]);
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
