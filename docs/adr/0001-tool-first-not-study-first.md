# ADR 0001 — ds-bench is a diagnostic tool, not a research study

**Status:** accepted (2026-07-05 grilling session)

## Context

Planning kept drifting toward research-study design: ablation conditions (static files vs MCP), variance handling, higher n — optimizing for "the reproducible study Atlassian disclaimed." That drift raised cost, breadth, and — decisively — pushed the methodology past the point where every element could be defended unaided. The project's success criterion is a shipped, explainable tool: the value is the tool plus a clear account of how it works, not methodological novelty.

## Decision

ds-bench is a **diagnostic tool** (Lighthouse model: score → findings → ranked recommendations → fix → re-run → delta). Essays are the tool's launch stories, claiming "here's what the tool found," not "here's the definitive study."

Consequences for v0:

1. **Two conditions only:** C0 (bare: package installed; intrinsic developer surface like TS types stays) vs C1 (the full agent surface as shipped — static files and MCP together). "Which delivery mechanism is optimal" is an ablation the config can express later; it is not v0's question.
2. **The report is a first-class deliverable:** findings classified by the rule/tooling/human taxonomy, each mapped to a recommended fix; the re-run delta is the payoff metric.
3. **Standing constraint: one-sentence explainability.** Any methodology element that cannot be justified in one sentence is out of scope, regardless of rigor gained.
4. Sealed web access, n=3, mechanical scoring, capability-tagged task library all stand — they serve the tool.

## Alternatives considered

Three-condition design (bare / static / MCP) at n=3: buys the novel static-vs-MCP finding, costs +60 runs and a methodology defended secondhand. Rejected for v0; preserved as a config-level ablation and possible future essay.
