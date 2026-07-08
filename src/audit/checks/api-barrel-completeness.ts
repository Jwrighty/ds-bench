import { dirname } from "node:path";
import { COMPONENT_NAME } from "../component-inventory.ts";
import { isExampleCarrier } from "../example-carriers.ts";
import { type TextFile } from "../file-system.ts";
import type { AuditCheck, AuditContext, CheckResult } from "../types.ts";
import { formatNames } from "./support.ts";

export const apiBarrelCompletenessCheck: AuditCheck = {
  id: "api.barrel-completeness",
  category: "api",
  severity: "info",
  signal: "import ergonomics",
  carriers: ["package barrel"],
  measure: "exports reachable from root vs deep-import-only count",
  fix: "Re-export deep-only components from the root barrel or document deep paths in agent metadata.",
  naBehavior: "Never N/A; deep-import-only components are scored as import ergonomics gaps.",
  receipt: "Agents guess deep paths when components are not reachable from the root package import.",
  run(context: AuditContext): CheckResult {
    const files = context.files;
    const publicPackage = context.publicPackage;
    const reachable = new Set(context.components);
    const sourceComponents = collectSourceComponents(files, publicPackage?.rootRelativePath ?? "");
    const deepOnly = sourceComponents.filter((component) => !reachable.has(component));
    const total = new Set([...reachable, ...sourceComponents]).size;
    const score = total === 0 ? 0 : reachable.size / total;

    return {
      outcome: deepOnly.length === 0 && total > 0 ? "pass" : "fail",
      score,
      measure: {
        kind: "count",
        value: deepOnly.length,
        detail: `${deepOnly.length} ${deepOnly.length === 1 ? "component is" : "components are"} deep-import-only and missing from the root barrel: ${formatNames(deepOnly)}`,
      },
      evidence: deepOnly.slice(0, 20),
    };
  },
};

function collectSourceComponents(files: TextFile[], packageRoot: string): string[] {
  const components = new Set<string>();
  const sourceRoot = packageRoot.length === 0 ? "src" : `${packageRoot}/src`;
  const entryDir = packageRoot.length === 0 ? "." : packageRoot;

  for (const file of files) {
    if (isExampleCarrier(file.relativePath) || file.relativePath.endsWith(".json")) {
      continue;
    }

    if (packageRoot.length > 0 && !file.relativePath.startsWith(`${packageRoot}/`)) {
      continue;
    }

    if (packageRoot.length === 0 && dirname(file.relativePath) !== "src" && !file.relativePath.startsWith(`${sourceRoot}/`)) {
      continue;
    }

    if (dirname(file.relativePath) === entryDir) {
      continue;
    }

    for (const name of collectExportedComponentNames(file.content)) {
      components.add(name);
    }
  }

  return Array.from(components).sort();
}

function collectExportedComponentNames(content: string): string[] {
  const names = new Set<string>();
  const declarationPattern = /\bexport\s+(?:declare\s+)?(?:function|class|const|let|var)\s+(?<name>[A-Za-z_$][A-Za-z0-9_$]*)\b/g;
  for (const match of content.matchAll(declarationPattern)) {
    const name = match.groups?.name;
    if (name && COMPONENT_NAME.test(name)) {
      names.add(name);
    }
  }

  const namedExportPattern = /\bexport\s+\{\s*(?<specifiers>[^}]+)\s*\}/g;
  for (const match of content.matchAll(namedExportPattern)) {
    for (const specifier of (match.groups?.specifiers ?? "").split(",")) {
      const exported = specifier.trim().replace(/^type\s+/, "").split(/\s+as\s+/).at(-1)?.trim();
      if (exported && COMPONENT_NAME.test(exported)) {
        names.add(exported);
      }
    }
  }

  return Array.from(names);
}
