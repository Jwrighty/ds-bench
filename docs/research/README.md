# The research and methodology behind the rubric

DS Bench scores how clearly a design system explains itself to a coding agent. This page answers the two questions a reader is most likely to ask after meeting the tool:

1. **What does a design system need to do to be more usable by coding agents?**
2. **How did DS Bench arrive at those conclusions?**

It is a short bridge between the [main README](../../README.md), the detailed research notes in this folder, the [source index](resources.md), and the [audit check catalogue](../audit-checks.md). Follow those links when you want depth; this page is the overview.

## What makes a design system usable by an agent

An agent working in an unfamiliar design system has to get six things right, in roughly this order. DS Bench measures each one, and each maps to one of the six official audit categories.

| An agent can… | …because the repository has | Audit category |
| --- | --- | --- |
| **Discover** the system exists and how to reach it | agent context files, manifests, discovery indexes | Agent metadata |
| **Understand** what already exists | documented components and props, working examples | Docs & examples |
| **Choose** the right component | when-to-use guidance, alternatives, confusable-pair notes | Usage guidance |
| **Use** its API correctly | sound types, resolvable exports, coherent names and import paths | API clarity |
| **Apply** its tokens | machine-readable, consistently named tokens instead of hardcoded values | Token hygiene |
| **Avoid** deprecated patterns | clear deprecation marks, replacement guidance, legacy items kept out of discovery | Deprecation signalling |

The first five carry 90% of the score by design. Discovery metadata is packaging: a polished `AGENTS.md` or manifest cannot make up for unclear components, weak examples, or stale guidance. The full check catalogue lists every measure, fix, and receipt under each category — this page deliberately does not reproduce it.

## Where the conclusions come from

DS Bench is a transparent synthesis, not an unsupported opinion. The rubric draws on four kinds of evidence:

- **Published research** — frontend-generation benchmarks, hallucination studies, and the closest methodological precedents for measuring agents with and without a design-system surface.
- **Design-system vendor experiments** — first-party write-ups from teams such as Astryx, Atlassian, Storybook, and Indeed that document what agents get wrong and what fixed it.
- **Practitioner guidance** — the Southleft and Design Systems Collective corpus on machine-readability and "AI-ready" systems.
- **Documented agent failure modes** — the specific, repeatable ways agents break: invented props, wrong import paths, recreated components, hardcoded values, copied deprecations.

Every source is logged in the [source index](resources.md). The reading behind the categories is written up in three syntheses:

- [AI-ready design systems](ai-ready-design-systems-southleft.md) — the Southleft / Design Systems Collective corpus, and the "intrinsics dominate" thesis that fixes the category weights.
- [Task-battery research](task-battery-research.md) — existing benchmarks, documented vendor failure modes, and precedent for mechanical (non-AI) scoring.
- [agentic-spec / Clementine](agentic-spec-clementine.md) — a primary-source follow-up that also illustrates the limits of static analysis.

## How evidence becomes a check

Each scored check follows the same path, so you can trace any number in a report back to its origin:

**A source or an observed failure → a synthesized principle → a measurable repository signal.**

For example: Astryx publishes a wrong-import-path failure and Atlassian found agents recreate components they cannot see used (*sources*) → examples must import real exports, and every component needs at least one importable example (*principles*) → the `docs.example-imports-real` and `docs.usage-examples` checks measure exactly that against the checkout (*signals*). The rubric is versioned (currently **ARS v0.3**) so these mappings can be discussed and improved without silently changing the meaning of an existing score. The reasoning for why intrinsic understandability outweighs agent-specific tooling is recorded in the [scoring rationale](../adr/0003-intrinsics-dominate-signals-over-tools.md).

## What the score does and does not mean

The static audit measures **readiness signals** — repository patterns associated with common agent failures. It does **not** run an agent, and it cannot prove that any particular model or prompt will succeed. A high score is evidence that a repository is easier for an agent to understand; it is not a guarantee of correct output. There is a real blind spot worth naming: the audit reads declared and documented signals, so a system can pass a check on paper while its rendered behavior drifts — the [agentic-spec / Clementine](agentic-spec-clementine.md) notes work through a concrete instance of exactly this.

The evidence itself is held to the same standard. The syntheses distinguish sourced findings from DS Bench's own synthesis or inference — the latter are marked **[inference]** — and the source index keeps its quality flags for evidence that is secondary (`[secondary]`), paywalled (`[paywalled]`), unreachable (`[unreachable]`), or user-captured (`[user-captured]`). The corpus is real-world practitioner and vendor evidence plus published benchmarks; it is **not** peer-reviewed, and DS Bench's rubric has not been independently validated. It is offered as a transparent, versioned, repeatable reading of the available evidence — one you can inspect, disagree with, and improve.
