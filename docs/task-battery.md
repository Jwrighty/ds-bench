# Task battery — behavioral tier (v2) spec — DRAFT

**Status: DRAFT — this is now the spec for `ds-bench run`, the behavioral fast-follow (see ADR 0002; static `audit` ships first). Pending: fold in research-pass recommendations (`docs/research/task-battery-research.md`), per-task speccing, and field priors from static audits.**

Battery design decided in the 2026-07-05 grilling session:

- Tasks live in a **task library**; each task declares **capability tags** (`needs: [...]`) resolved against the target system's inventory (Cedar: `.meta.ts`/`cedar.manifest.json`; systems without a manifest: static export scan).
- Published comparisons score the **matched subset** only; unrunnable tasks are reported as skipped, and a skip from a missing component category is itself a readiness finding.
- v0 runs **sandbox mode only** (fresh scaffolded workspace, DS installed, no legacy code). In-situ mode is the Phase 1+ expansion.
- Every task produces one page/component at a fixed path (deterministic scorer target). No data fetching, no routing.
- Cedar pre-run extension (hours, Claude-assisted): add Select/Combobox (optionally Breadcrumbs). Inventory extension does not contaminate the with/without-agent-surface comparison (that arc is about the agent surface, not component count).
- No planted deprecations, ever. The trap task only fires on *real* deprecated surface.

## Draft library (11 tasks; matched subset target ≈ 10 per system)

| # | Task (shared spec; per-system variant binds names) | Category | Needs | Stresses |
|---|---|---|---|---|
| 1 | Settings form — text input, select, switch, checkbox, inline validation, submit | Form/a11y | text-field, select, switch, checkbox, button | Label/error wiring; the canonical task |
| 2 | Destructive-action confirm dialog — trigger → modal → danger variant | Composition | dialog, button | Focus trap; variant APIs |
| 3 | Data table — sortable columns + empty state | Composition | table | Prop hallucination (Cedar's Table is presentational: does the agent read that, or invent `onSort`?) |
| 4 | Stats dashboard — card grid, headings, spacing | Token adherence | card, stat, layout | Magic-value temptation; layout primitives vs raw divs |
| 5 | Dark-mode/theme override of a given page | Theming | theming | Token-layer understanding vs hardcoded colors |
| 6 | Toast/notification on async action complete | Composition | toast | Imperative APIs / providers — hallucinated-API territory |
| 7 | Filter panel — checkbox group + multi-select + clear-all | Form | checkbox, select-multi | Composite assembly; hand-roll bait |
| 8 | Tabs page shell | Composition | tabs | Structure props; deprecated-pattern zone |
| 9 | **Deprecation trap** — ticket whose natural solution is a deprecated-but-exported API | Trap | deprecated-surface | Docs vs training-data gravity. Week-1 check: does Astryx have real deprecations? Unexercised in v0 if neither target qualifies — disclosed in essay, activates in Phase 2 (MUI/Polaris). |
| 10 | Custom one-off component (pricing card) styled only with system tokens | Token adherence | tokens | Token discipline when no component exists |
| 11 | Icon-only action bar — IconButton + Tooltip, accessible labels | Form/a11y | icon-button, tooltip | Classic mechanical a11y catch (missing accessible names) |
| 12 | **Name-mismatch reuse probe** — ticket phrased with the *obvious* generic name where the system's actual component name differs | Composition | (per-system binding) | Isolates discovery-driven recreation (research rec) |

## Research-pass revisions adopted (see `docs/research/task-battery-research.md`)

- Task 1 scored on **fidelity**, not completion (canonical tasks complete fine but score ~5% fidelity without context — Atlassian; saturation worry unsupported by evidence, so canonical shapes stay).
- Task 5: optional color-difference (CIEDE2000) before/after check.
- Task 11: assert accessible-name **content**, not just presence.
- **Pre-flight probe stage** (Astryx self-check style): 3 cheap Q&A probes per system before the battery — fast signal, low cost.
- Cross-cutting: PARTIAL credit tier in task pass; penalty table published with the rubric; tokens/turns/time logged per run; failed-run prompts fed back into task-spec review.

## Conditions & runner (settled)

C0 bare (package + intrinsic dev surface) vs C1 full shipped agent surface (static files + MCP together). Web access sealed (no fetch/search tools; install precedes agent start). Runner: headless `claude -p` on the user's own auth (subscription-legal; Agent SDK requires API key), pinned Sonnet full model id, n=3, mean-of-3 with disagreement flagging.

Open items: per-task specs (fixed ticket text, acceptance assertions, per-system bindings); verify Astryx deprecated surface; select field-prior-informed weights after the static field survey exists.
