import { getExportedComponents } from "../component-inventory.ts";
import {
  declaresSystemComponent,
  getInstructionMetadataFiles,
  getMetadataCodeExamples,
  getPackageImportNames,
  importsSystemComponent,
  isRebuildStyleExample,
} from "../agent-metadata-carriers.ts";
import { listTextFiles } from "../file-system.ts";
import type { AuditCheck, CheckContext, CheckResult } from "../types.ts";
import { formatNames, naResult, roundRatio } from "./support.ts";

export const agentInstructionManualCheck: AuditCheck = {
  id: "agent.instruction-manual",
  category: "agent",
  severity: "critical",
  signal: "instruction-manual vs re-implementation-spec orientation",
  carriers: ["DESIGN.md", "AGENTS.md", "example blocks in metadata"],
  measure: "metadata code examples import system components instead of rebuilding them",
  fix: "Rewrite metadata examples to import the design-system components instead of re-implementing them.",
  naBehavior: "N/A when no agent metadata files exist; agent.context-file-quality carries the absence (uncovered).",
  naReason: "uncovered",
  receipt: "Re-implementation specs cause agents to recreate components instead of using the system.",
  run(context: CheckContext): CheckResult {
    const files = context.files ?? listTextFiles(context.targetPath);
    const metadataFiles = getInstructionMetadataFiles(files);

    if (metadataFiles.length === 0) {
      return naResult("ratio", "0 agent metadata files found; instruction-manual orientation is not applicable.");
    }

    const components = new Set(getExportedComponents(files).components);
    const packageNames = getPackageImportNames(files);
    const relevantExamples = getMetadataCodeExamples(files)
      .map((example) => ({
        ...example,
        importsSystemComponent: importsSystemComponent(example.content, components, packageNames),
        declaresSystemComponent: declaresSystemComponent(example.content, components),
        isRebuildStyleExample: isRebuildStyleExample(example.content, components),
      }))
      .filter((example) => example.importsSystemComponent || example.isRebuildStyleExample);
    const rebuildExamples = relevantExamples.filter(
      (example) => example.declaresSystemComponent || (!example.importsSystemComponent && example.isRebuildStyleExample),
    );
    const importingExamples = relevantExamples.length - rebuildExamples.length;
    const ratio = relevantExamples.length === 0 ? 1 : importingExamples / relevantExamples.length;
    const evidence = rebuildExamples.map((example) => `${example.file.relativePath}#example-${example.index}`);

    return {
      outcome: rebuildExamples.length === 0 ? "pass" : "fail",
      score: ratio,
      measure: {
        kind: "ratio",
        value: roundRatio(ratio),
        detail: `${importingExamples}/${relevantExamples.length} metadata code examples import system components; rebuild examples: ${formatNames(evidence)}`,
      },
      evidence: evidence.slice(0, 20),
    };
  },
};
