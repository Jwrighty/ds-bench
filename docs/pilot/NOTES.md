# Pilot notes

## ARS v0.3 documentation-evidence rerun (2026-07-23)

Rubric: **ARS v0.3** (22 scored checks — unchanged surface, registry `176a3461`) · tool `0.1.0` · run 2026-07-23. The `<system>.{json,txt}` artifacts in this directory are now the **canonical ARS v0.3 reports**; the ARS v0.2 versions remain in git history and self-identify via their `rubricVersion` field.

ARS v0.3 changes the meaning of one scored check: `docs.undocumented-exports` (and the mechanical recognition reused by `deprecation.zombie-exports`) no longer credits a bare export-name occurrence in prose. Documentation coverage now requires a directly detectable carrier — meaningful JSDoc/TSDoc, a dedicated Markdown section or API-table entry, an importable usage example, or a manifest record that names *and* describes the export. See ADR 0004 and the check catalogue.

**Same-checkout validation (rubric effect isolated).** Each system was audited on one fresh checkout with both the v0.2 and v0.3 binaries, so the delta below is the rubric change alone, not repository drift:

| System | Composite v0.2 → v0.3 | Docs cat. v0.2 → v0.3 | Undocumented v0.2 → v0.3 | Zombie v0.2 → v0.3 |
| --- | --- | --- | --- | --- |
| Cedar | 97.7 → 97.0 | 99.4 → 96.9 | 0 → 16 | 0 → 2 |
| Shopify Polaris | 68.8 → 68.2 | 78.6 → 76.1 | 149 → 196 | 22 → 53 |
| MUI | 45.9 → 45.9 | 25.1 → 25.0 | 705 → 707 | 468 → 470 |
| Chakra | 37.1 → 36.9 | 50.6 → 49.7 | 1772 → 1871 | 881 → 970 |

Composite movement is ≤0.7 everywhere and the sanity ordering (Cedar > Polaris > MUI > Chakra) is unchanged, so the rule is **not materially noisy** — it tightens documentation coverage without destabilising or reordering scores. The undocumented counts rise because exports previously credited by bare-name prose now require real evidence; the increase is a coverage correction, not new failures introduced by the tool.

**Changed findings were inspected against their cited carriers**, not just composite movement:

- **Cedar's 16** are almost all type/config exports (`MetricCardProps`, `ToastApi`, `RecipeConfig`, `VariantProps`, …) that carry no JSDoc on their own declaration, no dedicated section, no importable example, and no described manifest record — their member fields are documented, the exports themselves are not. `RecipeConfig` is the Issue 30 false pass: it was named only in a remediation log describing it as undocumented, and v0.2 awarded it coverage. Under v0.3 it correctly fails.
- **Polaris's additions** (e.g. `ActionMenu`) are real components whose usage examples and reference docs live on the external Polaris site, not colocated in `polaris-react` — the pre-existing "examples outside the package dir" limitation, now surfaced honestly instead of masked by a stray prose mention.

No behaviour was rejected or narrowed: every changed finding resolved to an explainable mechanical rule, so no semantic heuristic was needed.

### Cedar — repository remediation vs. methodology change

Cedar's numbers must not be presented as one direct delta. Three distinct measurements:

- **96.0** — the published M2 reference (2026-07-08, ARS v0.2, older checkout).
- **97.7** — the *current* Cedar checkout under ARS v0.2. The **+1.7 over 96.0 is repository remediation** — real improvements to Cedar between checkouts, independent of the rubric.
- **97.0** — the *current* checkout under ARS v0.3, the **canonical after-report**. The **−0.7 from 97.7 is the methodology change** alone.

The canonical ARS v0.3 Cedar after-report (`cedar.json`/`cedar.txt`) does **not** depend on the audit log for documentation coverage: `docs/ds-bench-audits/**` no longer resolves any export's coverage, and the log-only export (`RecipeConfig`) is now a documentation failure. Final Cedar case-study numbers are unblocked by this validation.

---

# M2 pilot — generalization run on public systems (ARS v0.2, historical)

Rubric: **ARS v0.2** (22 scored checks, registry `176a3461`) · tool `0.0.0` · run 2026-07-08
Three unmodified public design systems, audited with the same binary, chosen for
carrier diversity: manifest present (Polaris) vs absent (Chakra/MUI), CSS-in-JS
(MUI/Chakra) vs CSS files (Polaris), token-object (Chakra) vs token-file (Polaris)
vs metadata (MUI). Artifacts in this directory: `<system>.json` (machine report)
and `<system>.txt` (rendered report).

**Framing:** ecosystem patterns first, per-system detail second, no team-shaming.
These systems are among the best-maintained in the ecosystem; where they fall short
of agent-readiness, so does nearly everyone — that is the point of the survey.

## Systems and headline results

| System | Package audited | Composite | Confidence* | Applicable* | Runtime | Carrier corner |
| --- | --- | --- | --- | --- | --- | --- |
| MUI (Material UI) | `@mui/material` | 45.9 | medium | 17/22 | 2.3s | CSS-in-JS, largest surface (~1,300 files) |
| Chakra UI | `@chakra-ui/react` | 37.1 | low | 15/22 | 3.5s | no manifest, 766-export surface |
| Shopify Polaris | `@shopify/polaris` | 68.7 | medium | 18/22 | 3.0s | manifest + token files + CSS Modules |

*Confidence is a derived label on the applicability ratio (JSON only — no longer printed in the terminal report). **The Applicable/Confidence figures for the three public systems above predate the issue-28 clean/uncovered N/A split** (their `.json` artifacts still count every N/A in the denominator, `X/22`, and carry no `naReason`). Regenerating them from their checkouts will drop structurally-clean N/As (e.g. zero-deprecation) out of the denominator, shrinking each `Y` and likely raising confidence — as it did for Cedar (`19/22 medium` → `19/19 high`). **Composites are unaffected** and final: the composite is category-weighted with N/A weight redistribution, independent of the applicability denominator.

Reports regenerated 2026-07-08 after the `api.types-resolve` unbuilt-checkout fix
(fix 3 below): Chakra 31.2→37.1 and Polaris 59.5→67.3 because a methodology
artifact no longer scores as a failure; MUI is unchanged (its types resolve from
source). Chakra's confidence tier drops to low because the N/A reduces its
applicable-check count to 15/22 — an honest reflection of how much of the rubric
can actually be assessed on that checkout.

Reports regenerated again 2026-07-08 after the `guidance.alternatives-resolve`
surface fix (fix 4 below): Polaris 67.3→68.7 because changelog/example/source-code
noise no longer under-credits alternatives guidance; MUI 50.7→45.9 because ordinary
source comments no longer count as alternatives guidance signal. Chakra is unchanged.

All three: same binary, no crashes, no hangs, seconds not minutes on the largest
system (AC 1 and AC 5 met).

## Generalization fixes (carrier logic, not per-system)

Four breaks surfaced; all fixed generally in the checks/carrier layer.

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

4. **`guidance.alternatives-resolve` counted auxiliary prose and implementation code
   as guidance (invalid findings).** Changelog migration entries, placeholder example
   identifiers, and ordinary component source near `@deprecated Use ... instead`
   comments were treated as alternatives guidance. The shared guidance layer now
   excludes auxiliary surfaces, drops conventional placeholder names, and scans
   structured `.meta.ts(x)` files without treating every implementation file as
   freeform guidance. `src/audit/checks/guidance-support.ts`. Regression locked in
   the alternatives changelog, placeholder, and source-noise fixtures.

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

**Composite 96.0 · high confidence · 19/19 applicable · 1.0s.** Cedar is the
only system of the four that ships the full agent-metadata surface (manifest,
llms.txt, agent metadata files, canonical examples) — which is expected, since it
was built against this rubric. That makes it the calibration anchor for the top of
the scale, and the gap to the public three (37–69) is the discriminating range the
weight freeze has to reason about. Remaining Cedar findings are real: 2/30
components lack importable usage examples (`MetricCard`, `StatusPill`).

## Gate readiness

Inputs for the weight-freeze gate (issue 11) are captured in this directory: three
public composites (MUI 45.9, Chakra 37.1, Polaris 68.7) plus Cedar (96.0), with all
invalid findings resolved and fixes general. No per-system special-casing was
introduced. Sanity ordering for the gate: Cedar > Polaris > MUI > Chakra, which
matches informed intuition about their agent-readiness surfaces.
