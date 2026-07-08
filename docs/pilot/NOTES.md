# M2 pilot — generalization run on public systems

Rubric: **ARS v0.2** (22 scored checks, registry `176a3461`) · tool `0.0.0` · run 2026-07-08
Issue: [`10-m2-pilot-generalization`](../../.scratch/ds-bench-audit-v0/issues/10-m2-pilot-generalization.md)

Three unmodified public design systems, audited with the same binary, chosen for
carrier diversity (see the issue for the selection rationale). Artifacts in this
directory: `<system>.json` (machine report) and `<system>.txt` (rendered report).

**Framing:** ecosystem patterns first, per-system detail second, no team-shaming.
These systems are among the best-maintained in the ecosystem; where they fall short
of agent-readiness, so does nearly everyone — that is the point of the survey.

## Systems and headline results

| System | Package audited | Composite | Confidence | Applicable | Runtime | Carrier corner |
| --- | --- | --- | --- | --- | --- | --- |
| MUI (Material UI) | `@mui/material` | 50.7 | medium | 18/22 | 2.4s | CSS-in-JS, largest surface (~1,300 files) |
| Chakra UI | `@chakra-ui/react` | 31.2 | medium | 16/22 | 3.9s | no manifest, 766-export surface |
| Shopify Polaris | `@shopify/polaris` | 59.5 | high | 20/22 | 3.4s | manifest + token files + CSS Modules |

All three: same binary, no crashes, no hangs, seconds not minutes on the largest
system (AC 1 and AC 5 met).

## Generalization fixes (carrier logic, not per-system)

Two breaks surfaced; both fixed generally in the checks/carrier layer.

1. **Stack overflow on deep barrel re-export graphs (crash — all three systems).**
   Export-symbol resolution restarted its cycle-guard on every hop, so a re-export
   cycle (`a` re-exports from `b`, `b` from `a` — routine in large barrels) recursed
   until the stack blew. Fixed by memoizing each file's resolved symbols and marking
   files in-progress so cycles break once instead of overflowing.
   `src/audit/component-inventory.ts`.

2. **`tokens.hardcoded-values` misread non-shipping surfaces (invalid findings).**
   The magic-value scan counted test files, story files, `.storybook` config, and
   even changelog markdown — so a changelog PR reference like `#4424` was read as a
   hex color, and `*.stories.tsx` demo widths counted as styling debt. The check now
   scans only style-family and code-source files, excluding auxiliary test/story/
   config paths. `src/audit/checks/tokens-hardcoded-values.ts`. Regression locked in
   the `hardcoded-token-values` fixture.

   Impact of the fix: MUI 16→2 offenders (surviving `#fff` in `Paper.js` is a real
   CSS-in-JS literal), Chakra 1→0 (its only offender was a story file, now passes),
   Polaris 363→188 (survivors are all real shipping CSS — `postcss-mixins/`,
   `*.module.css`, `global.css`).

## Findings-quality notes (spot-checked factual)

Remaining findings were spot-checked as factually true against source (AC 2). Highlights:

- **MUI** — `#fff` hardcoded in `Paper.js` overlay styles: real (lines 127/129).
  Strong API clarity (89) and fully-marked deprecations (100). Weak spot is agent
  metadata (0): no manifest, no context file, no llms.txt.
- **Chakra** — `docs.example-imports-real` flags one unresolved import (`Frame`):
  real dead reference in an example. 766 exports with no manifest and no when-to-use
  guidance drives the low usage/metadata scores.
- **Polaris** — the strongest of the three: real machine-readable tokens (60/60
  parse), 9/16 legacy exports carry `@deprecated` with migration notes. The
  `pc-button-*_hover` token names it flags for kebab inconsistency are real.

## Ecosystem patterns (field-survey seed)

Consistent across all three well-maintained systems:

- **Nobody ships a component manifest** the audit can read — manifest coverage is
  0/N everywhere, so agents get no structured component index.
- **Nobody ships agent metadata** — no context file, no llms.txt, no MCP surface on
  any of the three.
- **When-to-use / confusable-pair guidance is largely absent** — components tell an
  agent how to *call* them, rarely when to *choose* them over a sibling.
- **Token discipline is actually good** once demo/test noise is excluded — the real
  shipping style surfaces reference tokens far more than they hardcode.

## Disclosed limitations (not bugs — v0 boundaries)

- **`api.types-resolve` on an unbuilt checkout:** Chakra and Polaris point their
  package `exports` at compiled `dist/` that doesn't exist in a fresh source clone,
  so the synthetic import fails wholesale. Factually true of the checkout; would
  resolve post-build. v0 audits source without building — disclose, don't special-case.
- **Examples outside the package dir:** MUI's usage examples live in a separate
  `docs/` app, not in `packages/mui-material`, so `docs.usage-examples` reads 0/148.
  True within the audited package; v0 does no docs-site crawling (out of scope per PRD).
- **CSS-in-JS offender line numbers** are relative to the extracted style block, not
  the source file. Cosmetic; offender value and file are correct.

## Gate readiness

Inputs for the weight-freeze gate (issue 11) are captured: three public composites
plus Cedar, with all invalid findings resolved and fixes general. No per-system
special-casing was introduced.
