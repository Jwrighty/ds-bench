import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CHECK_REGISTRY } from "../src/audit/checks/registry.ts";

describe("check registry", () => {
  it("contains exactly the fully metadata'd docs.usage-examples check for M0", () => {
    assert.equal(CHECK_REGISTRY.length, 1);
    assert.equal(CHECK_REGISTRY[0].id, "docs.usage-examples");

    for (const check of CHECK_REGISTRY) {
      assert.ok(check.id);
      assert.ok(check.category);
      assert.ok(check.severity);
      assert.ok(check.signal);
      assert.ok(check.carriers.length > 0);
      assert.ok(check.measure);
      assert.ok(check.fix);
      assert.ok(check.naBehavior);
      assert.ok(check.receipt);
      assert.equal(typeof check.run, "function");
    }
  });
});
