# DS Bench

**See how clearly your design system explains itself to coding agents — in one command, with no AI involved.**

![DS Bench terminal report](https://raw.githubusercontent.com/Jwrighty/ds-bench/main/docs/assets/readme-report.svg)

Coding agents struggle with design systems in predictable ways. They invent props, guess import paths, rebuild components that already exist, hardcode values instead of using tokens, and copy deprecated patterns.

Often, the problem is not the agent or the prompt. It is information that is missing, unclear, inconsistent, or stale in the repository itself. DS Bench checks for those gaps.

`ds-bench audit` scans a local design-system checkout and gives you:

- an **Agent-Readiness Score** from 0–100;
- scores across six categories, so you can see where the gaps are;
- severity-ranked findings with the affected files, components, or values;
- a suggested fix and the agent failure each check is intended to prevent.

The result is a practical to-do list you can work through, re-run, and compare over time.

The audit is a static CLI tool. It is deterministic, makes no AI or network calls, and keeps your code on your machine.

## Try it

Requires Node.js 22 or newer.

```sh
npx ds-bench audit <path>
```

To audit the current repository:

```sh
npx ds-bench audit .
```

Most audits finish in a few seconds. Nothing needs to be installed globally and no credentials are required.

## What the report tells you

The headline score is a quick way to track progress. The useful part is the explanation beneath it:

- **Category scores** show whether the main opportunity is documentation, API clarity, usage guidance, tokens, deprecations, or agent-facing metadata.
- **Findings** identify the specific gap and rank it as critical, warning, or informational.
- **Evidence** names the components, exports, imports, files, or values involved.
- **Fixes** suggest a concrete next action.
- **Receipts** connect each check to a documented failure mode, so you can understand and explain why the work matters.

Run the default report for the most important findings, `--verbose` for all evidence and receipts, or `--json` when you want another tool to process the result.

```sh
npx ds-bench audit . --verbose
npx ds-bench audit . --json > audit-report.json
```

## What it measures

DS Bench measures whether the information a coding agent needs is present, consistent, and usable in the repository.

| Category | What DS Bench looks for | Default weight |
| --- | --- | ---: |
| Docs & examples | Documented components and props, usable examples, and imports that still work | 25% |
| API clarity | Sound types, working exports, consistent names, and predictable import paths | 20% |
| Usage guidance | Help choosing the right component, including alternatives and commonly confused components | 15% |
| Token hygiene | Machine-readable tokens, consistent naming, and limited hardcoded design values | 15% |
| Deprecation signalling | Clear deprecation marks, replacement guidance, and legacy components kept out of discovery surfaces | 15% |
| Agent metadata | Accurate agent instructions, component manifests, discovery files, and other delivery mechanisms | 10% |

The first five categories carry 90% of the score by design. A polished `AGENTS.md`, manifest, or MCP server cannot compensate for unclear components, weak examples, or stale guidance.

DS Bench looks for the **signal**, not a preferred tool. For example, useful component guidance can live in several supported documentation formats; you are not required to use Storybook just to satisfy the rubric.

## What DS Bench is not

- **Not an AI tool.** The audit makes no model calls. The same checkout and rubric produce the same result.
- **Not a test of agent behavior.** It checks static signals associated with common agent failures; it does not ask an agent to complete tasks or prove that a particular model will succeed.
- **Not a general code-quality or accessibility audit.** It measures the information agents need to use a design system correctly, not the overall health of the system.
- **Not a fixer.** There is no `--fix`. The report tells you what to change and why, while you keep control of the implementation.
- **Not a leaderboard.** Example reports help calibrate and explain the rubric, not rank or shame teams.
- **Not a remote scanner.** It does not crawl documentation sites, fetch URLs, or inspect anything outside the local checkout you give it.

A high score is evidence that a repository is easier for agents to understand. It is not a guarantee that every agent, prompt, or generated interface will be correct.

## Turn a report into improvements

You can work from the terminal report yourself or use the JSON report as structured context for a coding agent.

1. **Save a baseline.** Run the audit with `--json` before changing anything.
2. **Choose a useful slice.** Start with critical findings or the weakest category. Treat large remediations as planned work rather than one giant fix.
3. **Review the evidence.** Confirm that the named files and components reflect how your system is meant to work.
4. **Make a plan.** Ask an agent to propose a phased plan when the changes span many components, public APIs, or documentation surfaces.
5. **Make and review the changes.** The report supplies direction, but your team still owns product and design-system decisions.
6. **Re-run the audit.** Compare the new report with the baseline and keep iterating.

A useful planning prompt is:

```text
Read this DS Bench JSON report and inspect the repository.

Propose a prioritized improvement plan. Group related findings, verify the
evidence before recommending a change, and distinguish quick fixes from work
that needs a design-system decision. Do not make changes yet.
```

When you are ready to implement, give the agent one approved group of findings at a time. Then re-run DS Bench to check the result:

```sh
npx ds-bench audit . --json > before.json
# make and review changes
npx ds-bench audit . --json > after.json
```

Only compare composite scores directly when `rubricVersion` and `registryFingerprint` match in both reports. Otherwise, compare the category and finding details instead.

## Why it exists

DS Bench grew out of building [Cedar UI](https://github.com/Jwrighty/cedar-ui) with agent-readiness as an explicit goal.

Guidance on making design systems work well for coding agents exists, but it is scattered across experiments, articles, talks, and individual team write-ups. That guidance rarely answers two practical questions:

1. How understandable is this design system to an agent today?
2. Did the changes we just made improve it?

DS Bench turns those learnings into versioned, repeatable checks. Each check names what it measures, how to improve it, and the reported failure mode behind it.

## How the rubric was built

The current rubric, **ARS v0.3**, contains 22 scored checks. Category scores are weighted by finding severity, then combined using the category weights above. Checks that genuinely do not apply are handled separately rather than automatically counted as failures.

**Documentation coverage requires real evidence (ARS v0.3).** An export counts as documented only when the audit directly detects meaningful JSDoc/TSDoc on it, a dedicated Markdown section or API-table entry naming it, an importable usage example, or a manifest record that both names and describes it. Simply naming an export in prose — an audit log, task brief, changelog, or ADR — is treated as an incidental mention and does not earn coverage. The audit stays deterministic and local: it detects these mechanical signals and cites the carrier, leaving deeper semantic interpretation to the human or AI reading the report. This changed the meaning of a scored check, so it ships as ARS v0.3; v0.2 reports remain valid historical artifacts and should not be compared composite-to-composite with v0.3.

The weights and checks were calibrated against four different design-system checkouts: Cedar UI, MUI, Chakra UI, and Shopify Polaris. The public-system findings are presented as ecosystem patterns, not judgments about the teams that maintain them.

- [Read the full check catalogue](docs/audit-checks.md) for every measure, fix, and receipt.
- [Read the pilot notes](docs/pilot/NOTES.md) for calibration decisions and known limitations.
- [Browse the research index](docs/research/resources.md) for the articles, experiments, tools, and studies that informed the checks.
- [Read the scoring rationale](docs/adr/0003-intrinsics-dominate-signals-over-tools.md) for why intrinsic understandability dominates agent-specific metadata.

The rubric is versioned so its assumptions can be discussed and improved without silently changing the meaning of an existing score.

## Example reports

These reports show the same audit applied to different design-system architectures. They are useful for understanding the level of detail DS Bench produces and how not-applicable checks are handled.

| Design system | Human-readable report | JSON report |
| --- | --- | --- |
| Cedar UI | [Terminal report](docs/pilot/cedar.txt) | [JSON](docs/pilot/cedar.json) |
| MUI | [Terminal report](docs/pilot/mui.txt) | [JSON](docs/pilot/mui.json) |
| Chakra UI | [Terminal report](docs/pilot/chakra.txt) | [JSON](docs/pilot/chakra.json) |
| Shopify Polaris | [Terminal report](docs/pilot/polaris.txt) | [JSON](docs/pilot/polaris.json) |

## Output options

The default output is a readable report with the composite score, category scores, and top findings.

Use `--compact` for a short CI-oriented summary:

```sh
npx ds-bench audit . --compact
```

Use `--verbose` for all findings, evidence, and receipts:

```sh
npx ds-bench audit . --verbose
```

Use `--json` for the machine-readable `AuditReport`:

```sh
npx ds-bench audit . --json > audit-report.json
```

The JSON schema is published at [`schemas/audit-report.schema.json`](schemas/audit-report.schema.json).

## Configuration

Pass a JSON config with `--config`:

```json
{
  "exclude": ["storybook-static/**"],
  "weights": {
    "docs": 25,
    "api": 20,
    "guidance": 15,
    "tokens": 15,
    "deprecation": 15,
    "agent": 10
  }
}
```

`exclude` entries are glob patterns applied during file discovery. You can override category weights for private analysis; published DS Bench reports use the versioned defaults so their scores remain comparable.

## Design and project docs

- [PRD](docs/PRD.md) — the problem, intended users, and scope of the static audit.
- [CONTEXT.md](CONTEXT.md) — the project's shared terminology.
- [Architecture decisions](docs/adr/) — the reasoning behind the tool's scope and scoring model.
- [Check catalogue](docs/audit-checks.md) — the complete, versioned rubric.

## Package contents

The npm package contains only the files needed for the CLI, schema, and README image:

- `docs/assets/readme-report.svg`
- `dist/src`
- `schemas`

Fixtures, pilot reports, research, and development docs remain in the repository and are not included in the npm package.
