# CONTEXT.md — Ubiquitous language

Glossary for the design-system agent-readiness benchmark project. Terms only — no implementation details. See `docs/adr/` for decisions.

## Runs & modes

- **Sandbox run** — executing the task battery in a fresh, harness-scaffolded workspace with only the target design system installed. No legacy code present. Identical conditions for every system; the mode the public field survey uses. Low-friction for adopters (no access to their codebase required).
- **In-situ run** — executing the battery inside a real, existing product codebase that consumes the design system, legacy patterns included. Higher setup and trust bar (runs in the user's repo with their keys; only scores leave). Phase 1+ expansion, not in rubric v0.
- **Sandbox/in-situ delta** — the difference in scores between the two modes for the same system. Measures how much the *consuming codebase* (rather than the design system's agent surface) drags agent output off-course. Prices the codebase-side remediation work.

## Brownfield (two distinct axes — do not conflate)

- **Brownfield system (Axis 1)** — the design system itself carries history: deprecated-but-still-exported components, renamed tokens that still resolve, patterns with training-data gravity that current docs disavow.
- **Brownfield workspace (Axis 2)** — the codebase the agent works in contains existing legacy code that exerts imitation gravity on agent output. Tested by in-situ runs, not by fabricated seed repos.

## Battery & tasks

- **Task library** — the full set of specced tasks the harness knows about, each declaring the capabilities it requires.
- **Capability tags** — the machine-readable list of component/feature capabilities a task needs from a target system (e.g. `needs: [dialog, toast]`). Resolved against the target's inventory (manifest or export scan) to decide which tasks can run.
- **Matched subset** — the intersection of tasks runnable against every system in a comparison; published comparisons only score the matched subset. Tasks outside it are reported as *skipped*, and a skip caused by a missing component category is itself a readiness finding.
- **Task battery** — the tasks selected from the library for a given run (~10 in v0), executed against each target system under each condition.
- **Deprecation trap** — a task whose most training-data-natural solution uses a deprecated-but-still-exported API of the target system (Axis 1). Scores whether the agent surface successfully steers away from it. Must use *real* deprecated surface, never fabricated.
- **Condition** — a defined configuration of the agent's context for a run (e.g. no agent surface vs. full agent surface). "With docs" is not one condition; the delivery mechanism is part of the condition definition.
- **Agent surface** — the sum of machine-readable artifacts a design system ships for agents: AGENTS.md/CLAUDE.md, llms.txt, manifest/schema, DESIGN.md, MCP server, Storybook composition templates, etc.

## Tiers

- **Audit (static tier)** — `ds-bench audit`: deterministic static analysis of a design system's repo/package — token hygiene, docs/manifest coverage, deprecation signalling, agent-metadata quality. Seconds to run, no auth, no AI. The MVP.
- **Benchmark run (behavioral tier)** — `ds-bench run`: the agent task battery (see Battery & tasks) executed under conditions C0/C1. The v2 fast-follow and validation instrument for the static tier.
- **Presence check vs quality check** — a presence check asserts an artifact exists (fakeable); a quality check measures its coverage, consistency, or staleness (not fakeable). Static-tier checks must be quality checks wherever mechanically possible.
- **Field priors** — empirical patterns observed by auditing many public systems (e.g. "manifests are usually incomplete"), used to select and weight behavioral tasks.

## Scoring

- **Composite score** — the single 0–100 roll-up per system (per condition, in behavioral runs), computed from category scores via the weights in effect. The headline and re-run delta unit. Always displayed with its applicability count and confidence label.
- **Category scores** — the per-dimension scores always shown alongside the composite.
- **Default weights** — the published, versioned weighting used for all public comparisons and the field survey. Users may override weights for their own runs; published numbers never use overrides.
- **Field survey** — the published scan of many public design systems: an industry snapshot of agent-readiness patterns ("what everyone gets wrong"), presented as shared findings, not a winners-and-losers ranking. The term replaces "leaderboard" in all public framing.
- **Intrinsic understandability** — how comprehensible the system is to an agent from its substance alone: API clarity, docs/examples coverage, usage guidance, token discipline, deprecation signalling. Dominates the score.
- **Delivery layer** — the agent-facing packaging of that substance (AGENTS.md/CLAUDE.md, llms.txt, manifest, MCP). Cheap to add, easy to fake; weighted lightest.
- **Signal vs carrier** — a *signal* is the information agents need (component metadata, usage examples, deprecation marks); a *carrier* is any concrete mechanism conveying it (Storybook manifest, `.meta.ts`, JSDoc, docs site). Checks target signals and enumerate known carriers; no carrier is required as ideology.
- **Missing vs N/A** — *missing* (a fail): the signal is absent, or an adopted carrier lacks it (Storybook present, no manifest). *N/A* (excluded from denominator): the check genuinely cannot apply (CSS scan on a zero-CSS system). "We don't use Storybook" is fine; "we expose no usable metadata anywhere" is a fail.
- **Usage guidance** — when-to-use / when-not / alternatives / decision rules per component. The choose-the-right-component signal. Most important and most provisional category: v0 proxies are resolvable cross-references and confusable-pair guidance; the pilot decides whether the signal holds or its weight rolls back into docs coverage.

## Tool loop

- **Diagnose → Recommend → Remediate → Re-measure** — the tool's core loop: benchmark a system, classify findings, suggest concrete agent-surface improvements, apply them, re-run, report the delta.
- **Advisor** — the tool step that maps findings to ranked, concrete remediation recommendations (add manifest/llms.txt, adjust AGENTS.md/CLAUDE.md, add MCP). Distinct from the scorers: scorers measure, the advisor prescribes.
- **Remediation arc** — a published before/after case: bare benchmark → advisor recommendations applied → re-measured delta. The canonical evidence unit for the tool.
