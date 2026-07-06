# ADR 0003 — Intrinsic understandability dominates the score; checks target signals, not tools

**Status:** accepted (2026-07-06 grilling session)

## Context

The first weight strawman gave "agent metadata" 25% — the largest single category. But agent-facing files are the *easiest layer to fake* (and the layer greenfield generators hand out free): a system with a beautiful AGENTS.md and undocumented, unclear components would have scored well. Separately, early check drafts assumed specific carriers (Storybook manifest), which would bake one toolchain in as ideology and wrongly punish legitimate architectures.

## Decision

1. **Intrinsic understandability dominates.** Weights (rubric v0, pilot-calibrated then frozen): Docs & examples 25 · API clarity 20 · Usage guidance 15 · Token hygiene 15 · Deprecation signalling 15 · Agent metadata 10. A system with clear APIs, strong usage guidance, token discipline, and deprecation signalling scores well before AGENTS.md or MCP enters the picture; agent files are a delivery layer, not the foundation.
2. **Signals over tools.** Every check names the signal it needs and enumerates known carriers. Signal present via any carrier → scored on quality. Adopted carrier lacking the signal (Storybook installed, no manifest) → fail. No carrier anywhere → fail. Check structurally inapplicable → N/A, excluded from the denominator; composite always displays `applicable checks: X/Y` + confidence label so two equal scores don't pretend to be identical.
3. **Usage guidance is flagged provisional.** Hardest category to check mechanically without keyword bingo; v0 uses resolvable cross-references (alternatives that resolve to real exports) and confusable-pair mutual references as proxies. If the pilot shows noise, its weight rolls back into Docs & examples rather than shipping a junk signal.

## Consequences

- Goodhart defense: the most fakeable category moves the score least; gaming the audit requires actually improving the system.
- Leaderboard comparability is slightly reduced by N/A normalization — accepted; credibility over neatness.
- Every check carries a receipt (a documented agent-failure mode with citation); a check without a receipt doesn't ship.
