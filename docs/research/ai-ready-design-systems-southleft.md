# AI-ready design systems — Southleft / Design Systems Collective research pass

**Status:** research complete, 2026-07-07. Bounded pass over the TJ Pitre (Southleft) and Design Systems Collective corpus on AI-ready design systems, design-system audit tooling, and machine-readability. Companion to `task-battery-research.md`; sources indexed in `resources.md`.

Conventions: every claim carries its source URL. Statements marked **[inference]** are research synthesis, not something a source says. Paywalled/unreachable sources are flagged, and claims resting on secondary coverage say so.

---

## TL;DR

- **DSAudit shipped — quietly.** The "Lighthouse for your design system" tool TJ Pitre teased on LinkedIn (July 2025) exists as an open-source repo at [github.com/southleft/ds-audit](https://github.com/southleft/ds-audit) (created 2025-07-12, last pushed 2026-06-18, 7 stars, never published to npm). It scores six weighted categories — **Component Library 25 · Design Tokens 20 · Documentation 20 · Accessibility 13 · Tooling & Infrastructure 12 · Performance 10** — with A–F grades and an optional Claude-powered insights layer. Crucially, it measures *general codebase health*, not agent-readiness: no deprecation-signalling, no agent-metadata, no usage-guidance checks. ds-bench's niche is empty as far as this corpus shows.
- **The strongest quantitative result in the corpus is Diana Wolosin's Indeed MCP benchmark**: 8 MCP configurations × 1,056 prompts over 77 components; Markdown docs cost ~30,000 tokens/query at 82% coverage with hallucinations; JSON metadata delivered the same knowledge with **~80% fewer tokens** and 5× lower annual cost ($300 vs $1,500). Her rule: **"JSON for MCP, Markdown for LLM"** ([intodesignsystems.com](https://www.intodesignsystems.com/blog/design-system-not-ready-for-ai-agents), secondary coverage of the paywalled [substack post](https://intodesignsystems.substack.com/p/ai-design-system-mcp-example)).
- **Wolosin's second finding matters more for ds-bench**: an on-demand MCP "solves component retrieval, but it doesn't solve quality" — foundations (typography, spacing, color) "can't be fetched on demand. They have to be present before the model writes a single line of UI." The fix is *always-on rules* + on-demand MCP + an orchestrating AGENTS.md — a concrete quality bar for `agent.context-file-quality` beyond dead-reference checking ([designsystemscollective.substack.com](https://designsystemscollective.substack.com/p/architecture-not-documentation)).
- **Southleft's own experiment is direct behavioral-tier validation**: their `ds-contracts-poc` repo reports an ungoverned agent scoring **69/100 with 91 violations ("invented props, hard-coded colors, restyled components")** vs 100/100 when constrained by a machine-readable contract catalog — the exact failure modes and delta-under-conditions shape ds-bench's battery measures ([github.com/southleft/ds-contracts-poc](https://github.com/southleft/ds-contracts-poc)).
- **The consensus definition across the whole corpus is ds-bench's ADR 0003 thesis stated independently**: "The practices that make a design system AI-ready are the same ones that make it readable, period" (TJ Pitre); "they are the fundamentals of good systems work" (Shane P Williams). Intrinsics dominate; delivery is packaging. Nobody in this corpus has automated the measurement — every assessment found is manual (Southleft's email-gated six-dimension scorecard, Murphy Trueman's 15-item questionnaire) or measures the wrong thing (DSAudit).

---

## 1. What "AI-ready" means in this corpus

### TJ Pitre's five layers of machine-readability

From the Design Systems Collective interview ([designsystemscollective.com](https://www.designsystemscollective.com/ai-just-turns-the-lights-on-tj-pitre-on-design-systems-and-ai-d57b095e9a90), Shane P Williams, 2026-03-28):

1. **Structured tokens** cascading predictably without hard-coded values
2. **Complete metadata** (properties, boolean flags, states, behavioral expectations)
3. **Articulated intent** — answering "why does this component exist?"
4. **Component contracts** — platform-agnostic JSON-based render schemas
5. **Validation tooling** for continuous audits and parity checks

Framing quote: **"Machine-readability is structural integrity"** — as opposed to surface-level visual consistency. Where systems break under AI: hard-coded token values, incomplete variants, inconsistent naming, missing behavioral metadata, design-code drift, vague documentation — "historical shortcuts that were never addressed," not AI-induced problems.

**[inference]** Layers 1–3 map cleanly onto ds-bench categories (token hygiene, API clarity/docs, usage guidance). Layer 4 (render contracts) and layer 5 (continuous validation) are outside the static audit's scope but describe what ds-bench itself *is* from the target's point of view — a system that scores well on ds-bench has effectively outsourced layer 5.

### Wolosin: machine-readable systems and "AIX"

- Definition: a machine-readable design system can "express its knowledge in structured formats that AI systems can interpret directly" — component APIs, usage rules, accessibility constraints, tokens, interaction patterns ([designsystemscollective.com](https://www.designsystemscollective.com/machine-readable-design-systems-designing-for-ai-as-a-user-28077c9f2144), 2026-03-05).
- Coins **AIX (AI Experience)** as a parallel to UX: "the structure of a design system shapes how AI behaves when generating interfaces" (same source).
- Her metadata schema for a DS MCP has three layers: behavioral rules, business intelligence (goals/audience/product nuances), and implementation props — deliberately *excluding* visual properties ("the Figma MCP already delivers that") ([designsystemscollective.com](https://www.designsystemscollective.com/ai-metadata-powering-a-design-system-mcp-b5deafcae8f5), 2025-08-11).

### Shane P Williams (DSC): intent legibility

- AI-readiness = "intent legibility at the point where decisions get made. Tokens need to carry purpose, not just values. Components need metadata that explains what they are for, not just how they look" ([designsystemscollective.substack.com #73](https://designsystemscollective.substack.com/p/the-system-knows-what-you-built-does), 2026-06-29).
- The reframe that matches ds-bench's positioning exactly: "The question is not whether your design system is AI-ready. It is whether it is fundamentally sound enough for it not to matter either way" ([#64, Legible by Design](https://designsystemscollective.substack.com/p/legible-by-design-what-ai-readiness), 2026-04-27).
- "Most design systems are not systems. They are collections of components with a shared colour palette and a Confluence page nobody trusts" ([#67](https://designsystemscollective.substack.com/p/your-system-cant-explain-itself-thats), 2026-05-18).

### The governance boundary: machine-readable, not machine-governed

TJ's most recent piece draws the line ds-bench's Advisor should respect ([southleft.substack.com](https://southleft.substack.com/p/machine-readable-not-machine-governed), 2026-07-06):

- Thesis: "make the system machine-readable. Don't make it machine-governed." Machines read and query; humans own deprecation decisions, membership decisions, meaning.
- "Gaps your team tolerates because everyone knows the unwritten rules are exactly the gaps a machine can't see" — the audit target is *implicit knowledge made explicit*.
- Companion piece ([My Beef with Agentic Design Systems](https://southleft.substack.com/p/my-beef-with-agentic-design-systems), 2026-06-19): a design system is "a set of decisions an organization has agreed to and committed to enforcing over time"; "agents do the work between the gates. Humans own the gates and the judgment calls"; closing the loop without humans yields "confident, unowned drift." Test for legitimacy: **"What rejects the agent's output, and who decided the rule?"**

**[inference]** ds-bench sits on the right side of this line by construction (deterministic checks, humans act on findings), and the framing is directly quotable for the essay: ds-bench is validation tooling for the judgment layer, not an autonomous governor.

---

## 2. The audit-tooling landscape (direct comparables)

### DSAudit — shipped, quietly, measuring something else

- **LinkedIn tease** (July 2025, text captured verbatim by user): "like Lighthouse, but for your design system's codebase"; health score; "actionable insights across architecture, tokens, accessibility, coverage, and consistency"; component-level diagnostics; Claude + MCP chat; "currently built for single-repo design systems"; "I'm not releasing it just yet" ([linkedin.com](https://www.linkedin.com/posts/tpitre_designsystems-ai-ugcPost-7350913762054262784-tLl3/)).
- **What actually shipped**: [github.com/southleft/ds-audit](https://github.com/southleft/ds-audit) — "A CLI-based auditing tool designed to evaluate the health, structure, and completeness of code-based design systems." Repo created 2025-07-12 (days after the post), public-release cleanup Sept 2025, categories consolidated 7→6 in Dec 2025, last push 2026-06-18. 7 stars, 1 fork, **never published to npm** (install is local `npm link`). Linked from [southleft.com/ai-design-systems](https://southleft.com/ai-design-systems/) only via the LinkedIn post. No launch blog post or follow-up found.
- **Categories & weights**: Component Library 25% (structure, type safety, tests, a11y, Storybook docs) · Design Tokens 20% (architecture, coverage, format consistency, redundancy) · Documentation 20% (READMEs, APIs, governance) · Accessibility 13% (ARIA, keyboard, contrast) · Tooling & Infrastructure 12% (build, CI/CD, linting) · Performance 10% (code splitting, bundle size). Weighted A–F grades, composite score, priority-sorted recommendations with effort/impact, HTML dashboard, optional Claude "AI-Powered Insights."
- **[inference] Differentiation:** DSAudit asks "is this a healthy design-system codebase?"; ds-bench asks "can an agent use this system correctly?" There is no overlap on ds-bench's highest-weight signals: nothing in DSAudit checks deprecation signalling, agent metadata (AGENTS.md/manifest/llms.txt quality), usage guidance, example-import fidelity, or docs-vs-exports staleness. Its AI layer is *interpretive* (Claude explains findings), not part of the measurement — ds-bench's no-AI determinism is a real methodological difference worth stating. Also note: DSAudit's weighting (performance, CI, tests) would *reward* things agents never see — a concrete illustration of ADR 0003's signal-vs-carrier argument.

### Southleft's "Is Your Design System AI-Ready?" scorecard

- Lead-gen self-assessment on [southleft.com/ai-design-systems](https://southleft.com/ai-design-systems/): "We put together a scorecard covering the six dimensions that determine how well a design system can support AI workflows. Score yourself in 10 minutes and find out where your leverage is." Delivered via HubSpot form (name + email); **the six dimensions are not published on the page** and were not recoverable without submitting the form.
- Best available proxies for what the six dimensions are: **[inference]** (a) DSAudit's six categories above (same company, same count, "Lighthouse-style" framing); (b) the LinkedIn post's five insight areas (architecture, tokens, accessibility, coverage, consistency); (c) the interview's five machine-readability layers. None of these is confirmed as the scorecard's list.
- **It is a manual questionnaire and a services funnel, not a tool** — Southleft's monetization is consulting/workshops/courses. ds-bench's `npx ds-bench audit` one-command automation has no counterpart here.

### Murphy Trueman's designsystemsforai.com (found in passing)

- "Is your design system AI-ready? Free 10-minute assessment" — a **15-item self-assessment** scoring four areas: "documentation, component architecture, design-to-code connection, and workflow integration," with "specific recommendations" ([designsystemsforai.com](https://designsystemsforai.com/), site metadata; author Murphy Trueman — *not* a Southleft property, despite surfacing in scorecard searches). Item text is client-side/gated; one sample prompt visible in the bundle: "Would this make sense if I changed my colour palette tomorrow?"
- Trueman also authored the agent-facing file taxonomy — **AGENTS.md (project instructions) vs SKILL.md (procedural knowledge) vs DESIGN.md (brand/visual rules)** — cited in DSC #67 ([designsystemscollective.substack.com](https://designsystemscollective.substack.com/p/your-system-cant-explain-itself-thats)).
- **[inference]** Second confirmation that the market's assessment instruments are manual questionnaires. ds-bench automates what these hand-wave.

### FigmaLint and the design-side pipeline

- FigmaLint "audits your Figma files for component consistency, accessibility compliance, and design token usage," with auto-fix suggestions and handoff exports ([southleft.com/ai-design-systems](https://southleft.com/ai-design-systems/)); it "helps determine AI readiness" per the DSAudit LinkedIn post, and scores designs on "completeness and machine-readability" with a working threshold: "if it scored 85 or below, work needed to be done" ([ergomania.eu interview](https://ergomania.eu/ai-ready-design-systems-tj-pitre/), 2026-06-23).
- The pipeline TJ describes: FigmaLint validates designs pre-development → DSAudit validates the codebase → Design Systems Assistant MCP ([github.com/southleft/design-systems-mcp](https://github.com/southleft/design-systems-mcp)) provides the knowledge base → Story UI generates layouts. "DSAudit picks up where FigmaLint leaves off" (LinkedIn post).
- **[inference]** ds-bench only covers the code side, deliberately. FigmaLint's existence confirms the design-file side has its own auditor; no one audits the *agent surface* of the code side.

### ds-contracts-poc — the behavioral-tier cousin

Source: [github.com/southleft/ds-contracts-poc](https://github.com/southleft/ds-contracts-poc) (updated 2026-07-07 — active now).

- Versioned JSON contracts per component (props, legal values, anatomy, token bindings, ARIA semantics); React and Figma libraries both *generated* from the contract; "the source of truth is neither surface."
- **Three-way parity differ** classifying contract/code/canvas differences as ahead/behind/mismatched; diffs promoted into the contract as reviewable changes.
- **Brownfield extraction** adapters (React/TSX, Custom Elements Manifest) field-tested against Shoelace (58 components) and Mantine (245 components, 1,691 props); extraction "proposes and reports; it never guesses your anatomy or silently auto-matches names."
- **Governed AI-generation result:** ungoverned agent 69/100 with 91 violations ("invented props, hard-coded colors, restyled components"); governed agent constrained by the compiled contract catalog 100/100 with zero violations — and when it hit a real gap, it "report[ed] the gap instead of faking around it."
- **[inference]** This is a with/without-surface condition comparison with a violation-count score — methodologically the same shape as ds-bench's C0/C1 battery, run by the loudest practitioner in this space, published as a repo README rather than a methodology. It independently confirms the violation taxonomy (invented props, hard-coded values, recreation/restyling) and that the delta is enormous. It also overlaps ds-bench's brownfield-extraction interests (Axis 1) and is the closest thing to a competitor for the *behavioral* tier — worth tracking.

---

## 3. Format and delivery evidence (Wolosin / Indeed)

The one rigorous benchmark in this corpus, and the primary source is paywalled — reconstruction below rests on **secondary coverage** by the same guest author (Sil Bormüller) plus Wolosin's own free articles.

- **Method:** 22 prompts × 3 runs × 2 (MCP input / LLM output) × 8 MCP configurations = **1,056 prompts**, testing Indeed's docs for 77 components across five formats: Markdown, plain Markdown, hybrid Markdown+JSON, JSON, and TOON (Token-Oriented Object Notation) ([intodesignsystems.com blog](https://www.intodesignsystems.com/blog/design-system-not-ready-for-ai-agents); paywalled primary: [intodesignsystems.substack.com](https://intodesignsystems.substack.com/p/ai-design-system-mcp-example), 2026-06-08).
- **Results:** Markdown ≈ 30,000 tokens/query, 82% coverage, hallucinations present; JSON = higher accuracy, **80% fewer tokens, 5× lower annual cost ($300 vs $1,500)**. Rule: "JSON for MCP, Markdown for LLM" — structured contracts (APIs, props, sizes, variants) in JSON with "explicit keys, explicit values and no ambiguity"; natural-language instructions in Markdown. After restructuring, Indeed produced "4,300 AI prototypes in 4 months" (same sources). TJ's summary of the study: JSON beat Markdown "by ~80% in token efficiency across 1,000+ agent prompts," making **format choice a performance characteristic** ([southleft.substack.com](https://southleft.substack.com/p/machine-readable-not-machine-governed)).
- **The quality gap:** retrieval-only MCPs still produced typography drift, wrong color tokens, spacing that ignored the system — "an MCP is on-demand and returns only what the prompt asks for, whereas foundations… have to be present before the model writes a single line of UI." Fix: **progressive disclosure of context** — (1) always-on rules injected into every prompt, (2) on-demand MCP queries, (3) an AGENTS.md orchestration file ([intodesignsystems.com blog](https://www.intodesignsystems.com/blog/design-system-not-ready-for-ai-agents); [DSC #67](https://designsystemscollective.substack.com/p/your-system-cant-explain-itself-thats)).
- Monolithic component definitions are their own failure: single-file docs force huge context windows; Spotify found developers bypassed the system entirely; the fix is decomposing into Foundation/Style/Behavior layers — "smaller context bubbles" ([intodesignsystems.com blog](https://www.intodesignsystems.com/blog/design-system-not-ready-for-ai-agents)).

**[inference]** For the static tier this suggests two things ds-bench doesn't currently check: (a) whether an agent context file covers *foundations* (spacing/typography/color rules), not just a component index — an `agent.context-file-quality` sub-measure; (b) whether machine-readable metadata exists in structured form (JSON/manifest) vs prose-only — already partially covered by `agent.manifest-coverage`, but the token-cost argument gives it a receipt with numbers. For the behavioral tier, tokens-per-run tracking (already recommended in task-battery-research.md) gets independent support: format differences show up as cost even when coverage ties.

---

## 4. Failure modes and "AI debt"

Sil Bormüller's five failure modes ([intodesignsystems.com](https://www.intodesignsystems.com/blog/design-system-not-ready-for-ai-agents), 2026-04-10) — agents "parse your system, extract what the prompt asks for and fill every gap with assumptions from training data":

1. **Documentation drift** — docs/tokens/components conflict and agents can't tell which source is authoritative; DS teams spend "30–40% of team time" on maintenance (attributed to Romina Kavcic). *Direct receipt for `agent.context-file-quality`'s doc-rot measure and the staleness family generally.*
2. **Markdown without benchmarking** — see §3.
3. **No trust levels** — no policy for what agents may auto-merge vs draft vs suggest; GitHub Primer restricts agents to issue creation only. *Out of static-tier scope; governance signal.*
4. **MCP without always-on rules** — see §3.
5. **Monolithic component definitions** — see §3.

Starting advice: "plant seeds, not trees" — naming conventions, token structure, component descriptions first.

The DSC editorial arc adds the measurement framing ([#72](https://designsystemscollective.substack.com/p/your-system-looks-fine-thats-the), 2026-06-22):

- The invisible failure mode: "a component that passes every visual check, ships cleanly, and gets used by an agent that does not understand what it is for." Reframe: from "Is my system ready for AI?" to **"Would I know if it wasn't?"**
- **AI debt** categories: semantic, component, documentation, naming, and governance debt — accumulating "plausible but incorrect decisions at scale."
- "You cannot govern what you cannot measure, and most teams do not yet have instrumentation to measure how their system behaves when an agent is the consumer." **[inference]** That sentence is ds-bench's market thesis stated by the field's editor — quote it.
- Working validators exist for machine-scale regressions (missing focus states, raw colours): **agentic-spec** and **Clementine**, plus Spec Kit-style enforcement (CI checks, lint rules, codemods, bypass registries) making "the wrong thing harder than the right thing" ([#67](https://designsystemscollective.substack.com/p/your-system-cant-explain-itself-thats), [#72](https://designsystemscollective.substack.com/p/your-system-looks-fine-thats-the)). Not independently verified in this pass.

TJ's diagnostic metaphors for the same phenomenon: **"AI just turns the lights on"** — it reveals inconsistencies teams worked around manually; "most design systems look fine—but aren't," like "a car with the check engine light on" where problems surface "when you try to scale—or plug AI into it" ([DSC interview](https://www.designsystemscollective.com/ai-just-turns-the-lights-on-tj-pitre-on-design-systems-and-ai-d57b095e9a90); [Harkunou podcast](https://arseniharkunou.substack.com/p/ai-ready-design-systems-w-tj-pitre), 2026-04-08). Root causes named in the ergomania interview: inconsistent metadata, missing component documentation, "Frame 1234" instead of semantic labels, deadline-driven custom styling ([ergomania.eu](https://ergomania.eu/ai-ready-design-systems-tj-pitre/)).

---

## 5. Documentation-for-agents: declared vs designed

TJ's sharpest operational piece for ds-bench's docs category ([Designed vs. Declared](https://southleft.substack.com/p/designed-vs-declared-how-to-document), 2026-05-22):

- **Designed documentation** (visual frames, do/don't pairs, spatial layouts) forces agents "to reconstruct meaning from node trees, coordinates, and inferred relationships." **Declared documentation** (description fields, annotations, markdown in component metadata) is directly parseable — "the design system as an API rather than a visual artifact."
- Key line: **"Inferred meaning is where agents get expensive and unreliable. Declared meaning is cheap and correct."**
- Coupling argument: description fields survive renames/deletions with the component; visual doc frames drift as orphaned artifacts. Keep designed frames for humans, declared metadata for agents.
- Winning teams "won't have the prettiest frames — they'll have documentation agents never have to guess at."

Related: Daniel Klinke's naming argument — **component names function as instructions, not labels**; inconsistent naming makes agent component selection effectively random ([DSC, Architecture Not Documentation](https://designsystemscollective.substack.com/p/architecture-not-documentation), 2026-06-06). **[inference]** This is the receipt ds-bench's `api.name-coherence` check was missing a citation for.

Context-Based Design Systems (the umbrella concept) frames all of this as lifecycle continuity: "a CBDS encodes not just how something looks, but what it **means**, how it **behaves**, and when it should be used"; "each step makes the next one smarter"; upstream flaws — "bad naming, missing states, lack of intent" — cascade: "without validation, that infection spreads through every downstream artifact" ([southleft.com](https://southleft.com/insights/design-systems/context-based-design-systems-a-new-model-for-the-ai-driven-product-lifecycle/), 2025-07-04). Also proposes the **"context engineer"** role: "not prompt engineers, they're system stewards."

---

## 6. Implications for ds-bench

**Validations (no action needed, cite in essay):**

1. **Intrinsics-dominate is independently confirmed** from three directions: TJ ("the practices that make a design system AI-ready are the same ones that make it readable, period" — [Anatomy](https://southleft.substack.com/p/anatomy-of-an-ai-ready-design-system), paywalled, thesis visible in preview), Williams ("fundamentals of good systems work" — [#64](https://designsystemscollective.substack.com/p/legible-by-design-what-ai-readiness)), Harkunou/Pitre ("teams that benefit from AI… clear structure, clean systems" — [podcast](https://arseniharkunou.substack.com/p/ai-ready-design-systems-w-tj-pitre)).
2. **The violation taxonomy is confirmed at scale** by ds-contracts-poc's 91 violations (invented props, hard-coded colors, restyled components) and its ~31-point governed/ungoverned delta ([github.com](https://github.com/southleft/ds-contracts-poc)).
3. **The market gap is real**: every assessment instrument found is manual (Southleft scorecard, Trueman questionnaire) or measures codebase health rather than agent-readiness (DSAudit). Nothing automates agent-readiness scoring. DSAudit's npm absence also validates the PLAN.md bet that `npx ds-bench audit` distribution matters.

**Candidate new checks / check extensions:**

4. **`agent.foundations-always-on` (or a sub-measure of `agent.context-file-quality`)** — does the agent context file declare foundation rules (spacing scale, typography, color usage), not just a component index? Receipt: Wolosin's finding that foundations can't be fetched on demand; retrieval-only MCPs still produced typography/spacing/color drift ([intodesignsystems.com](https://www.intodesignsystems.com/blog/design-system-not-ready-for-ai-agents)).
5. **Structured-vs-prose metadata format check** — machine-readable component metadata in JSON/manifest form vs prose-only Markdown, receipted by the 80%-token-efficiency / 5×-cost numbers. Partially covered by `agent.manifest-coverage`; the format-cost receipt strengthens it. **[inference]** Could also inform severity: prose-only metadata is *present but expensive*, a quality (not presence) distinction.
6. **Component-description coverage in the design-source/manifest sense** — "declared" description fields per component (when-to-use content in metadata, not doc frames). Largely covered by `guidance.when-to-use` carriers; the declared-vs-designed argument justifies weighting metadata-carried guidance above heading-heuristic docs guidance. **[inference]**
7. **Doc-chunk granularity** — monolithic single-file component docs vs decomposed sections ("smaller context bubbles"). Probably too heuristic for v0; park as a field-prior question: do low-scoring systems have monolithic docs? **[inference]**
8. **Intent field presence** — Williams' "tokens need to carry purpose, not just values" suggests checking whether semantic/purpose-named tokens exist vs raw-value names only; adjacent to `tokens.naming-consistency` but measuring semantic layering. Park for v1. **[inference]**

**Framing/terminology worth adopting:**

9. "**Would I know if it wasn't?**" ([#72](https://designsystemscollective.substack.com/p/your-system-looks-fine-thats-the)) as the audit's motivating question; "you cannot govern what you cannot measure" as the market thesis; "**AI just turns the lights on**" as the diagnosis metaphor; "**machine-readable, not machine-governed**" to position ds-bench on the human-judgment side; "**declared vs inferred meaning**" for the docs category; "**AI debt**" (semantic/component/documentation/naming/governance) as a findings-classification vocabulary candidate.
10. **What not to adopt:** "agentic design systems" — TJ's critique (autonomous loops = "confident, unowned drift") argues the term conflates architecture with governance ([southleft.substack.com](https://southleft.substack.com/p/my-beef-with-agentic-design-systems)). ds-bench's existing "agent-readiness" term is the safer side of that line.

**Competitive watch-list:** ds-contracts-poc (active as of 2026-07-07; roadmap toward "vendor-neutral specification candidacy"), agentic-spec, Clementine, Storybook manifest ecosystem.

---

## Source reliability notes

- **Paywalled, partially recovered:** [Into Design Systems substack post](https://intodesignsystems.substack.com/p/ai-design-system-mcp-example) ("How Indeed Made Their Design System Machine-Readable for MCP and LLMs," guest post by Sil Bormüller, 2026-06-08) — preview only. Benchmark numbers reconstructed from the same author's free article ([intodesignsystems.com/blog/design-system-not-ready-for-ai-agents](https://www.intodesignsystems.com/blog/design-system-not-ready-for-ai-agents)) and search coverage; Wolosin's own DSC articles corroborate method but omit numbers. Wayback lookups were rate-limited (HTTP 429) at research time.
- **Paywalled, not recovered:** [Anatomy of an AI-Ready Design System](https://southleft.substack.com/p/anatomy-of-an-ai-ready-design-system) (2026-05-07) — only the thesis paragraph is free; the promised "hierarchy of practices" is behind the paywall.
- **Not recovered:** the six dimensions of Southleft's scorecard (HubSpot email gate; no article names them). Proxies noted in §2 are inference.
- **LinkedIn source:** the DSAudit post text was supplied verbatim by the user; the post URL was not fetched (LinkedIn blocks). Repo facts verified against the GitHub API directly (creation/push dates, commits, no npm package).
- **Secondary-coverage risk:** Indeed benchmark figures (30k tokens, 82% coverage, $300 vs $1,500, 4,300 prototypes) all trace to Bormüller's coverage of Wolosin's conference material, not a first-party methodology write-up. Treat as practitioner-reported, not audited.
- **Unverified in passing:** agentic-spec and Clementine (named in DSC #72 only); Spec Kit (George William Amalan, DSC #67); Spotify 220k shared-style-uses / 93% satisfaction figures (Bormüller article).
- **WebFetch summarization caveat:** several long articles were extracted via a summarizing fetch; verbatim quotes were preserved where the extraction marked them, but ellipses inside quotes may hide context.
