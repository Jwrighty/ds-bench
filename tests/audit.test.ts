import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { join } from "node:path";
import { audit } from "../src/audit/audit.ts";

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
    assert.equal(report.composite, 50);
    assert.deepEqual(report.applicability, {
      applicable: 1,
      total: 1,
      confidence: "high",
    });
    assert.equal(report.categories.length, 6);
    assert.deepEqual(report.categories[0], {
      id: "docs",
      score: 50,
      applicable: 1,
      total: 1,
    });
    assert.deepEqual(
      report.categories.slice(1).map((category) => category.score),
      [null, null, null, null, null],
    );

    assert.equal(report.findings.length, 1);
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
  });
});
