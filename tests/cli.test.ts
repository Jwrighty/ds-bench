import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const repoRoot = process.cwd();
const fixturePath = join(repoRoot, "fixtures/missing-usage-examples");
const combinedFixturePath = join(repoRoot, "fixtures/m1/combined-six-pack");
const cliPath = join(repoRoot, "dist/src/cli.js");

describe("CLI", () => {
  it("prints a terminal audit report", () => {
    const result = spawnSync(process.execPath, [cliPath, "audit", fixturePath], {
      encoding: "utf8",
    });

    assert.equal(result.status, 0);
    assert.match(result.stdout, /composite score: 38\.2\/100/);
    assert.match(result.stdout, /applicable checks: 14\/22 \(low confidence\)/);
    assert.match(result.stdout, /Docs & examples\s+\[#####\.\.\.\.\.\]\s+50 \(4\/4\)/);
    assert.match(result.stdout, /API clarity\s+\[##########\]\s+100 \(4\/4\)/);
    assert.match(result.stdout, /Agent metadata\s+\[\.{10}\]\s+0 \(4\/5\)/);
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
    assert.equal(report.composite, 45.3);
  });

  it("--exclude filters files through shared discovery", () => {
    const targetPath = join(repoRoot, "fixtures/m1/hardcoded-token-values");
    const result = spawnSync(process.execPath, [cliPath, "audit", targetPath, "--exclude", "src/button.css", "--json"], {
      encoding: "utf8",
    });

    assert.equal(result.status, 0);
    const report = JSON.parse(result.stdout) as { findings: Array<{ checkId: string; outcome: string; evidence: string[] }> };
    const tokenFinding = report.findings.find((finding) => finding.checkId === "tokens.hardcoded-values");

    assert.equal(tokenFinding?.outcome, "na");
    assert.deepEqual(tokenFinding?.evidence, []);
  });

  it("renders a coherent end-to-end report for the combined M1 six-pack fixture", () => {
    const result = spawnSync(process.execPath, [cliPath, "audit", combinedFixturePath], {
      encoding: "utf8",
    });

    assert.equal(result.status, 0);
    assert.match(result.stdout, /composite score: 74\.2\/100/);
    assert.match(result.stdout, /applicable checks: 19\/22 \(medium confidence\)/);
    assert.match(result.stdout, /Docs & examples\s+\[########\.\.\]\s+83\.3 \(4\/4\)/);
    assert.match(result.stdout, /API clarity\s+\[##########\]\s+100 \(4\/4\)/);
    assert.match(result.stdout, /Usage guidance\s+\[#######\.\.\.\]\s+66\.7 \(1\/3\)/);
    assert.match(result.stdout, /Token hygiene\s+\[########\.\.\]\s+77\.8 \(3\/3\)/);
    assert.match(result.stdout, /Deprecation signalling\s+\[#######\.\.\.\]\s+66\.7 \(3\/3\)/);
    assert.match(result.stdout, /Agent metadata\s+\[##\.\.\.\.\.\.\.\.]\s+16\.7 \(4\/5\)/);
    assert.match(result.stdout, /guidance\.alternatives-resolve - na/);
    assert.match(result.stdout, /fix: Add one canonical story\/example per component\./);
    assert.match(result.stdout, /receipt: Agents recreate components they can't see used/);
  });
});
