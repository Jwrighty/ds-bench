import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const repoRoot = process.cwd();
const fixturePath = join(repoRoot, "fixtures/missing-usage-examples");
const cliPath = join(repoRoot, "dist/src/cli.js");

describe("CLI", () => {
  it("prints a terminal audit report", () => {
    const result = spawnSync(process.execPath, [cliPath, "audit", fixturePath], {
      encoding: "utf8",
    });

    assert.equal(result.status, 0);
    assert.match(result.stdout, /composite score: 75\/100/);
    assert.match(result.stdout, /applicable checks: 2\/3 \(low confidence\)/);
    assert.match(result.stdout, /Docs & examples\s+\[########\.\.\]\s+75 \(2\/2\)/);
    assert.match(result.stdout, /API clarity\s+\[N\/A\s+\]\s+N\/A \(0\/0\) weight redistributed/);
    assert.match(result.stdout, /fix: Add one canonical story\/example per component\./);
    assert.match(result.stdout, /receipt: Agents recreate components they can't see used/);
  });

  it("--json emits the same report object contract", () => {
    const result = spawnSync(process.execPath, [cliPath, "audit", fixturePath, "--json"], {
      encoding: "utf8",
    });

    assert.equal(result.status, 0);
    const report = JSON.parse(result.stdout) as { rubricVersion: string; findings: Array<{ checkId: string }> };
    assert.equal(report.rubricVersion, "ARS v0");
    assert.equal(report.findings[0].checkId, "docs.usage-examples");
  });

  it("--config loads custom weights from a JSON file", () => {
    const targetPath = join(repoRoot, "fixtures/scoring/deprecation-without-migration");
    const configPath = join(repoRoot, "fixtures/scoring/custom-weights.json");
    const result = spawnSync(process.execPath, [cliPath, "audit", targetPath, "--config", configPath, "--json"], {
      encoding: "utf8",
    });

    assert.equal(result.status, 0);
    const report = JSON.parse(result.stdout) as { composite: number; weights: { source: string; values: { docs: number; deprecation: number } } };
    assert.equal(report.weights.source, "custom");
    assert.equal(report.weights.values.docs, 10);
    assert.equal(report.weights.values.deprecation, 90);
    assert.equal(report.composite, 10);
  });
});
