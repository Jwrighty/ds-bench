# ADR 0002 — Static audit ships first; behavioral benchmark is the committed fast-follow

**Status:** accepted (2026-07-05 grilling session). Reinforces ADR 0001; supersedes the original behavioral-first Phase 0 sequencing.

## Context

The original Phase 0 made the behavioral eval battery the MVP. That path requires a headless-agent harness, per-system task bindings, auth, and hundreds of agent runs before anyone sees value — weeks of build with real completion risk, and a tool whose first-run experience is heavy. Meanwhile the project's own three-layer model already contained a static layer described as an "automatable linter." The project's goal — a shipped, useful, explainable tool — is served better by that than by methodological novelty.

## Decision

One CLI, two tiers, shipped in order of friction:

1. **`ds-bench audit` (MVP, essay #1):** deterministic static analysis of a design-system repo/package. `npx`-runnable in seconds; no auth, no API, no task bindings. Output: composite score + category breakdown + findings + per-finding fix suggestions (the Advisor as a report section). No `--fix` command in v0: auto-generating agent files is commodity territory (Zaklad, Astryx CLI) and bad codegen sinks trust; a `fix` command for the safely-mechanical subset may follow.
2. **`ds-bench run` (v2, committed fast-follow — not "someday"):** the behavioral battery as specced in `docs/task-battery.md` (which stands as the v2 spec): C0/C1 conditions, capability-tagged task library, headless `claude -p` runner on the user's own auth, n=3, mechanical scorers.

Design rules:

- **Quality checks over presence checks.** "AGENTS.md exists" is fakeable; "manifest covers 14/22 exported components" is not. Every static check should measure coverage/consistency/staleness wherever mechanically possible. This is the standing answer to the "artifact scanning alone is fakeable" objection.
- **Field data designs the battery.** Static audits across many public systems produce empirical priors (what everyone gets wrong) that select and weight the behavioral tasks. The bridge deliverable: measuring whether static scores *predict* behavioral deltas — the "is your AGENTS.md theatre?" essay.
- Both tiers feed the same versioned rubric (composite + categories + published default weights; user-overridable, publications use defaults).

## Consequences

- Cedar remediation arc and Astryx validation survive unchanged, at ~zero API cost (audit → fix → re-audit delta).
- A static field survey across ~10 public systems becomes a weekend, pulling Phase 2 value forward.
- Accepted risk: the static tier is the commoditisable layer (a platform vendor could ship an equivalent linter). Accepted knowingly — a shipped, useful, curious tool is the goal; the behavioral tier remains the defensible ground and stays on the schedule.
- Cost: Phase 0 API spend drops to ~£0 (static tier needs none; behavioral tier later runs on a Claude subscription via headless CLI — verified against official docs 2026-07-05: `claude -p` supports subscription auth; the Agent SDK does not).
