import { hasImportableUsage } from "../component-inventory.ts";
import { EXAMPLE_CARRIER_LABELS, isExampleCarrier } from "../example-carriers.ts";
import type { AuditCheck, AuditContext, CheckResult } from "../types.ts";
import { formatNames, roundRatio } from "./support.ts";

export const docsUsageExamplesCheck: AuditCheck = {
  id: "docs.usage-examples",
  category: "docs",
  severity: "critical",
  signal: "usage examples",
  carriers: EXAMPLE_CARRIER_LABELS,
  measure: "% exported components with >=1 importable usage example",
  fix: "Add one canonical story/example per component.",
  naBehavior: "Never N/A; usage examples are a universal design-system signal, so absence fails.",
  receipt: "Agents recreate components they can't see used (Atlassian DESIGN.md experiment).",
  run(context: AuditContext): CheckResult {
    const files = context.files;
    const inventory = { components: context.components };
    const exampleFiles = files.filter((file) => isExampleCarrier(file.relativePath));
    const covered = new Set<string>();

    for (const component of inventory.components) {
      if (exampleFiles.some((file) => hasImportableUsage(file.content, component))) {
        covered.add(component);
      }
    }

    const missing = inventory.components.filter((component) => !covered.has(component));
    const total = inventory.components.length;
    const ratio = total === 0 ? 0 : covered.size / total;

    return {
      outcome: missing.length === 0 && total > 0 ? "pass" : "fail",
      score: ratio,
      measure: {
        kind: "ratio",
        value: roundRatio(ratio),
        detail: `${covered.size}/${total} exported components have importable usage examples; missing: ${formatNames(missing)}`,
      },
      evidence: missing.slice(0, 20),
    };
  },
};
