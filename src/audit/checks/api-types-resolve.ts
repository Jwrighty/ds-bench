import * as ts from "typescript";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { getExportedComponents, getPublicPackage, type PublicPackage } from "../component-inventory.ts";
import { escapeRegExp, getPackageName, listTextFiles } from "../file-system.ts";
import type { AuditCheck, CheckContext, CheckResult } from "../types.ts";
import { formatNames, naResult, roundRatio } from "./support.ts";

export const apiTypesResolveCheck: AuditCheck = {
  id: "api.types-resolve",
  category: "api",
  severity: "critical",
  signal: "importable TypeScript exports",
  carriers: ["package.json types/exports fields"],
  measure: "synthetic import of every export typechecks",
  fix: "Repair the package types/exports mapping so every public export is importable.",
  naBehavior:
    "N/A when the checkout is unbuilt: the package's declared type/entry targets (types/typings/main/module/exports) point at build output (e.g. dist/) that is absent from this checkout. Fails when those targets are present but the mapping is still broken, or when no exports are found.",
  receipt: "Wrong import paths are a documented agent failure mode.",
  run(context: CheckContext): CheckResult {
    const files = context.files ?? listTextFiles(context.targetPath);
    const exportedNames = getExportedComponents(files).components;
    const publicPackage = getPublicPackage(files);

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

    if (!publicPackage) {
      return entrypointUnresolvableResult("package entrypoint could not be identified", "unknown package");
    }

    const result = getUnresolvedSyntheticImports(context.targetPath, publicPackage, exportedNames);
    if (result.kind === "entrypoint-unresolvable") {
      const missingEntries = findMissingBuildOutputEntries(context.targetPath, publicPackage);
      if (missingEntries.length > 0) {
        return naResult(
          "ratio",
          `entrypoints point at build output absent from this checkout (unbuilt source clone); types resolution not assessed: ${formatNames(missingEntries)}`,
        );
      }
      return entrypointUnresolvableResult(result.detail, publicPackage.name);
    }

    const unresolved = result.unresolved;
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

type SyntheticImportResult =
  | { kind: "checked"; unresolved: string[] }
  | { kind: "entrypoint-unresolvable"; detail: string };

function getUnresolvedSyntheticImports(targetPath: string, publicPackage: PublicPackage, exportNames: string[]): SyntheticImportResult {
  const packageRootPath = join(targetPath, publicPackage.rootRelativePath);
  const packageName = publicPackage.name || getPackageName(packageRootPath);
  const probePath = join(packageRootPath, "__ds_bench_types_probe__.ts");
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
    return { kind: "checked", unresolved: [] };
  }

  const hasModuleResolutionFailure = diagnostics.some((diagnostic) => MODULE_RESOLUTION_ERROR_CODES.has(diagnostic.code));
  if (hasModuleResolutionFailure) {
    return {
      kind: "entrypoint-unresolvable",
      detail: `package entrypoint for ${packageName} is unresolvable; synthetic package import could not be checked.`,
    };
  }

  const text = diagnostics.map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")).join("\n");
  return { kind: "checked", unresolved: exportNames.filter((name) => new RegExp(`\\b${escapeRegExp(name)}\\b`).test(text)) };
}

/**
 * Declared type/entry targets (types/typings/main/module/exports) that name a conventional
 * build-output directory (dist/build/lib/out/esm/cjs/umd) but are absent on disk. A non-empty
 * result means the checkout is an unbuilt source clone — the package was never compiled here —
 * rather than a genuinely broken entrypoint mapping (which points at a path that was never
 * going to exist, built or not).
 */
function findMissingBuildOutputEntries(targetPath: string, publicPackage: PublicPackage): string[] {
  return publicPackage.declaredEntryRelativePaths.filter(
    (entry) => BUILD_OUTPUT_PATH_PATTERN.test(entry) && !existsSync(join(targetPath, entry)),
  );
}

const BUILD_OUTPUT_PATH_PATTERN = /(?:^|\/)(?:dist|build|lib|out|esm|cjs|umd)(?:\/|$)/;

function entrypointUnresolvableResult(detail: string, packageName: string): CheckResult {
  return {
    outcome: "fail",
    score: 0,
    measure: {
      kind: "ratio",
      value: 0,
      detail,
    },
    evidence: [packageName],
  };
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
