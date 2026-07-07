import { getComponentImports, getExportedComponents, getRenderedComponentNames } from "../component-inventory.ts";
import { EXAMPLE_CARRIER_LABELS, isExampleCarrier } from "../example-carriers.ts";
import { listTextFiles } from "../file-system.ts";
import type { AuditCheck, CheckContext, CheckResult } from "../types.ts";
import { formatNames, roundRatio } from "./support.ts";

export const docsExampleImportsRealCheck: AuditCheck = {
  id: "docs.example-imports-real",
  category: "docs",
  severity: "critical",
  signal: "example imports resolve against package exports",
  carriers: EXAMPLE_CARRIER_LABELS,
  measure: "% example component imports that resolve against exported components",
  fix: "Correct or delete examples with dead imports.",
  naBehavior: "N/A when no examples exist at all; docs.usage-examples carries the absence.",
  receipt: "Wrong import paths are a documented agent failure mode (Astryx self-checks).",
  run(context: CheckContext): CheckResult {
    const files = listTextFiles(context.targetPath);
    const exportedComponents = new Set(getExportedComponents(files).components);
    const exampleFiles = files.filter((file) => isExampleCarrier(file.relativePath));

    if (exampleFiles.length === 0) {
      return {
        outcome: "na",
        score: null,
        measure: {
          kind: "ratio",
          value: 0,
          detail: "No examples exist; docs.usage-examples carries the absence.",
        },
        evidence: [],
      };
    }

    const importedAndRendered = exampleFiles.flatMap((file) => {
      const rendered = getRenderedComponentNames(file.content);
      return getComponentImports(file.content).filter((componentImport) => rendered.has(componentImport.localName));
    });

    const unresolved = importedAndRendered
      .filter((componentImport) => !exportedComponents.has(componentImport.importedName))
      .map((componentImport) => componentImport.importedName);

    if (importedAndRendered.length === 0) {
      return {
        outcome: "fail",
        score: 0,
        measure: {
          kind: "ratio",
          value: 0,
          detail: "0/0 example component imports resolve against exported components; unresolved: no component imports found",
        },
        evidence: exampleFiles.map((file) => file.relativePath).slice(0, 20),
      };
    }

    const resolvedCount = importedAndRendered.length - unresolved.length;
    const ratio = resolvedCount / importedAndRendered.length;

    return {
      outcome: unresolved.length === 0 ? "pass" : "fail",
      score: ratio,
      measure: {
        kind: "ratio",
        value: roundRatio(ratio),
        detail: `${resolvedCount}/${importedAndRendered.length} example component imports resolve against exported components; unresolved: ${formatNames(unresolved)}`,
      },
      evidence: Array.from(new Set(unresolved)).slice(0, 20),
    };
  },
};
