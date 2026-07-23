# ADR 0004 — Documentation coverage requires mechanical evidence, not a bare name

**Status:** accepted (2026-07-23)

## Context

`docs.undocumented-exports` (and the mechanical recognition reused by the unscored `deprecation.zombie-exports`) originally credited any public export whose exact name appeared in a Markdown, MDX, example, story, or manifest carrier. That treated a bare name occurrence as documentation.

The Cedar remediation arc exposed the loophole directly: a remediation log named exports *while explaining that they were undocumented*, and the next audit awarded those exports coverage. Issue 30 added carrier-file citations so the false pass became inspectable, but intentionally left the false pass in place for this tranche to resolve.

The audit's value is that it is fast, deterministic, local, static, network-free, and explainable in one sentence. The fix must close the loophole without turning the static audit into a brittle approximation of semantic or AI analysis — deeper judgment belongs to the human or AI that reads the report.

## Decision

1. **Bare name matching is replaced by one mechanical documentation-evidence rule.** A public export counts as documented when the audit directly detects at least one of: meaningful JSDoc/TSDoc on the export; a Markdown heading dedicated to it or a row in a documentation-oriented API table; an example that imports and references it; or a manifest record that names it and supplies an explicit descriptive field. A bare occurrence of the name elsewhere in prose — audit log, task brief, changelog, ADR — is an incidental mention and earns no credit.
2. **The rule is content-structural, not a path blacklist.** It reads the shape of carriers (exact headings, documentation-table columns, referenced imports, explicit descriptive fields), not a growing list of repository paths to exclude. It performs no semantic document analysis, adds no confidence score, and adds no public strong/weak/absent evidence state — the report keeps its pass/fail model and cites both accepted evidence and rejected incidental carriers so ambiguous results stay inspectable.
3. **The scored check and the unscored zombie check share the recognition where their carrier sets overlap.** Both resolve the Markdown-section/API-table and importable-example carriers through the same detector, so a prose mention resolves neither a documented export nor a zombie.
4. **The change ships as ARS v0.3.** Because it changes the meaning of a scored check (not the check list or the weights, which stay frozen from the issue-11 gate), the rubric version increments. ARS v0.2 reports remain valid historical artifacts; v0.2 and v0.3 composites are not directly comparable. A materially noisy result on Cedar or the pilot systems is a reason not to ship the rule, not a reason to add increasingly semantic heuristics.

## Consequences

- The obvious remediation-log loophole is closed: naming an undocumented export in a planning artifact no longer improves the score.
- Coverage tightens across the board — exports previously credited by ordinary prose now fail until they gain a detectable carrier. This is the intended correction, and the JSON report (with cited carriers) is deliberately suitable input for a downstream human or AI to interpret ambiguous cases.
- Final Cedar case-study numbers wait for the ARS v0.3 sanity checks (Cedar, MUI, Chakra, Polaris) and a canonical rerun that does not depend on the audit log for documentation coverage; score movement from Cedar remediation must be reported separately from movement caused by this rubric change.
- Alias-aware modelling, inherited-prop analysis, alternative statuses, report comparison tooling, and semantic document analysis remain out of scope.
