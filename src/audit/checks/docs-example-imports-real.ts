import { getExportedComponents } from "../component-inventory.ts";
import { EXAMPLE_CARRIER_LABELS, isExampleCarrier } from "../example-carriers.ts";
import { listTextFiles } from "../file-system.ts";
import type { AuditCheck, CheckContext, CheckResult } from "../types.ts";

type ComponentImport = {
  importedName: string;
  localName: string;
};

const COMPONENT_NAME = /^[A-Z][A-Za-z0-9]*$/;

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
        detail: `${resolvedCount}/${importedAndRendered.length} example component imports resolve against exported components; unresolved: ${formatUnresolved(unresolved)}`,
      },
      evidence: Array.from(new Set(unresolved)).slice(0, 20),
    };
  },
};

function getRenderedComponentNames(content: string): Set<string> {
  const names = new Set<string>();

  for (const match of content.matchAll(/<([A-Z][A-Za-z0-9]*)(?:\s|>|\/)/g)) {
    names.add(match[1]);
  }

  return names;
}

function getComponentImports(content: string): ComponentImport[] {
  const imports: ComponentImport[] = [];

  for (const match of content.matchAll(/\bimport\s+([^;]+?)\s+from\s+["'][^"']+["']/g)) {
    const clause = match[1].trim();
    const namedMatch = clause.match(/\{([^}]+)\}/);
    const defaultMatch = clause.match(/^([A-Z][A-Za-z0-9]*)\b/);

    if (defaultMatch) {
      imports.push({ importedName: defaultMatch[1], localName: defaultMatch[1] });
    }

    if (!namedMatch) {
      continue;
    }

    for (const specifier of namedMatch[1].split(",")) {
      const parts = specifier.trim().split(/\s+as\s+/);
      const importedName = parts[0]?.trim();
      const localName = (parts[1] ?? parts[0])?.trim();
      if (importedName && localName && COMPONENT_NAME.test(importedName) && COMPONENT_NAME.test(localName)) {
        imports.push({ importedName, localName });
      }
    }
  }

  return imports;
}

function formatUnresolved(unresolved: string[]): string {
  return unresolved.length === 0 ? "none" : Array.from(new Set(unresolved)).join(", ");
}

function roundRatio(value: number): number {
  return Math.round(value * 1000) / 1000;
}
