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
| MUI (Material UI) | `@mui/material` | 50.7 | medium | 18/22 | 2.5s | CSS-in-JS, largest surface (~1,300 files) |
| Chakra UI | `@chakra-ui/react` | 37.1 | low | 15/22 | 3.9s | no manifest, 766-export surface |
| Shopify Polaris | `@shopify/polaris` | 67.3 | medium | 19/22 | 3.4s | manifest + token files + CSS Modules |

Reports regenerated 2026-07-08 after the `api.types-resolve` unbuilt-checkout fix
(fix 3 below): Chakra 31.2→37.1 and Polaris 59.5→67.3 because a methodology
artifact no longer scores as a failure; MUI is unchanged (its types resolve from
source). Chakra's confidence tier drops to low because the N/A reduces its
applicable-check count to 15/22 — an honest reflection of how much of the rubric
can actually be assessed on that checkout.

All three: same binary, no crashes, no hangs, seconds not minutes on the largest
system (AC 1 and AC 5 met).

## Generalization fixes (carrier logic, not per-system)

Three breaks surfaced; all fixed generally in the checks/carrier layer.

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

3. **`api.types-resolve` scored unbuilt checkouts as failures (methodology artifact).**
   Chakra and Polaris point their package `exports` at compiled `dist/`/`build/`
   output that doesn't exist in a fresh source clone, so the synthetic import failed
   wholesale and scored 0 — a fact about the checkout, not the package's API clarity.
   The check now returns N/A when declared entry targets name a conventional
   build-output directory that is absent on disk; present-but-broken mappings still
   fail. `src/audit/checks/api-types-resolve.ts`. Regression locked in the
   `types-unbuilt-checkout` fixture (and the `types-do-not-resolve` fixture — a
   genuinely typo'd mapping — still fails).

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

- **`api.types-resolve` is not assessed on unbuilt checkouts:** the check now
  reports N/A (fix 3 above) rather than fail, but the underlying coverage gap
  remains — v0 audits source without building, so whether Chakra/Polaris types
  actually resolve from the published package is unverified here. A post-build or
  npm-tarball audit mode would close this.
- **Examples outside the package dir:** MUI's usage examples live in a separate
  `docs/` app, not in `packages/mui-material`, so `docs.usage-examples` reads 0/148.
  True within the audited package; v0 does no docs-site crawling (out of scope per PRD).
- **CSS-in-JS offender line numbers** are relative to the extracted style block, not
  the source file. Cosmetic; offender value and file are correct.

## Cedar — the M1 reference input (not a pilot system)

Cedar is the maintained reference system from the M1 acceptance gate (issue 04),
audited from its local checkout, not a public clone — it is the fourth calibration
input for the weight freeze, not part of the generalization pilot. Artifacts:
`cedar.{json,txt}`, same binary and rubric, run 2026-07-08.

**Composite 96.0 · medium confidence · 19/22 applicable · 1.5s.** Cedar is the
only system of the four that ships the full agent-metadata surface (manifest,
llms.txt, agent metadata files, canonical examples) — which is expected, since it
was built against this rubric. That makes it the calibration anchor for the top of
the scale, and the gap to the public three (37–67) is the discriminating range the
weight freeze has to reason about. Remaining Cedar findings are real: 2/30
components lack importable usage examples (`MetricCard`, `StatusPill`).

## Gate readiness

Inputs for the weight-freeze gate (issue 11) are captured in this directory: three
public composites (MUI 50.7, Chakra 37.1, Polaris 67.3) plus Cedar (96.0), with all
invalid findings resolved and fixes general. No per-system special-casing was
introduced. Sanity ordering for the gate: Cedar > Polaris > MUI > Chakra, which
matches informed intuition about their agent-readiness surfaces.
