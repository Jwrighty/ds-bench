# PRD — `ds-bench audit` v0 (static tier)

Status: ready-for-agent
Created: 2026-07-06 · Reworked via /to-prd 2026-07-06 · Source: grilling session 2026-07-05/06
References: [PLAN](PLAN.md) · [audit-checks](audit-checks.md) · [CONTEXT](../CONTEXT.md) · ADRs [0001](adr/0001-tool-first-not-study-first.md) / [0002](adr/0002-static-first-two-tier.md) / [0003](adr/0003-intrinsics-dominate-signals-over-tools.md)

## Problem Statement

Design-system teams have no way to measure how ready their system is for AI agents. Agents fail against design systems in documented ways — invented props, wrong import paths, recreated components, hardcoded values, deprecated patterns — and the signals that prevent those failures are checkable from the repo, but nobody checks them. Teams that want to improve don't know where to start, whether their agent-facing files actually help, or how to prove improvement to anyone.

## Solution

A CLI a maintainer can run against their design-system repo in seconds — `npx ds-bench audit <path>` — with no auth, no AI, and nothing leaving their machine. It produces a composite Agent-Readiness Score with category breakdown, severity-ranked findings, a concrete fix suggestion per finding (the Advisor), and a receipt per finding (the documented agent-failure mode that justifies the check). Fix things, re-run, watch the delta. Three principles govern everything (see ADRs): it is a diagnostic tool, not a research study; the static audit ships before the behavioral benchmark; intrinsic understandability dominates the score while agent-facing files are only a delivery layer.

## User Stories

1. As a design-system maintainer, I want to run one command against my repo and get a score in seconds, so that trying the tool costs me nothing.
2. As a design-system maintainer, I want a composite 0–100 score, so that I have a single headline number to track and share.
3. As a design-system maintainer, I want category scores alongside the composite, so that I can see whether my weakness is docs, API clarity, usage guidance, tokens, deprecation signalling, or agent metadata.
4. As a design-system maintainer, I want findings ranked by severity with counts and names (which components, which values), so that I can act without re-deriving the analysis.
5. As a design-system maintainer, I want a concrete fix suggestion attached to every finding, so that the report is a to-do list, not a judgment.
6. As a design-system maintainer, I want every check to cite the documented agent-failure mode it prevents (its receipt), so that I can justify remediation work to my team.
7. As a design-system maintainer, I want to re-run the audit after making fixes and see the score delta, so that I can demonstrate improvement.
8. As a design-system maintainer whose team doesn't use Storybook, I want checks to target signals rather than specific tools, so that my architecture isn't penalised as ideology.
9. As a design-system maintainer, I want a clear distinction between a failed check and a not-applicable check, so that "we don't use that toolchain" isn't scored like "we expose no metadata."
10. As a design-system maintainer, I want the score displayed with its applicable-check count and a confidence label, so that my 68 isn't mistaken for someone else's 68.
11. As a design-system maintainer at a company, I want the audit to run fully offline with nothing leaving my machine, so that I can run it on proprietary code without a security review.
12. As a design-system team lead, I want to override category weights in my own runs via config, so that the score reflects my team's priorities — while published numbers always use the versioned defaults.
13. As a frontend engineer who codes with agents, I want to audit the design system I consume, so that I can show its owners why my agents keep producing off-system UI.
14. As an agent (Claude Code, Cursor) working in a consuming codebase, I want the systems I use to score well on intrinsic understandability, so that I choose the right component instead of recreating it — the audit exists to push systems toward this.
15. As a machine consumer (CI step, script), I want JSON output of the full report, so that I can track scores over time or gate on regressions.
16. *(pilot/publication acceptance)* As a reader of the field survey, I want per-system findings presented as ecosystem patterns first, so that I learn what everyone gets wrong rather than watching teams get shamed.
17. As a contributor, I want every check to declare its metadata (category, severity, signal, carriers, receipt, fix, N/A behavior) in a registry, so that I can add a check without touching the engine.
18. *(pilot/publication acceptance)* As the project maintainer, I want the first milestone to be a credible report on a maintained reference system (Cedar), so that the tool proves useful before it tries to be general.
19. *(pilot/publication acceptance)* As the project maintainer, I want the audit of 2–3 unmodified public systems to produce sane reports with the same binary, so that generalization is demonstrated by use, not by abstraction.
20. *(pilot/publication acceptance)* As the project maintainer, I want the rubric versioned (current draft: ARS v0.1) with weights frozen after a pilot, so that scores are comparable and critique targets the published methodology.

Stories tagged *(pilot/publication acceptance)* are program-level acceptance criteria, not build tickets — issue slicing should not turn them into CLI implementation work.

## Implementation Decisions

- **Single TypeScript package**, one npm binary (`ds-bench`), subcommand `audit`. No monorepo; the behavioral tier (`run`) joins later per ADR 0002.
- **One load-bearing seam:** an audit function taking a target path and config and returning a structured **AuditReport**. The CLI is glue; the terminal renderer is a pure function over the AuditReport; `--json` serializes the same object. The report contract (type shape — the seam's interface, expected to be stable):

  ```ts
  AuditReport {
    rubricVersion: string            // "ARS v0.1"
    toolVersion: string
    target: { name, path, detectedCarriers: string[] }
    weights: { source: "default" | "custom", values: Record<CategoryId, number> }
    composite: number                // 0–100
    applicability: { applicable: number, total: number, confidence: "high" | "medium" | "low" }
    categories: Array<{
      id: CategoryId, score: number | null,   // null = category entirely N/A
      applicable: number, total: number
    }>
    findings: Array<{
      checkId: string, category: CategoryId,
      severity: "critical" | "warning" | "info",
      outcome: "pass" | "fail" | "na",
      measure: { kind: "ratio" | "count", value: number, detail: string },  // e.g. 14/22, named offenders
      evidence: string[],            // component/file names, capped
      fix: string,                   // Advisor one-liner
      receipt: string                // documented failure mode + source
    }>
  }
  ```
- **Scoring math (v0.1 — simplest explainable rules, pilot-revisable):** each check scores a quality ratio 0–1; applicable checks are weighted within their category by severity (critical 4 · warning 2 · info 1). Rationale: advisory checks carry real signal, but a failing info check should only move its category by its documented share rather than as much as a critical failure. Category score = severity-weighted mean of applicable check scores × 100. Composite = weighted mean of scored categories; a category with zero applicable checks is null and its weight redistributes proportionally across scored categories, flagged in the report. Confidence label from the applicability ratio: high ≥ 0.9, medium ≥ 0.7, low < 0.7.
- **Score delta is external in v0:** the stable, versioned JSON report is the comparison artifact — users and publications diff two reports (story 7 is satisfied by re-running and comparing). A `--compare <previous.json>` flag is deferred; nothing in the report shape may break naive diffing without a rubricVersion bump.
- **Check registry:** every check is a registry entry declaring id, category, severity (critical/warning/info), the **signal** it targets, the **carrier list** it can read the signal from, its **receipt**, its **fix suggestion**, and its **missing-vs-N/A behavior**. Checks compute quality ratios (coverage/consistency/staleness), not presence booleans, wherever mechanically possible (ADR 0003).
- **Scoring:** category score = severity-weighted roll-up of applicable checks; composite = weighted mean over categories using the category weights in effect; N/A checks excluded from denominators; report always carries `applicable checks: X/Y` + confidence label. Default category weights (rubric ARS v0.1): Docs & examples 25 · API clarity 20 · Usage guidance 15 (provisional) · Token hygiene 15 · Deprecation signalling 15 · Agent metadata 10. Config-file category weight overrides permitted; publications use defaults.
- **Missing vs N/A rule (from the glossary):** signal present via any carrier → scored on quality; adopted carrier lacking the signal (Storybook present, no manifest) → fail; no carrier anywhere → fail; check structurally inapplicable → N/A.
- **v0 carrier support (pragmatic):** TypeScript exports, JSDoc/TSDoc, Storybook stories/MDX, manifests, package.json exports/types, token files, CSS files and CSS custom properties. No docs-site crawling or complex carrier auto-detection.
- **Determinism:** no AI, no network calls, local checkout only. Same input, same score, every time. Consequence for link checks (e.g. llms.txt): v0 validates **local/relative references and external URL syntax only**; external link liveness checking is out of scope.
- **Milestone ladder (anti-abstraction gates):**
  - **M0 — tracer bullet:** CLI → audit seam → **one** registry-backed check → scoring → terminal render + `--json`, proven against one fixture. The full report shape exists from the first check onward.
  - **M1 — credible Cedar report:** minimum subset = **at least one check per category** (suggested: usage-example coverage, types-resolve, when-to-use guidance, hardcoded-values, deprecations-marked, manifest coverage) so the composite and all six category bars are real. Acceptance: findings on Cedar are true, actionable, and not misleading.
  - **M2 — full catalogue + pilot:** remaining checks; run on 2–3 unmodified public systems; freeze weights; decide usage-guidance fate.
- **Check catalogue** as specced in the audit-checks document: six categories, every check with its receipt; usage-guidance checks flagged provisional with a pilot gate (weight rolls into Docs & examples if the signal is noise).

## Testing Decisions

- **Test only external behavior through the primary seam:** point the audit function at fixture repos and assert on the AuditReport. No per-check unit seams in v0 — a check is tested by a fixture that trips it, keeping check implementations free to change during the M1 sprint.
- **Fixtures are named for failure modes, not implementations** — e.g. `missing-usage-guidance`, `deprecated-without-migration`, `hardcoded-token-values`, `storybook-without-manifest`, `doc-rot-agents-md` — each a minimal synthetic design system engineered so every check has a known right answer. The fixture suite doubles as rubric documentation.
- **Check-registry validation test:** a test that every registered check carries complete metadata (id, category, severity, signal, carriers, receipt, fix suggestion, N/A behavior). "Every check carries a receipt" is a product promise; it fails CI, not code review.
- **Renderer snapshot tests:** the terminal renderer as a pure function over a fixed AuditReport.
- **CLI smoke test:** args → report → output, once.
- **Cedar is the manual M1 acceptance check**, not a CI test — it lives outside the repo and moves independently. Acceptance bar: findings are true, actionable, and not misleading.
- Prior art: none in this repo (greenfield); fixture conventions follow the check catalogue's category structure.

## Out of Scope

No AI anywhere in the audit path. No `--fix` command (fix suggestions only; auto-generating agent files is commodity territory and bad codegen sinks trust). No behavioral runs, sandbox or in-situ (that is `ds-bench run`, the committed fast-follow specced separately). No remote/URL auditing. No docs-site crawling. No winners-and-losers leaderboard framing anywhere in output or docs — the multi-system publication is a **field survey**.

## Further Notes

- The public framing rule is product surface: report and essay language present third-party findings as ecosystem patterns first ("everyone hardcodes spacing; nobody documents alternatives"), per-system detail second, and never shame a named team.
- The field survey across ~10 public systems produces the **field priors** that seed the behavioral tier's task selection and weighting — static findings are hypotheses the behavioral benchmark later tests ("do static scores predict behavioral deltas?").
- Weight freeze happens after the pilot (Cedar + 2–3 public systems); the ARS rubric is published and versioned at that point.
- Timeline context lives in the PLAN: M1 report on Cedar in week 1, repo public once the first real report exists, release write-up in week 4.
- **Issue-slicing guidance:** do not slice by category first. Issue 01 is the M0 tracer bullet (one vertical slice through CLI → seam → one check → score → render → JSON → fixture test); registry-validation and scoring machinery follow; check families come behind that, in category batches. The failure mode is six disconnected partial implementations.
