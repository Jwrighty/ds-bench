# ds-bench — Phase 0 execution plan

**Settled in the 2026-07-05/06 grilling session.** Decision records: [ADR 0001](adr/0001-tool-first-not-study-first.md) (tool, not study) · [ADR 0002](adr/0002-static-first-two-tier.md) (static audit first, behavioral fast-follow) · [ADR 0003](adr/0003-intrinsics-dominate-signals-over-tools.md) (intrinsics dominate; signals over tools). Vocabulary: [CONTEXT.md](../CONTEXT.md). Check catalogue: [audit-checks.md](audit-checks.md). Behavioral (v2) spec: [task-battery.md](task-battery.md) + [research](research/task-battery-research.md).

## What ships

**`ds-bench audit <path>`** — deterministic static analysis of any design-system repo. Composite score (0–100, `applicable checks: X/Y` with any N/A broken out) + category breakdown + severity-ranked findings, each with a fix suggestion (Advisor) and a receipt. No AI, no auth, seconds to run. TypeScript, single package, npm `ds-bench`, standalone public repo once the first real report exists.

**Weights (draft rubric ARS v0.2):** Category weights: Docs & examples 25 · API clarity 20 · Usage guidance 15 (provisional) · Token hygiene 15 · Deprecation signalling 15 · Agent metadata 10. Severity weights within each category: critical 4 · warning 2 · info 1, because advisory checks carry signal but should not move composites as much as critical failures. Category weights are user-overridable; severity weights are rubric-owned; publications always use defaults. Composite comparisons require the same rubric version and registry fingerprint. Frozen after pilot, versioned as "Agent-Readiness Score (ARS)".

## Story arcs (essay #1 material)

1. **Cedar remediation arc (must-ship):** audit Cedar → findings → fix → re-audit → delta. The full Diagnose→Recommend→Remediate→Re-measure loop on a maintained reference system.
2. **Astryx validation (must-ship):** audit the one major system with a vendor-built agent surface; independence check against an externally authored surface.
3. **Field survey (must-ship):** ~10 public systems (MUI, Chakra, Polaris, Carbon, Primer, shadcn, Astryx, Cedar…). Field priors extracted ("everyone hardcodes spacing…") — these seed the behavioral battery design.
4. **Third-party remediation arc (stretch):** no-surface DS, apply Advisor suggestions, re-audit. First thing cut if schedule tightens.

Essay framing inputs (quotes, terminology, market-gap evidence) are collected in [research/ai-ready-design-systems-southleft.md](research/ai-ready-design-systems-southleft.md) §6; external sources indexed in [research/resources.md](research/resources.md). Headlines: "you cannot govern what you cannot measure" (the market thesis, stated by the field's editor); "machine-readable, not machine-governed" (positions ds-bench on the human-judgment side); avoid the term "agentic design systems".

## Weeks (agent-assisted estimates)

- **W1:** CLI scaffold + check engine + Docs/API/Agent-metadata categories; first real report on Cedar; repo public. Cedar Select/Combobox extension (1–2h) whenever convenient before behavioral runs — not a blocker for the audit.
- **W2:** remaining categories; report rendering; pilot on Cedar + 2–3 public systems → calibrate + freeze weights (decide Usage-guidance fate); Cedar remediation arc.
- **W3:** field-survey run (~10 systems); Astryx validation; field-priors write-up; essay draft; project write-up page (~1h, Astro).
- **W4:** essay final; README polish with score screenshot + field-survey table; public release checklist. Stretch arc if ahead.
- **W5+ (fast-follow, committed):** behavioral tier `ds-bench run` per task-battery.md — headless `claude -p` with authenticated CLI access, pinned Sonnet, C0/C1, n=3. Bridge essay #2: do static scores predict behavioral deltas ("is your AGENTS.md theatre?").

## Cost to run

The static tier uses no AI and runs entirely offline — free. The behavioral tier (v2) runs headless agent tasks on a Claude subscription; a 12-run pilot measures weekly-cap burn before committing to the full battery.

## Public release checklist

1. Publish the repo and npm package with a README that leads with the one-command audit flow.
2. Publish the methodology/write-up with limitations, rubric version, and pilot artifacts linked.
3. Share the field-survey summary as ecosystem patterns first, with per-system detail only as supporting evidence.
4. Invite issues and rubric critique against documented checks, receipts, and scoring rules.

Release CTA throughout: **run `npx ds-bench audit` on your own system** — the tool is the demo.

## Risks & mitigations

- **Usage-guidance checks too noisy** → pilot gate; weight rolls back into Docs & examples (ADR 0003).
- **Static tier commoditised by a vendor** → accepted knowingly (ADR 0002); behavioral tier is the moat and stays scheduled. Landscape check 2026-07-07: the niche is still empty — DSAudit (Southleft) shipped quietly but measures codebase health, not agent-readiness, and never reached npm; the only other instruments are manual questionnaires. Nearest behavioral-tier cousin is Southleft's active [ds-contracts-poc](https://github.com/southleft/ds-contracts-poc) (governed-vs-ungoverned agent scoring — watch it, plus agentic-spec and Clementine). Details: [research/ai-ready-design-systems-southleft.md](research/ai-ready-design-systems-southleft.md) §2.
- **Schedule tightens** → minimum publishable unit: audit tool + Cedar arc + partial field survey; each week ends in a shippable state.
- **Two identical scores mislead** → applicability count (`applicable checks: X/Y`, N/A broken out) always displayed; clean N/A leaves the denominator, uncovered N/A stays in it.
