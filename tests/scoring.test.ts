import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { scoreFindings } from "../src/audit/scoring.ts";
import type { AuditCheck, AuditFinding, CategoryId, Severity } from "../src/audit/types.ts";

describe("scoring machinery", () => {
  it("excludes N/A checks from denominators and flags redistributed category weight", () => {
    const checks = [
      check("docs.complete", "docs", "critical"),
      check("deprecation.empty", "deprecation", "warning"),
    ];
    const findings = [
      finding("docs.complete", "docs", "critical", "pass", 0.8),
      finding("deprecation.empty", "deprecation", "warning", "na", null),
    ];

    const scored = scoreFindings(checks, findings);

    assert.equal(scored.categories.find((category) => category.id === "docs")?.score, 80);
    assert.equal(scored.categories.find((category) => category.id === "deprecation")?.score, null);
    assert.equal(scored.categories.find((category) => category.id === "deprecation")?.applicable, 0);
    assert.equal(scored.categories.find((category) => category.id === "deprecation")?.total, 1);
    assert.equal(scored.categories.find((category) => category.id === "deprecation")?.weightRedistributed, true);
    assert.equal(scored.composite, 80);
  });

  it("uses high, medium, and low confidence thresholds at 0.9 and 0.7", () => {
    assert.equal(confidenceForApplicableCount(9), "high");
    assert.equal(confidenceForApplicableCount(7), "medium");
    assert.equal(confidenceForApplicableCount(6), "low");
  });

  it("uses default ARS v0.1 weights and marks custom weight overrides", () => {
    const checks = [check("docs.complete", "docs", "critical"), check("api.empty", "api", "warning")];
    const findings = [
      finding("docs.complete", "docs", "critical", "pass", 1),
      finding("api.empty", "api", "warning", "fail", 0),
    ];

    const defaultScored = scoreFindings(checks, findings);
    const customScored = scoreFindings(checks, findings, { weights: { docs: 10, api: 90 } });

    assert.deepEqual(defaultScored.weights, {
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
    assert.equal(defaultScored.composite, 55.6);
    assert.equal(customScored.weights.source, "custom");
    assert.equal(customScored.composite, 10);
  });

  it("uses severity-weighted means within each category", () => {
    const checks = [
      check("docs.critical-gap", "docs", "critical"),
      check("docs.warning-pass", "docs", "warning"),
      check("docs.info-pass", "docs", "info"),
    ];
    const findings = [
      finding("docs.critical-gap", "docs", "critical", "fail", 0),
      finding("docs.warning-pass", "docs", "warning", "pass", 1),
      finding("docs.info-pass", "docs", "info", "pass", 1),
    ];

    const scored = scoreFindings(checks, findings);

    assert.equal(category(scored, "docs").score, 42.9);
    assert.equal(category(scored, "docs").applicable, 3);
    assert.equal(category(scored, "docs").total, 3);
    assert.equal(scored.composite, 42.9);
  });

  it("keeps all-info categories as a normal weighted mean", () => {
    const checks = [check("agent.discovery", "agent", "info"), check("agent.mcp", "agent", "info")];
    const findings = [
      finding("agent.discovery", "agent", "info", "fail", 0.25),
      finding("agent.mcp", "agent", "info", "pass", 1),
    ];

    const scored = scoreFindings(checks, findings);

    assert.equal(category(scored, "agent").score, 62.5);
    assert.equal(scored.composite, 62.5);
  });

  it("limits a single failing info check to its severity weight share", () => {
    const checks = [
      check("tokens.hardcoded-values", "tokens", "warning"),
      check("tokens.machine-readable", "tokens", "warning"),
      check("tokens.naming-consistency", "tokens", "info"),
    ];
    const findings = [
      finding("tokens.hardcoded-values", "tokens", "warning", "pass", 1),
      finding("tokens.machine-readable", "tokens", "warning", "pass", 1),
      finding("tokens.naming-consistency", "tokens", "info", "fail", 0),
    ];

    const scored = scoreFindings(checks, findings);

    assert.equal(category(scored, "tokens").score, 80);
    assert.equal(scored.composite, 80);
  });

  it("reports unscored checks without moving category, composite, or applicability math", () => {
    const checks = [
      check("deprecation.marked", "deprecation", "critical"),
      { ...check("deprecation.zombie-exports", "deprecation", "info"), scored: false },
    ];
    const findings = [
      finding("deprecation.marked", "deprecation", "critical", "pass", 1),
      finding("deprecation.zombie-exports", "deprecation", "info", "fail", null),
    ];

    const scored = scoreFindings(checks, findings);

    assert.deepEqual(scored.categories.find((category) => category.id === "deprecation"), {
      id: "deprecation",
      score: 100,
      applicable: 1,
      total: 1,
      weightRedistributed: false,
    });
    assert.equal(scored.composite, 100);
    assert.deepEqual(scored.applicability, {
      applicable: 1,
      total: 1,
      confidence: "high",
    });
  });
});

function confidenceForApplicableCount(applicable: number) {
  const checks = Array.from({ length: 10 }, (_, index) => check(`docs.${index}`, "docs", "warning"));
  const findings = checks.map((candidate, index) =>
    finding(candidate.id, candidate.category, candidate.severity, index < applicable ? "pass" : "na", index < applicable ? 1 : null),
  );

  return scoreFindings(checks, findings).applicability.confidence;
}

function category(scored: ReturnType<typeof scoreFindings>, id: CategoryId) {
  const found = scored.categories.find((candidate) => candidate.id === id);
  assert.ok(found);
  return found;
}

function check(id: string, category: CategoryId, severity: Severity): AuditCheck {
  return {
    id,
    category,
    severity,
    signal: "fixture signal",
    carriers: ["fixture carrier"],
    measure: "fixture measure",
    fix: "Fix the fixture.",
    naBehavior: "N/A in fixture cases.",
    receipt: "Fixture receipt.",
    run: () => ({
      outcome: "pass",
      score: 1,
      measure: { kind: "ratio", value: 1, detail: "fixture" },
      evidence: [],
    }),
  };
}

function finding(
  checkId: string,
  category: CategoryId,
  severity: Severity,
  outcome: AuditFinding["outcome"],
  score: number | null,
): AuditFinding & { score: number | null } {
  return {
    checkId,
    category,
    severity,
    outcome,
    score,
    measure: { kind: "ratio", value: score ?? 0, detail: "fixture" },
    evidence: [],
    fix: "Fix the fixture.",
    receipt: "Fixture receipt.",
  };
}
