# Audit check catalogue — static tier (`ds-bench audit`) — DRAFT v0.2

**Governing rules** (ADR 0003): intrinsics dominate; checks target *signals* and enumerate *carriers*; quality checks over presence checks; every check carries a **receipt**. Missing ≠ N/A: adopted-carrier-without-signal or no-carrier-at-all = fail; structurally-inapplicable = N/A (excluded from denominator). Composite ships with `applicable checks: X/Y` + confidence label, plus the scored-check count and registry fingerprint.

Input: local repo checkout (`npx ds-bench audit <path>`). All checks deterministic — no AI, no network (external links: syntax validation only).

## Scoring rubric

Category weights: Docs & examples 25 · API clarity 20 · Usage guidance 15 (provisional) · Token hygiene 15 · Deprecation signalling 15 · Agent metadata 10.

Severity weights within each category: critical 4 · warning 2 · info 1. Rationale: advisory checks carry real signal, but a failing info check should only move its category by its documented share rather than as much as a critical failure.

Composite scores are comparable only when both the rubric version and registry fingerprint match. The rubric version records intentional scoring-rule changes; the registry fingerprint is derived from the sorted scored-check ids, so it changes when checks are added, removed, or moved in/out of scoring. If either value differs, compare category/finding narratives instead of treating the composite delta as apples-to-apples.

Each entry below maps 1:1 to a registry entry: **id** · severity · signal · carriers · measure · fix suggestion · N/A behavior · receipt. **Default N/A behavior: never N/A** — the signal is universal; absence anywhere is a fail. Only checks with an explicit "N/A when" deviate.

## 1. Docs & examples coverage — weight 25

- **`docs.prop-descriptions`** · warning · signal: prop documentation · carriers: JSDoc/TSDoc, manifest prop docs · measure: % exported components whose public props carry descriptions · fix: add TSDoc descriptions to public props, starting with the most-used components · receipt: agents invent props when undescribed (Astryx failure catalogue).
- **`docs.usage-examples`** · critical · signal: usage examples · carriers: Storybook stories/MDX, examples dir, canonical-examples files · measure: % exported components with ≥1 importable usage example · fix: add one canonical story/example per component · receipt: agents recreate components they can't see used (Atlassian DESIGN.md experiment).
- **`docs.example-imports-real`** · critical · signal: example fidelity · carriers: same as usage-examples · measure: % example imports that resolve against package exports · fix: correct or delete examples with dead imports · N/A when: no examples exist at all (then `docs.usage-examples` carries the failure) · receipt: wrong-import-path failure mode (Astryx).
- **`docs.undocumented-exports`** · warning · signal: documentation coverage · carriers: all docs carriers · measure: count of exports with no docs presence anywhere, listed by name · fix: document or un-export · receipt: field-prior candidate ("18 undocumented components").

## 2. API clarity — weight 20

- **`api.prop-type-soundness`** · warning · signal: type precision · carriers: TS types · measure: `any`/`unknown` rate on exported component props · fix: replace `any` props with precise types · N/A when: system ships no TypeScript types at all (then `api.types-resolve` fails instead) · receipt: hallucinated-prop detection depends on sound types.
- **`api.types-resolve`** · critical · signal: importability · carriers: package.json types/exports fields · measure: synthetic import of every export typechecks · fix: repair types/exports field mapping · receipt: wrong-import failure mode.
- **`api.name-coherence`** · warning · signal: discoverability · carriers: source layout, stories, manifest entries · measure: component name ↔ file/story/manifest-entry mismatch count · fix: align names across carriers · receipt: component names function as instructions, not labels — inconsistent naming makes agent component selection effectively random (Klinke, via DSC "Architecture, Not Documentation", 2026-06).
- **`api.barrel-completeness`** · info · signal: import ergonomics · carriers: package barrel · measure: exports reachable from root vs deep-import-only count · fix: re-export from root or document deep paths in agent metadata · receipt: agents guess deep paths (Astryx npm-alias lesson).

## 3. Usage guidance — weight 15 — **PROVISIONAL**

Most important, least mechanically checkable. If the pilot shows noise, this category's weight rolls back into Docs & examples (ADR 0003) rather than shipping keyword bingo.

- **`guidance.when-to-use`** · warning · signal: selection guidance · carriers: meta files, manifest fields, docs sections (heading heuristics) · measure: % components with when-to-use / when-not content · fix: add when-to-use/when-not sections to component docs · receipt: agents must choose components, not just call them (Atlassian recreation finding).
- **`guidance.alternatives-resolve`** · warning · signal: alternative signposting · carriers: same · measure: % "alternatives/instead" references that resolve to real exports · fix: reference real components in alternatives guidance · N/A when: no alternatives content exists anywhere (then `guidance.when-to-use` carries the gap) · receipt: resolvable cross-references can't be faked by boilerplate.
- **`guidance.confusable-pairs`** · warning · signal: disambiguation · carriers: same · measure: for detected confusable pairs present in the inventory (Dialog/Popover, Select/RadioGroup, seed list ~8), % pairs that reference each other · fix: add mutual "use X instead when…" notes · N/A when: fewer than 2 confusable-pair members, or no complete seed pair, in inventory · receipt: wrong-component selection failure mode.

## 4. Token hygiene — weight 15

- **`tokens.hardcoded-values`** · warning · signal: token discipline in DS source · carriers: CSS files, CSS-in-JS, style props · measure: magic colors/spacing/z-index per 100 style-LOC vs token references · fix: replace named offenders with token references · N/A when: zero style-LOC detected across all style carriers (the glossary's canonical N/A: CSS scan on a zero-CSS system) · receipt: agents imitate the system's own habits; field-prior candidate ("everyone hardcodes spacing").
- **`tokens.machine-readable`** · warning · signal: token availability to tools · carriers: DTCG files, token packages, CSS custom properties · measure: token source present and parseable (DTCG schema-valid where claimed) · fix: publish tokens in a machine-readable format · receipt: machine-readable tokens are the theming signal agents can consume.
- **`tokens.naming-consistency`** · info · signal: token predictability · carriers: token source · measure: naming-pattern violation rate against the system's own dominant pattern · fix: rename outliers to the dominant pattern · N/A when: no token names are available from machine-readable token sources (then `tokens.machine-readable` carries the gap), or token names use an unmodeled convention the classifier cannot score · receipt: inconsistent names invite fabricated tokens (Kaelig's 27).

## 5. Deprecation signalling — weight 15

- **`deprecation.marked`** · critical · signal: deprecation marks · carriers: JSDoc `@deprecated` · measure: % known-deprecated exports carrying the mark (known-deprecated = docs/changelog/manifest cross-reference where available, plus name-pattern inference: `Legacy*`/`Deprecated*`/`Old*` prefixes and suffixes) · fix: add `@deprecated` to legacy exports · N/A when: zero known-deprecated exports detected (young/well-tended system — reported as such, not penalised; mirrors `deprecation.migration-notes`) · receipt: deprecated patterns dominate training data (DesignSystemDev).
- **`deprecation.migration-notes`** · warning · signal: redirection · carriers: `@deprecated` text · measure: % `@deprecated` marks naming the replacement · fix: append "use X instead" to every mark · N/A when: zero `@deprecated` marks exist (young/well-tended system — reported as such, not penalised; unmarked deprecations stay `deprecation.marked`'s gap) · receipt: a bare mark doesn't redirect an agent.
- **`deprecation.manifest-exclusion`** · warning · signal: metadata-level deprecation · carriers: Storybook `!manifest` tag, manifest deprecated fields · measure: % deprecated components excluded/tagged in manifest · fix: tag deprecated entries in the manifest · N/A when: zero deprecated exports, or no manifest (then `agent.manifest-coverage` carries the manifest gap) · receipt: Storybook first-party convention.
- **`deprecation.zombie-exports`** · info (reported, not scored in v0.2) · signal: trap surface · carriers: all · measure: exports absent from docs/stories but present in barrel, listed · fix: document, deprecate, or remove · receipt: zombie exports are trap surface for training-data gravity.

## 6. Agent metadata (delivery layer) — weight 10

- **`agent.context-file-quality`** · warning · signal: agent context accuracy · carriers: AGENTS.md, CLAUDE.md, .cursorrules · measure: file exists **and** dead-reference rate against real exports (doc rot) · fix: regenerate/correct stale component references; wire generation to releases · receipt: stale context misleads worse than none; documentation drift — agents can't tell which source is authoritative — is the first-named failure mode in the field (Bormüller, Into Design Systems).
- **`agent.manifest-coverage`** · warning · signal: machine-readable component metadata · carriers: cedar.manifest-style manifests, Storybook manifest · measure: manifest covers N/M exported components · fix: generate or complete the manifest · receipt: partial manifests → agents guess the gaps; field-prior candidate ("manifests are usually incomplete"). Structured JSON metadata cut tokens ~80% and annual cost 5× vs Markdown docs (Wolosin/Indeed MCP benchmark, 1,056 prompts — secondary coverage, see research/ai-ready-design-systems-southleft.md §3).
- **`agent.llms-txt`** · info · signal: agent discovery index · carriers: llms.txt · measure: present; local/relative references resolve; external URLs syntactically valid (**no liveness check — determinism rule**) · fix: add/repair llms.txt · receipt: contested convention, weighted low.
- **`agent.instruction-manual`** · critical · signal: instruction-manual vs re-implementation-spec orientation · carriers: DESIGN.md, AGENTS.md, example blocks in metadata · measure: % metadata code examples that *import* the system's components (vs describing rebuilding them) · fix: rewrite metadata examples to import, not re-implement · N/A when: no agent metadata files exist (then `agent.context-file-quality` carries the absence) · receipt: re-implementation specs cause component recreation (Atlassian).
- **`agent.mcp-present`** · info · signal: on-demand context delivery · carriers: MCP server package/config · measure: detectable presence · fix: consider shipping an MCP server (delivery mechanism, not substance) · receipt: on-demand context outperformed portable files (Atlassian).

## Open items

- Detection heuristics per carrier (what counts as a docs snippet / heading heuristic) — spec during M1/M2 build.
- Confusable-pair seed list (~8 pairs); extend from field priors.
- Weight freeze after pilot (Cedar + 2–3 public systems), then the ARS rubric is published and versioned.

### Candidate checks from research pass (2026-07-07, see research/ai-ready-design-systems-southleft.md §6)

- **`agent.foundations-coverage`** — does the agent context file declare foundation rules (spacing scale, typography, color usage), not just a component index? Receipt: foundations "can't be fetched on demand"; retrieval-only MCPs still produced typography/spacing/color drift (Wolosin). Decide at weight freeze — issue 20.
- **Field-survey observation questions (W3, not checks):** do low-scoring systems have monolithic single-file component docs ("smaller context bubbles" argument)? How common is foundations content in agent context files?
- **v1 parking lot:** semantic token layering — purpose-named tokens vs raw-value names only ("tokens need to carry purpose, not just values", Williams); adjacent to `tokens.naming-consistency` but measures the semantic layer's existence, not naming consistency.
