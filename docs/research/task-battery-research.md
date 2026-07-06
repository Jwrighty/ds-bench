# Task-battery research pass

**Status:** research complete, 2026-07-05. Bounded pass against primary sources for the five questions in the research brief. Feeds revisions to `docs/task-battery.md` (draft v0, 11 tasks).

Conventions: every claim carries its source URL. Statements marked **[inference]** are research synthesis, not something a source says. Unreachable sources are flagged as such.

---

## TL;DR

- **No existing benchmark measures what ds-bench measures.** Frontend-generation benchmarks score *task completion* or *visual quality* of from-scratch output (WebGen-Bench, FullFront, Design2Code, Design Arena, UI-Bench); none score *fidelity to a specific design system's API and tokens*, and none compare with/without an agent surface — except one: **Vercel's Next.js agent evals**, which publish success rates per agent with and without a bundled AGENTS.md, and are the closest methodological precedent for this project's core comparison ([nextjs.org/evals](https://nextjs.org/evals)).
- **The failure modes the battery targets are documented by DS vendors themselves**, not just hypothesized: Astryx publishes three self-check questions (import path, dialog config, prop name) with a claimed "0% pass rate without docs" ([astryx.atmeta.com](https://astryx.atmeta.com/docs/working-with-ai)); Atlassian's DESIGN.md experiment found agents "more likely to re-create components rather than use the existing system" ([atlassian.com](https://www.atlassian.com/blog/ai-at-work/atlassians-design-md-is-here-what-we-learned-testing-portable-design-context-in-practice)); Storybook describes agent output as "unmergable slop: wrong props, bogus states, and render errors" ([storybook.js.org](https://storybook.js.org/blog/storybook-mcp-sneak-peek)).
- **No direct study shows canonical tasks (login/todo) under-discriminate in UI agent evals** — that specific claim is unsupported by the reviewed literature. Adjacent evidence (Aider retiring its saturated benchmark, ~92% baseline success on canonical Next.js tasks) supports compressed headroom on *task completion*; Atlassian's login-screen test (~5% design-context coverage without context) shows canonical shapes still discriminate hard when scored on *system fidelity*. Implication: keep the settings form, score it on fidelity axes, never on "does it work."
- **Mechanical (non-LLM-judge) assertion has solid precedent**: unit-test gates (SWE-bench Multimodal), programmatic functional correctness (WebArena), rule-based metric suites including lint/console/Lighthouse-axe (WebCoderBench), automatic visual metrics (Design2Code), and — closest to the planned penalty-table — **A11YN's severity-weighted penalty mapping over axe-core violations** used as an RL reward. CSS-variable-resolution checks as a scoring gate appear to be novel.
- **Battery verdict:** the 11-task draft holds up well. Recommend 2 modifications, 2 additions (one task, one harness stage), 0 drops. Details in the final section.

---

## Q1 — Existing agentic frontend/UI-generation benchmarks

### WebGen-Bench (arXiv 2505.03733)

- **What:** 101 website-generation instructions / 647 test cases; agents build "multi-file website codebases from scratch." Instructions created "through the combined efforts of human annotators and GPT-4o," spanning 3 major / 13 minor web-app categories. Source: [arxiv.org/abs/2505.03733](https://arxiv.org/abs/2505.03733).
- **Task selection:** sampled 2–8 representative examples per category from 10,152 project descriptions; instructions reorganized into three technical categories (Content Presentation, User Interaction, Data Management). Source: [arxiv.org/html/2505.03733v1](https://arxiv.org/html/2505.03733v1).
- **Granularity:** whole app per task — much coarser than ds-bench's one-page/one-component tasks.
- **Assertion:** GPT-4o-drafted, human-filtered test cases ("operation + expected result") are *executed by a UI agent* (WebVoyager running Qwen2.5-VL-32B-Instruct, ≤15 interactions) yielding YES/PARTIAL/NO; weighted accuracy = (N_Yes + 0.5·N_Partial)/N_Total. Separate appearance grading by GPT-4o on a 1–5 scale (rendering, relevance, layout harmony, modernness). Source: [arxiv.org/html/2505.03733v1](https://arxiv.org/html/2505.03733v1). **[inference]** Both channels are LLM-mediated — WebGen-Bench is a precedent for *task design*, not for mechanical scoring.
- **Headroom:** best framework/model combo (Bolt.diy + DeepSeek-R1) scores 27.8%. Source: [arxiv.org/abs/2505.03733](https://arxiv.org/abs/2505.03733).

### Design Arena

- **What:** crowdsourced pairwise-preference leaderboard for AI-generated design. Users submit a prompt and category; four anonymized models generate; users vote in a five-battle bracket; rankings via Bradley-Terry with equal-weighted votes and "no editorial filtering." Source: [designarena.ai/about](https://www.designarena.ai/about).
- **Task selection:** user-submitted prompts, category-tagged (websites, UI components, games, etc.). The dedicated methodology page ([notes.designarena.ai/methodology](https://notes.designarena.ai/methodology/)) returned **HTTP 403 — unreachable**; details above are from the /about page only. Secondary search snippets add Bradley-Terry convergence details, but those details could not be verified first-party.
- **[inference]** Pure subjective-preference measurement; asserts nothing about correctness, reuse, or tokens. Relevant to ds-bench only as the anti-model: it demonstrates why a mechanical fidelity score is a gap in the landscape.

### SWE-bench Multimodal (arXiv 2410.03859)

- **What:** 617 task instances from 17 JavaScript libraries (web interface design, diagramming, data viz, syntax highlighting, interactive mapping); each instance's problem statement or tests contain at least one image. Source: [arxiv.org/abs/2410.03859](https://arxiv.org/abs/2410.03859).
- **Task selection:** real GitHub issues, filtered for visual content — i.e., mined, not authored.
- **Assertion:** unit tests, same as original SWE-bench.
- **Findings:** systems that top SWE-bench "struggle with SWE-bench M" (best: SWE-agent at 12%), attributed to visual-reasoning demands and poor generalization beyond Python. Source: [arxiv.org/abs/2410.03859](https://arxiv.org/abs/2410.03859).
- **[inference]** Precedent for test-gated UI-adjacent scoring and for "JS frontend is where agents are weakest" — supports ds-bench's premise that frontend agent output needs its own instrument.

### FullFront (arXiv 2505.17399)

- **What:** MLLM benchmark across Webpage Design, Perception QA, and Code Generation. Notably critiques existing benchmarks for using "either scraped websites with bloated code or oversimplified LLM-generated HTML," and builds a two-stage pipeline converting real pages to clean standardized HTML. Sources: [arxiv.org/abs/2505.17399](https://arxiv.org/abs/2505.17399), [huggingface.co/papers/2505.17399](https://huggingface.co/papers/2505.17399).
- **Findings:** "significant limitations in page perception, code generation (particularly for image handling and layout), and interaction implementation"; substantial human-expert gap. Source: [arxiv.org/abs/2505.17399](https://arxiv.org/abs/2505.17399).
- Scoring details are not in the abstract; metric internals were not verified.

### WebArena / VisualWebArena — marginal relevance

- WebArena evaluates agents *operating* existing websites (e-commerce, forums, CMS...), asserting "functional correctness of task completions" programmatically; best GPT-4 agent 14.41% vs human 78.24%. Source: [arxiv.org/abs/2307.13854](https://arxiv.org/abs/2307.13854). VisualWebArena extends this to visually-grounded tasks for multimodal agents. Source: [arxiv.org/abs/2401.13649](https://arxiv.org/abs/2401.13649).
- **[inference]** Different capability (browsing/operating, not generating code); relevant to ds-bench only as the origin of programmatic functional-correctness reward functions.

### Vercel v0 evals + Next.js agent evals — the closest precedent

- v0 is built on eval-driven development with three grading tiers: code-based ("objective criteria and fast feedback"), human, and LLM-based. Automated code checks include "validating code blocks," "ensuring correct imports," "confirming multi-file usage," and comment/code balance. Failing prompts are continuously added to the eval set. Source: [vercel.com/blog/eval-driven-development-build-better-ai-faster](https://vercel.com/blog/eval-driven-development-build-better-ai-faster).
- Their primary model metric is **error-free generation rate** on "evaluation sets [designed] from common web development tasks" (published rates roughly 59–94% per model); they trained a dedicated AutoFix model evaluated on error-incidence evals. Source: [vercel.com/blog/v0-composite-model-family](https://vercel.com/blog/v0-composite-model-family).
- **Next.js agent evals** publish per-agent success rates on Next.js generation and migration tasks under two conditions — baseline vs **with a bundled AGENTS.md** — e.g. top agents ~92% baseline rising to 96–100% with docs. Source: [nextjs.org/evals](https://nextjs.org/evals).
- **[inference]** This is the same experimental shape as ds-bench's with/without-agent-surface conditions, applied to a framework instead of a design system, and it confirms two things: (a) the condition design is legible to the industry; (b) on canonical framework tasks the baseline is already ~92%, so the discriminating signal must come from fidelity scoring, not pass/fail.

### Others found in passing (not fully reviewed)

- **Design2Code** — see Q5. [arxiv.org/abs/2403.03163](https://arxiv.org/abs/2403.03163)
- **WebCoderBench** — see Q5. [arxiv.org/html/2601.02430v2](https://arxiv.org/html/2601.02430v2)
- **UI-Bench** — 30 prompts × 10 text-to-app tools, 300 sites, 4,000+ expert pairwise judgments ranked with a TrueSkill-derived model. [arxiv.org/pdf/2508.20410](https://arxiv.org/pdf/2508.20410)
- Name-only search hits, not reviewed: ArtifactsBench ([arxiv.org/html/2507.04952v2](https://arxiv.org/html/2507.04952v2)), 1D-Bench, Cookie-Bench, LongWebBench.

---

## Q2 — Design-system vendor evals

### Astryx "Working with AI" (Meta)

Source: [astryx.atmeta.com/docs/working-with-ai](https://astryx.atmeta.com/docs/working-with-ai).

- **Self-check questions** (per the page, to test AI knowledge before coding):
  1. "What is the correct import path for Button?"
  2. "How do you make an Dialog non-dismissible?"
  3. "What prop does Selector use for its items?"
  The page claims these have a **"0% pass rate without docs; models confidently guess wrong on all of them."**
- Agent surface: `npx astryx init --features agents` generates context files (component index, behavioral rules, CLI reference) with per-agent output (`--agent claude` → CLAUDE.md, `--agent cursor` → .cursorrules, `--agent codex` → AGENTS.md); a documented three-step workflow (`template --list` → `template <name> --skeleton` → `component <Name>`); `--dense` token-efficient CLI output; MCP server at `https://astryx.atmeta.com/mcp` with `search(query)` and `get(name)` tools.
- **[inference]** The three questions are exactly ds-bench's hallucination axes (import path, behavior-config prop, collection prop) — vendor-confirmed weak points, usable directly as probe material.

### Atlassian DESIGN.md experiment

Source: [atlassian.com/blog/ai-at-work/atlassians-design-md-is-here-...](https://www.atlassian.com/blog/ai-at-work/atlassians-design-md-is-here-what-we-learned-testing-portable-design-context-in-practice).

- DESIGN.md is Google's open Markdown format from Stitch: machine-readable token listing plus human/agent-readable design rationale. Atlassian generated theirs (80 KB / ~19,800 tokens) and tested **one primary task — generating a user login screen** — under four conditions: no design context, ADS MCP, ADS skill, DESIGN.md.
- **Metrics:** design-context coverage, token consumption, time, interaction turns. Results as published:

  | Condition | Context coverage | Tokens | Time | Turns |
  |---|---|---|---|---|
  | No context | ~5% | 4.20M | 6m19s | 43 |
  | ADS MCP | ~80% | 3.75M | 5m01s | 35.1 |
  | ADS skill | ~80% | 4.43M | 5m23s | 36 |
  | DESIGN.md | ~30% | 7.21M | 6m46s | 45.3 |

  DESIGN.md used "~92% more tokens" than ADS MCP with "~2.7x the variance in token consumption between runs."
- **Failure modes observed:** monolithic context ("loads everything, every time"); compression losses forcing agents to "read through component implementations to find usage guidance absent from the spec"; and the headline finding — DESIGN.md "was more likely to re-create components rather than use the existing system," being "a guide on how to re-implement" rather than "an instruction manual to using the existing design system."
- **Conclusion:** "a useful portability format as a snapshot of your design system, not a replacement for richer design system tooling."
- **[inference]** This is the only published DS-vendor experiment with a controlled condition grid, and it validates ds-bench's "condition = delivery mechanism" framing (CONTEXT.md): two ~80%-coverage mechanisms differed measurably in tokens/turns, and a *worse-shaped* artifact (DESIGN.md) actively induced the recreation failure mode. Note its scoring (context coverage) appears human-assessed and it ran a single task — ds-bench's mechanical multi-task battery is a strict methodological step up.

### Storybook MCP / Component Manifest

- **Blog** ([storybook.js.org/blog/storybook-mcp-sneak-peek](https://storybook.js.org/blog/storybook-mcp-sneak-peek/)): agent-generated component code is "unmergable slop: wrong props, bogus states, and render errors"; agents "guess at patterns"; pointing an agent "at `/components` or `node_modules`" gives it the same discovery problem a human has; "agent workflows break when there's no feedback loop." Claims "Benchmarks show this generates better quality code faster with fewer tokens" — **no numbers or methodology published**. Two capabilities: reuse via optimized metadata payloads; self-healing via running component interaction and accessibility tests.
- **Manifest docs** ([storybook.js.org/docs/ai/manifests](https://storybook.js.org/docs/ai/manifests)): component manifest is JSON "generated from static analysis of the CSF files... and prop type extraction from... component source code" — names, descriptions, props (types/defaults), usage snippets, import statements, JSDoc metadata, subcomponents; served at `/manifests/components.json`; `react-docgen-typescript` recommended for accuracy.
- **Best practices** ([storybook.js.org/docs/ai/best-practices](https://storybook.js.org/docs/ai/best-practices)): stories should "demonstrate one concept or use case"; irrelevant manifest content "may be overwhelming for the agent and lead to worse performance"; **exclude anti-patterns and deprecated components with the `!manifest` tag**; inline details in MDX rather than referencing external sources.
- **[inference]** The `!manifest` deprecation-exclusion mechanism is first-party evidence that vendors treat deprecated-surface steering as a real agent problem — direct support for keeping the deprecation-trap task, gated on real deprecated surface.

### Shopify Polaris

- [shopify.dev/docs/api/polaris/using-mcp](https://shopify.dev/docs/api/polaris/using-mcp) documents using the Shopify dev MCP server with Polaris web components in LLM-enabled environments (Cursor, Copilot, Claude Code). It is a setup guide; **no evals, self-checks, or measurements are published there**.
- (Search results also surfaced Shopify's storefront-side `llms.txt`/`agents.md` rollout, but that is agentic *commerce*, not design-system agent-readiness — out of scope.)

### IBM Carbon

Source: [carbondesignsystem.com/developing/carbon-mcp/overview/](https://carbondesignsystem.com/developing/carbon-mcp/overview/) (page fetched raw; content current as of 2026-07-03).

- **Carbon MCP (public preview)** exposes four tools: `docs_search` (guidance, usage, accessibility docs), `code_search` (React/Web Components examples, icons, pictograms), `get_charts`, `labs_search`. Coverage spans `@carbon/react`, `@carbon/web-components`, Carbon for IBM Products, icons/pictograms, `@carbon/ai-chat`, `@carbon/charts`, Carbon Labs — "complete props and imports" per component.
- Stated motivation: "high-fidelity Carbon UI code that follows design and development best practices," consistent answers from "a shared source of truth, which reduces drift and rework." Roadmap includes "Agentic Carbon migration, supporting migrations from Carbon v10 to v11 and from other design systems to Carbon."
- **No published evals or measurements.**
- **[inference]** The v10→v11 migration roadmap item is independent confirmation that brownfield-system (Axis 1) concerns are on vendors' minds.

### GitHub Primer

- No **first-party Primer publication on agent evals or an agent surface for the design system** was found. GitHub's relevant material is Copilot-generic (e.g. agents.md guidance: [github.blog — How to write a great agents.md](https://github.blog/ai-and-ml/github-copilot/how-to-write-a-great-agents-md-lessons-from-over-2500-repositories/)). Recording this as an absence, not a finding.

---

## Q3 — Documented agent failure modes with component libraries

What's actually documented, per failure mode, and which task shapes elicit it:

1. **Invented props / wrong prop names.** Documented: Storybook — "wrong props, bogus states, and render errors" ([blog](https://storybook.js.org/blog/storybook-mcp-sneak-peek/)); Astryx — "What prop does Selector use for its items?" with claimed 0% undocumented pass rate ([docs](https://astryx.atmeta.com/docs/working-with-ai)). Academic backing: code-hallucination taxonomies classify "naming" and "mapping" hallucinations, measured by execution — CodeHalu, 8,883 samples ([arxiv.org/abs/2405.00253](https://arxiv.org/abs/2405.00253)); APIHulBench measures per-API hallucination rates in repo context ([arxiv.org/pdf/2505.05057](https://arxiv.org/pdf/2505.05057)); taxonomy survey ([arxiv.org/pdf/2504.20799](https://arxiv.org/pdf/2504.20799)). **[inference]** Eliciting shape: components whose real API *diverges from the ecosystem-average API* — e.g. a presentational Table where training-data gravity says `onSort` exists (task 3), and collection components (Select/items) where prop naming varies across libraries (tasks 1, 7).
2. **Wrong import paths.** Documented: Astryx self-check Q1 ([docs](https://astryx.atmeta.com/docs/working-with-ai)). Adjacent hard evidence at the package level: 5.2% (commercial) / 21.7% (open-source) of generated package references are hallucinated; 205,474 unique hallucinated names; 38% conflations / 13% typo variants / 51% fabrications — Spracklen et al., USENIX Security 2025 ([arxiv.org/abs/2406.10279](https://arxiv.org/abs/2406.10279), [usenix.org](https://www.usenix.org/conference/usenixsecurity25/presentation/spracklen)). **[inference]** Conflation (38%) is the DS-relevant mechanism — agents blend the target system with MUI/Chakra/Radix paths. Every task elicits this; the scorer just needs to count it everywhere.
3. **Recreating components instead of importing (raw-div fallback).** Documented: Atlassian — DESIGN.md condition "was more likely to re-create components rather than use the existing system" ([atlassian.com](https://www.atlassian.com/blog/ai-at-work/atlassians-design-md-is-here-what-we-learned-testing-portable-design-context-in-practice)); Storybook frames its whole MCP around reuse of existing patterns ([blog](https://storybook.js.org/blog/storybook-mcp-sneak-peek/)). **[inference]** Elicited when the correct component exists but is *not named in the ticket* and assembly is multi-part — filter panel (task 7), card grid/layout primitives (task 4). Atlassian's data adds a sharper trigger: recreation spikes when the provided context *describes* the system instead of *indexing* it.
4. **Hardcoded magic values / fabricated tokens.** No direct published measurement found. Nearest: Atlassian had to cut tokens/guidance for portability, forcing agents into component source ([atlassian.com](https://www.atlassian.com/blog/ai-at-work/atlassians-design-md-is-here-what-we-learned-testing-portable-design-context-in-practice)); Carbon MCP's "reduces drift" motivation ([carbondesignsystem.com](https://carbondesignsystem.com/developing/carbon-mcp/overview/)). **[inference]** Tasks 4, 5, 10 target this on plausible reasoning but thinner published evidence than modes 1–3 — which is an argument these tasks add *new* measurement, not redundant confirmation.
5. **Deprecated-pattern usage.** Documented as a vendor concern, not as a measured rate: Storybook's `!manifest` tag exists specifically to exclude "anti-patterns and deprecated components" from agent context ([docs](https://storybook.js.org/docs/ai/best-practices)); Carbon's roadmap includes agentic v10→v11 migration ([carbondesignsystem.com](https://carbondesignsystem.com/developing/carbon-mcp/overview/)). No published study elicits it deliberately. **[inference]** Based on reviewed sources, ds-bench's deprecation trap (task 9) would be the first published deliberate elicitation.
6. **Behavior-configuration errors (imperative APIs, providers, non-obvious config).** Documented: Astryx self-check Q2 ("How do you make an Dialog non-dismissible?") ([docs](https://astryx.atmeta.com/docs/working-with-ai)); Storybook's "bogus states." **[inference]** Toast/provider wiring (task 6) and dialog variants (task 2) are the right shapes.

---

## Q4 — Training-data saturation of canonical tasks

**Direct answer: no, there is no published study showing that login-form/todo-list/settings-page tasks specifically under-discriminate in agent evals.** The claim as stated is folklore. What primary sources do support:

- **General benchmark saturation is real and studied.** Aider retired its 133-exercise Python benchmark because scores "approached and then surpassed 80%" and champions advanced "by solving just 1-2 more problems"; the replacement polyglot benchmark keeps only the 225 exercises "solved by 3 or fewer models" ([aider.chat/2024/12/21/polyglot.html](https://aider.chat/2024/12/21/polyglot.html)). A systematic study formalizes saturation as loss of discriminative power near ceiling ([arxiv.org/html/2602.16763v1](https://arxiv.org/html/2602.16763v1)); contamination-vs-saturation surveys: [arxiv.org/html/2406.04244v1](https://arxiv.org/html/2406.04244v1).
- **Canonical frontend-framework tasks sit near ceiling on completion metrics.** Next.js agent evals: top agents ~92% baseline, 96–100% with AGENTS.md ([nextjs.org/evals](https://nextjs.org/evals)). Vercel's error-free-generation rates on "common web development tasks" run up to ~94% for top models ([vercel.com/blog/v0-composite-model-family](https://vercel.com/blog/v0-composite-model-family)). FullFront explicitly criticizes benchmarks built on "oversimplified LLM-generated HTML" ([arxiv.org/abs/2505.17399](https://arxiv.org/abs/2505.17399)).
- **The strongest counterpoint comes from Atlassian:** they deliberately chose the most canonical task there is — a login screen — and the no-context condition still scored only ~5% *design-context coverage* ([atlassian.com](https://www.atlassian.com/blog/ai-at-work/atlassians-design-md-is-here-what-we-learned-testing-portable-design-context-in-practice)). The agent can always *produce a login form*; it cannot produce *this system's* login form without the surface.
- **[inference] Synthesis for ds-bench:** saturation lives on the "does it run/complete" axis, not the "is it faithful to this system" axis. Canonical task shapes are fine — arguably good, since they maximize training-data gravity and therefore maximize the with/without-surface delta — *provided* scoring is entirely fidelity-based (component reuse, token adherence, hallucination count) and the render/typecheck gate is treated as a floor, not a score. A canonical task scored on completion would indeed be a wasted slot.

---

## Q5 — Mechanical success assertion (no LLM judges)

Precedents for each planned mechanism:

- **Compile/typecheck & render gates:** Vercel's primary v0 metric is error-free generation ([vercel.com/blog/v0-composite-model-family](https://vercel.com/blog/v0-composite-model-family)), with code-based checks for valid code blocks, correct imports, and multi-file usage ([vercel.com/blog/eval-driven-development-build-better-ai-faster](https://vercel.com/blog/eval-driven-development-build-better-ai-faster)). WebCoderBench runs syntax linting and counts runtime console errors among 11 rule-based metrics ([arxiv.org/html/2601.02430v2](https://arxiv.org/html/2601.02430v2)).
- **Test-gated assertion:** SWE-bench Multimodal resolves instances via unit tests ([arxiv.org/abs/2410.03859](https://arxiv.org/abs/2410.03859)); WebArena uses programmatic functional-correctness evaluation ([arxiv.org/abs/2307.13854](https://arxiv.org/abs/2307.13854)); Storybook MCP's self-heal loop runs existing interaction + accessibility tests as the agent's feedback signal ([storybook.js.org/blog/storybook-mcp-sneak-peek](https://storybook.js.org/blog/storybook-mcp-sneak-peek/)).
- **Screenshot/visual diffing:** Design2Code's five automatic metrics — block match, text similarity (Sørensen-Dice), position alignment, CIEDE2000 color consistency, CLIP similarity — validated against human rankings ([arxiv.org/abs/2403.03163](https://arxiv.org/abs/2403.03163)). **[inference]** These require a reference image; ds-bench has no golden screenshot per system, so visual diffing fits poorly except possibly for the theming task (before/after token flip).
- **Accessibility via axe:** A11YN evaluates web-UI generation with axe-core on RealUIReq-300 and — the key precedent — **maps violations to severity-weighted penalties converted into bounded rewards** for GRPO training ([arxiv.org/html/2510.13914v1](https://arxiv.org/html/2510.13914v1)). WebCoderBench audits WCAG compliance via Lighthouse ([arxiv.org/html/2601.02430v2](https://arxiv.org/html/2601.02430v2)). Caveat from adjacent work: optimizing axe scores alone can yield "syntactically compliant but semantically empty" attributes ([dl.acm.org/doi/10.1145/3772363.3799364](https://dl.acm.org/doi/10.1145/3772363.3799364)) — so task 11's scorer should assert accessible-*name content* (matches the ticket's label text), not mere attribute presence.
- **Fixed penalty-table precedent:** A11YN's severity-weighted penalty table is the closest published analogue; WebGen-Bench's YES/PARTIAL/NO weighted accuracy is a fixed credit table at task level ([arxiv.org/html/2505.03733v1](https://arxiv.org/html/2505.03733v1)). No reviewed benchmark publishes a full deduction schedule over AST-level findings (hallucinated prop = −x, raw hex = −y). **[inference]** ds-bench's penalty table is novel in application but well-precedented in spirit; publish the table itself for legitimacy, as A11YN does with its severity weights.
- **CSS-variable-resolution checks:** no precedent found anywhere. **[inference]** Genuinely novel scorer surface; worth a short methods note in the essay since nothing exists to cite.
- **Cautionary contrast:** WebGen-Bench, the closest benchmark by task type, is *not* mechanical — a VLM UI agent decides pass/fail and GPT-4o grades appearance ([arxiv.org/html/2505.03733v1](https://arxiv.org/html/2505.03733v1)). WebCoderBench is honest that only 11 of its 24 metrics avoid LLM judges ([arxiv.org/html/2601.02430v2](https://arxiv.org/html/2601.02430v2)). ds-bench's all-mechanical stance is a real differentiator, bought by restricting task scope (fixed output path, no data fetching/routing) — the draft battery already pays that cost correctly.

---

## Recommendations against the 11-task draft battery

**Keep (unchanged): 2, 3, 6, 7, 9, 10, 11.**

| Task | Verdict | Rationale (one line each) |
|---|---|---|
| 1. Settings form | **Modify** | Keep the canonical shape (maximizes training-data gravity → maximizes surface delta per Atlassian's login test), but spec must score *zero* points for mere completion — Next.js evals show ~92% baseline completion on canonical tasks ([nextjs.org/evals](https://nextjs.org/evals), [atlassian.com](https://www.atlassian.com/blog/ai-at-work/atlassians-design-md-is-here-what-we-learned-testing-portable-design-context-in-practice)). |
| 2. Confirm dialog | Keep | Astryx's own self-check targets Dialog behavior config ("non-dismissible") — vendor-identified undocumented-failure zone ([astryx.atmeta.com](https://astryx.atmeta.com/docs/working-with-ai)). |
| 3. Data table (presentational) | Keep | Strongest hallucination elicitor: matches the naming/mapping hallucination taxonomy and ecosystem-API divergence trigger ([arxiv.org/abs/2405.00253](https://arxiv.org/abs/2405.00253)). |
| 4. Stats dashboard | Keep | Targets the magic-value mode that no published benchmark measures — new signal, not redundant confirmation (gap established in Q3.4). |
| 5. Theme override | **Modify** | Keep, and note it's the one task where a mechanical before/after visual check is feasible (CIEDE2000-style color comparison across token flip, per Design2Code's metric precedent, [arxiv.org/abs/2403.03163](https://arxiv.org/abs/2403.03163)) — consider it as a secondary assertion alongside CSS-variable resolution. |
| 6. Toast | Keep | Imperative/provider APIs are Astryx-flagged ("bogus states" per Storybook) hallucination territory ([storybook.js.org](https://storybook.js.org/blog/storybook-mcp-sneak-peek/)). |
| 7. Filter panel | Keep | Directly instruments Atlassian's recreation-over-reuse finding via multi-part assembly with unnamed components ([atlassian.com](https://www.atlassian.com/blog/ai-at-work/atlassians-design-md-is-here-what-we-learned-testing-portable-design-context-in-practice)). |
| 8. Tabs shell | Keep, lowest priority | Weakest documented backing of the 11; acceptable as structural-props coverage, but first candidate to cut if the matched subset needs trimming. **[inference]** |
| 9. Deprecation trap | Keep | First-party mechanisms (`!manifest` exclusion, Carbon migration roadmap) prove vendors treat this as real; no one has published a deliberate elicitation — highest-novelty task ([storybook.js.org](https://storybook.js.org/docs/ai/best-practices), [carbondesignsystem.com](https://carbondesignsystem.com/developing/carbon-mcp/overview/)). |
| 10. Token-only pricing card | Keep | The "no component exists" cell of the reuse/recreate matrix; complements 7 (component exists, unnamed). |
| 11. Icon action bar | **Modify** | Keep, but per the semantic-emptiness caveat, assert accessible-name *content* (label text matches spec), not attribute presence ([dl.acm.org/doi/10.1145/3772363.3799364](https://dl.acm.org/doi/10.1145/3772363.3799364), axe precedent [arxiv.org/html/2510.13914v1](https://arxiv.org/html/2510.13914v1)). |

**Add — task 12: Name-mismatch reuse probe.** A ticket describing a need the system serves under a non-obvious name (e.g. ticket says "banner"/"callout", system exports `InlineMessage`; per-system binding picks the mismatch). Isolates discovery-driven recreation — Atlassian's top failure mode — from assembly-driven recreation (task 7), and is the task family the Storybook manifest/search tools exist to fix, so it should show the largest MCP-condition delta. Scored by the existing AST reuse check; no new scorer needed. **[inference from Q3.3]**

**Add — harness stage, not a task: Astryx-style pre-flight probes.** Before each run, ask the agent the three Astryx-shape questions (Button import path; a behavior-config question; a collection-prop question) bound to the target system, and record answers per condition. Cheap, mechanical to grade (string-match against manifest), replicates the only vendor-published "0% without docs" claim across systems, and gives the essay a memorable headline number independent of full task runs ([astryx.atmeta.com](https://astryx.atmeta.com/docs/working-with-ai)). **[inference]**

**Drop: nothing.** No task in the draft is contradicted by a source; overlap is intentional (1 vs 7 vs 10 triangulate the reuse axis from different cells).

**Cross-cutting spec revisions:**

1. Adopt a **PARTIAL credit tier** per assertion (WebGen-Bench's weighted YES/PARTIAL/NO precedent) rather than all-or-nothing per task — preserves discrimination when a gate half-fails ([arxiv.org/html/2505.03733v1](https://arxiv.org/html/2505.03733v1)).
2. **Publish the penalty table itself** as part of the methodology (A11YN publishes its severity weights; that's the legitimacy pattern) ([arxiv.org/html/2510.13914v1](https://arxiv.org/html/2510.13914v1)).
3. Track **tokens and turns per run** alongside scores — Atlassian's grid shows efficiency separates conditions even when quality ties (~80% vs ~80% coverage, but 3.75M vs 4.43M tokens) ([atlassian.com](https://www.atlassian.com/blog/ai-at-work/atlassians-design-md-is-here-what-we-learned-testing-portable-design-context-in-practice)).
4. Report the **failing-prompt feedback loop**: fold prompts that expose new failure modes back into the library across phases, per Vercel's eval practice ([vercel.com/blog/eval-driven-development-build-better-ai-faster](https://vercel.com/blog/eval-driven-development-build-better-ai-faster)).

---

## Source reliability notes

- **Unreachable:** Design Arena's methodology page ([notes.designarena.ai/methodology](https://notes.designarena.ai/methodology/), HTTP 403) — Design Arena claims above rest on the /about page only. No LinkedIn sources were needed or used.
- **Vendor claims taken at face value but unverifiable:** Astryx's "0% pass rate without docs" (no methodology published); Storybook's "Benchmarks show... better quality code faster with fewer tokens" (no numbers or method published).
- **Abstract-only reviews:** FullFront, UI-Bench, VisualWebArena, and the hallucination-taxonomy papers were verified at abstract level, not full-text.
- **Absences reported as absences:** no first-party GitHub Primer agent-eval material found; no published Polaris or Carbon eval numbers found; no direct study of canonical-task saturation in UI evals found.
