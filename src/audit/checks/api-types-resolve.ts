import * as ts from "typescript";
import { join } from "node:path";
import { getExportedComponents } from "../component-inventory.ts";
import { escapeRegExp, getPackageName, listTextFiles } from "../file-system.ts";
import type { AuditCheck, CheckContext, CheckResult } from "../types.ts";
import { formatNames, roundRatio } from "./support.ts";

export const apiTypesResolveCheck: AuditCheck = {
  id: "api.types-resolve",
  category: "api",
  severity: "critical",
  signal: "importable TypeScript exports",
  carriers: ["package.json types/exports fields"],
  measure: "synthetic import of every export typechecks",
  fix: "Repair the package types/exports mapping so every public export is importable.",
  naBehavior: "Never N/A; packages without resolvable public types fail this API clarity signal.",
  receipt: "Wrong import paths are a documented agent failure mode.",
  run(context: CheckContext): CheckResult {
    const files = listTextFiles(context.targetPath);
    const exportedNames = getExportedComponents(files).components;

    if (exportedNames.length === 0) {
      return {
        outcome: "fail",
        score: 0,
        measure: {
          kind: "ratio",
          value: 0,
          detail: "0/0 exports typecheck from a synthetic package import; unresolved: no exports found",
        },
        evidence: [],
      };
    }

    const unresolved = getUnresolvedSyntheticImports(context.targetPath, exportedNames);
    const resolvedCount = exportedNames.length - unresolved.length;
    const ratio = resolvedCount / exportedNames.length;

    return {
      outcome: unresolved.length === 0 ? "pass" : "fail",
      score: ratio,
      measure: {
        kind: "ratio",
        value: roundRatio(ratio),
        detail: `${resolvedCount}/${exportedNames.length} exports typecheck from a synthetic package import; unresolved: ${formatNames(unresolved)}`,
      },
      evidence: unresolved.slice(0, 20),
    };
  },
};

function getUnresolvedSyntheticImports(targetPath: string, exportNames: string[]): string[] {
  const packageName = getPackageName(targetPath);
  const probePath = join(targetPath, "__ds_bench_types_probe__.ts");
  const probe = [
    `import { ${exportNames.join(", ")} } from ${JSON.stringify(packageName)};`,
    `const __dsBenchProbe = [${exportNames.join(", ")}];`,
    "void __dsBenchProbe;",
  ].join("\n");
  const host = ts.createCompilerHost(compilerOptions);
  const originalReadFile = host.readFile.bind(host);
  const originalFileExists = host.fileExists.bind(host);

  host.readFile = (fileName) => (fileName === probePath ? probe : originalReadFile(fileName));
  host.fileExists = (fileName) => fileName === probePath || originalFileExists(fileName);

  const program = ts.createProgram([probePath], compilerOptions, host);
  const diagnostics = ts.getPreEmitDiagnostics(program).filter((diagnostic) => diagnostic.file?.fileName === probePath);

  if (diagnostics.length === 0) {
    return [];
  }

  const hasModuleResolutionFailure = diagnostics.some((diagnostic) => MODULE_RESOLUTION_ERROR_CODES.has(diagnostic.code));
  if (hasModuleResolutionFailure) {
    return exportNames;
  }

  const text = diagnostics.map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")).join("\n");
  return exportNames.filter((name) => new RegExp(`\\b${escapeRegExp(name)}\\b`).test(text));
}

// TS2307 "Cannot find module", TS7016/TS2792 (missing/untyped declaration file variants).
const MODULE_RESOLUTION_ERROR_CODES = new Set([2307, 7016, 2792]);

const compilerOptions: ts.CompilerOptions = {
  allowJs: true,
  allowImportingTsExtensions: true,
  jsx: ts.JsxEmit.ReactJSX,
  module: ts.ModuleKind.NodeNext,
  moduleResolution: ts.ModuleResolutionKind.NodeNext,
  noEmit: true,
  skipLibCheck: true,
  strict: false,
  target: ts.ScriptTarget.ES2022,
};
