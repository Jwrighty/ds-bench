import { getExportedComponents } from "../component-inventory.ts";
import { getManifestCoverage } from "../manifest-carriers.ts";
import { listTextFiles } from "../file-system.ts";
import type { AuditCheck, CheckContext, CheckResult } from "../types.ts";
import { formatNames, roundRatio } from "./support.ts";

export const agentManifestCoverageCheck: AuditCheck = {
  id: "agent.manifest-coverage",
  category: "agent",
  severity: "warning",
  signal: "machine-readable component metadata",
  carriers: ["cedar.manifest-style manifests", "Storybook manifest"],
  measure: "manifest covers N/M exported components",
  fix: "Generate or complete the component manifest.",
  naBehavior: "Never N/A; absent or partial manifests are scored as agent metadata gaps.",
  receipt: "Partial manifests force agents to guess the gaps.",
  run(context: CheckContext): CheckResult {
    const files = context.files ?? listTextFiles(context.targetPath);
    const components = getExportedComponents(files).components;

    if (components.length === 0) {
      return {
        outcome: "fail",
        score: 0,
        measure: {
          kind: "ratio",
          value: 0,
          detail: "0/0 exported components are covered by a manifest; missing: no exports found",
        },
        evidence: [],
      };
    }

    const coverage = getManifestCoverage(files, components);
    const missing = components.filter((component) => !coverage.coveredNames.has(component));
    const ratio = coverage.coveredNames.size / components.length;

    return {
      outcome: missing.length === 0 ? "pass" : "fail",
      score: ratio,
      measure: {
        kind: "ratio",
        value: roundRatio(ratio),
        detail: `${coverage.coveredNames.size}/${components.length} exported components are covered by a manifest; missing: ${formatNames(missing)}`,
      },
      evidence: missing.slice(0, 20),
    };
  },
};
