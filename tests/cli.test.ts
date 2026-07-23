import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { audit } from "../src/audit/audit.ts";

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
    assert.match(result.stdout, /DS Bench Audit: missing-usage-examples/);
    assert.match(result.stdout, /Score: 40\.7 \/ 100 - Not agent-ready/);
    assert.match(result.stdout, /Applicable Checks: 14 \/ 17 \(3 N\/A\)/);
    assert.doesNotMatch(result.stdout, /Confidence:/);
    assert.match(result.stdout, /Category Scores/);
    assert.match(result.stdout, /Docs & examples\s+58\.3\s+4\/4/);
    assert.match(result.stdout, /API clarity\s+100\s+4\/4/);
    assert.match(result.stdout, /Agent metadata\s+0\s+4\/5/);
    assert.match(result.stdout, /Top Findings/);
    assert.match(result.stdout, /Fix: Add one canonical story\/example per component\./);
    assert.match(result.stdout, /Full Detail/);
    assert.doesNotMatch(result.stdout, /Receipt:/);
  });

  it("--json emits the same report object contract", async () => {
    const result = spawnSync(process.execPath, [cliPath, "audit", fixturePath, "--json"], {
      encoding: "utf8",
    });

    assert.equal(result.status, 0);
    const expectedReport = await audit(fixturePath);
    assert.equal(result.stdout, `${JSON.stringify(expectedReport, null, 2)}\n`);

    const report = JSON.parse(result.stdout) as { rubricVersion: string; scoredCheckCount: number; registryFingerprint: string; findings: Array<{ checkId: string }> };
    assert.equal(report.rubricVersion, "ARS v0.3");
    assert.equal(report.scoredCheckCount, 22);
    assert.equal(report.registryFingerprint, "176a3461");
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
    assert.equal(report.composite, 55.2);
  });

  it("--exclude filters files through shared discovery", () => {
    const targetPath = join(repoRoot, "fixtures/m1/hardcoded-token-values");
    const result = spawnSync(process.execPath, [cliPath, "audit", targetPath, "--exclude", "src/button.css", "--json"], {
      encoding: "utf8",
    });

    assert.equal(result.status, 0);
    const report = JSON.parse(result.stdout) as { findings: Array<{ checkId: string; outcome: string; naReason?: string; evidence: string[] }> };
    const tokenFinding = report.findings.find((finding) => finding.checkId === "tokens.hardcoded-values");

    assert.equal(tokenFinding?.outcome, "na");
    assert.equal(tokenFinding?.naReason, "clean");
    assert.deepEqual(tokenFinding?.evidence, []);
  });

  it("renders a coherent end-to-end report for the combined M1 six-pack fixture", () => {
    const result = spawnSync(process.execPath, [cliPath, "audit", combinedFixturePath], {
      encoding: "utf8",
    });

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Score: 75\.3 \/ 100 - Needs targeted work/);
    assert.match(result.stdout, /Applicable Checks: 19 \/ 21 \(2 N\/A\)/);
    assert.match(result.stdout, /Docs & examples\s+83\.3\s+4\/4/);
    assert.match(result.stdout, /API clarity\s+100\s+4\/4/);
    assert.match(result.stdout, /Usage guidance\s+66\.7\s+1\/3/);
    assert.match(result.stdout, /Token hygiene\s+73\.3\s+3\/3/);
    assert.match(result.stdout, /Deprecation signalling\s+75\s+3\/3/);
    assert.match(result.stdout, /Agent metadata\s+22\.2\s+4\/5/);
    assert.match(result.stdout, /Showing 5 of 10 failing findings/);
    assert.match(result.stdout, /Result: 75\.3\/100 - Needs targeted work/);
    assert.doesNotMatch(result.stdout, /guidance\.alternatives-resolve/);
    assert.doesNotMatch(result.stdout, /Receipt:/);
  });

  it("--compact prints a short CI-oriented summary", () => {
    const result = spawnSync(process.execPath, [cliPath, "audit", combinedFixturePath, "--compact"], {
      encoding: "utf8",
    });

    assert.equal(result.status, 0);
    assert.match(result.stdout, /^DS Bench combined-six-pack: 75\.3\/100 - Needs targeted work - 1 critical - 6 warnings - 3 info\n/);
    assert.match(result.stdout, /Critical: docs\.usage-examples - Missing Card/);
    assert.equal(result.stdout.split("\n").filter(Boolean).length, 2);
  });

  it("--verbose prints all findings with evidence and receipts", () => {
    const result = spawnSync(process.execPath, [cliPath, "audit", combinedFixturePath, "--verbose"], {
      encoding: "utf8",
    });

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Findings\n\[fail\] critical docs\.usage-examples/);
    assert.match(result.stdout, /Evidence \(1\):\n    Card/);
    assert.match(result.stdout, /Receipt: Agents recreate components they can't see used/);
    assert.match(result.stdout, /\[na\] guidance\.alternatives-resolve/);
    assert.match(result.stdout, /Next: run `ds-bench audit .* --json`/);
  });
});
