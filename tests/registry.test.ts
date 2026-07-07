import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CHECK_REGISTRY } from "../src/audit/checks/registry.ts";

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
        "api.types-resolve",
        "guidance.when-to-use",
        "tokens.hardcoded-values",
        "deprecation.marked",
        "deprecation.migration-notes",
        "agent.manifest-coverage",
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

  it("does not register duplicate check ids", () => {
    const ids = CHECK_REGISTRY.map((check) => check.id);
    assert.deepEqual(ids, Array.from(new Set(ids)));
  });
});

function assertNonEmptyString(value: string, label: string): void {
  assert.equal(typeof value, "string", `${label} must be a string`);
  assert.ok(value.trim().length > 0, `${label} must not be blank`);
}
