import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CHECK_REGISTRY } from "../src/audit/checks/registry.ts";
import { getCheckRegistryMetadata, getScoredCheckIds, RUBRIC_VERSION } from "../src/audit/rubric.ts";
import type { AuditCheck } from "../src/audit/types.ts";

const SCORED_CHECK_IDS_BY_RUBRIC_VERSION: Record<string, string[]> = {
  "ARS v0.2": [
    "agent.context-file-quality",
    "agent.instruction-manual",
    "agent.llms-txt",
    "agent.manifest-coverage",
    "agent.mcp-present",
    "api.barrel-completeness",
    "api.name-coherence",
    "api.prop-type-soundness",
    "api.types-resolve",
    "deprecation.manifest-exclusion",
    "deprecation.marked",
    "deprecation.migration-notes",
    "docs.example-imports-real",
    "docs.prop-descriptions",
    "docs.undocumented-exports",
    "docs.usage-examples",
    "guidance.alternatives-resolve",
    "guidance.confusable-pairs",
    "guidance.when-to-use",
    "tokens.hardcoded-values",
    "tokens.machine-readable",
    "tokens.naming-consistency",
  ],
};

describe("check registry", () => {
  it("registers every known check", () => {
    const ids = CHECK_REGISTRY.map((check) => check.id);
    assert.deepEqual(
      new Set(ids),
      new Set([
        "docs.prop-descriptions",
        "docs.usage-examples",
        "docs.example-imports-real",
        "docs.undocumented-exports",
        "api.prop-type-soundness",
        "api.types-resolve",
        "api.name-coherence",
        "api.barrel-completeness",
        "guidance.when-to-use",
        "guidance.alternatives-resolve",
        "guidance.confusable-pairs",
        "tokens.hardcoded-values",
        "tokens.machine-readable",
        "tokens.naming-consistency",
        "deprecation.marked",
        "deprecation.migration-notes",
        "deprecation.manifest-exclusion",
        "deprecation.zombie-exports",
        "agent.context-file-quality",
        "agent.manifest-coverage",
        "agent.llms-txt",
        "agent.instruction-manual",
        "agent.mcp-present",
      ]),
    );
  });

  it("contains fully metadata'd checks", () => {
    assert.ok(CHECK_REGISTRY.length >= 1);

    for (const check of CHECK_REGISTRY) {
      for (const field of ["id", "category", "severity", "signal", "carriers", "measure", "fix", "naBehavior", "receipt"] as const) {
        assert.ok(Object.hasOwn(check, field), `${check.id ?? "unknown check"} is missing ${field}`);
      }

      assertNonEmptyString(check.id, "id");
      assertNonEmptyString(check.category, `${check.id}.category`);
      assertNonEmptyString(check.severity, `${check.id}.severity`);
      assertNonEmptyString(check.signal, `${check.id}.signal`);
      assert.ok(check.carriers.length > 0, `${check.id}.carriers must not be empty`);
      for (const carrier of check.carriers) {
        assertNonEmptyString(carrier, `${check.id}.carriers[]`);
      }
      assertNonEmptyString(check.measure, `${check.id}.measure`);
      assertNonEmptyString(check.fix, `${check.id}.fix`);
      assertNonEmptyString(check.naBehavior, `${check.id}.naBehavior`);
      assertNonEmptyString(check.receipt, `${check.id}.receipt`);
      assert.equal(typeof check.run, "function");
    }
  });

  it("classifies every explicit N/A behavior as clean or uncovered", () => {
    for (const check of CHECK_REGISTRY) {
      if (check.naBehavior.startsWith("Never N/A") || check.naBehavior.startsWith("Reported but not scored")) {
        assert.equal(check.naReason, undefined, `${check.id}.naReason is only for checks that can return N/A`);
        continue;
      }

      assert.ok(check.naReason === "clean" || check.naReason === "uncovered", `${check.id}.naReason must classify its N/A behavior`);
    }
  });

  it("does not register duplicate check ids", () => {
    const ids = CHECK_REGISTRY.map((check) => check.id);
    assert.deepEqual(ids, Array.from(new Set(ids)));
  });

  it("snapshots the scored check surface against the declared rubric version", () => {
    assert.ok(Object.hasOwn(SCORED_CHECK_IDS_BY_RUBRIC_VERSION, RUBRIC_VERSION), `${RUBRIC_VERSION} needs a scored-check snapshot`);
    assert.deepEqual(getScoredCheckIds(CHECK_REGISTRY), SCORED_CHECK_IDS_BY_RUBRIC_VERSION[RUBRIC_VERSION]);
    assert.deepEqual(getCheckRegistryMetadata(CHECK_REGISTRY), {
      scoredCheckCount: 22,
      registryFingerprint: "176a3461",
    });
  });

  it("fingerprints scored check ids stably and changes when the scored surface changes", () => {
    const one = fakeCheck("tokens.one");
    const two = fakeCheck("docs.two");
    const unscored = fakeCheck("agent.unscored", false);
    const baseline = getCheckRegistryMetadata([one, two, unscored]);

    assert.deepEqual(getCheckRegistryMetadata([two, unscored, one]), baseline);
    assert.notEqual(getCheckRegistryMetadata([one, two, fakeCheck("api.three"), unscored]).registryFingerprint, baseline.registryFingerprint);
    assert.notEqual(getCheckRegistryMetadata([one, unscored]).registryFingerprint, baseline.registryFingerprint);
    assert.deepEqual(getCheckRegistryMetadata([one, two, fakeCheck("api.reported-only", false), unscored]), baseline);
  });
});

function assertNonEmptyString(value: string, label: string): void {
  assert.equal(typeof value, "string", `${label} must be a string`);
  assert.ok(value.trim().length > 0, `${label} must not be blank`);
}

function fakeCheck(id: string, scored: boolean | undefined = true): AuditCheck {
  return {
    id,
    category: "docs",
    severity: "warning",
    scored,
    signal: "test signal",
    carriers: ["test carrier"],
    measure: "test measure",
    fix: "test fix",
    naBehavior: "test N/A behavior",
    receipt: "test receipt",
    run: () => ({
      outcome: "pass",
      score: scored === false ? null : 1,
      measure: {
        kind: "ratio",
        value: 1,
        detail: "test detail",
      },
      evidence: [],
    }),
  };
}
