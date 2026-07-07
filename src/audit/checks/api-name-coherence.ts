import { basename, extname } from "node:path";
import {
  getComponentImports,
  getExportedComponentSymbols,
  getExportedSymbols,
  getRenderedComponentNames,
} from "../component-inventory.ts";
import { isExampleCarrier } from "../example-carriers.ts";
import { isRecord, listTextFiles, type TextFile } from "../file-system.ts";
import { isManifestCarrier } from "../manifest-carriers.ts";
import type { AuditCheck, CheckContext, CheckResult } from "../types.ts";
import { formatNames } from "./support.ts";

export const apiNameCoherenceCheck: AuditCheck = {
  id: "api.name-coherence",
  category: "api",
  severity: "warning",
  signal: "discoverability",
  carriers: ["source layout", "stories", "manifest entries"],
  measure: "component name <-> file/story/manifest-entry mismatch count",
  fix: "Align component names across source files, stories, and manifest entries.",
  naBehavior: "Never N/A; name mismatches are scored when carriers exist.",
  receipt: "Name mismatch drives discovery-driven component recreation.",
  run(context: CheckContext): CheckResult {
    const files = context.files ?? listTextFiles(context.targetPath);
    const symbols = getExportedComponentSymbols(files);
    const componentNames = new Set(symbols.map((symbol) => symbol.name));
    const checks = [
      ...sourceNameChecks(symbols),
      ...storyNameChecks(files, componentNames),
      ...manifestNameChecks(files, componentNames),
    ];
    const mismatches = checks.filter((check) => check.mismatch);
    const score = checks.length === 0 ? 1 : (checks.length - mismatches.length) / checks.length;

    return {
      outcome: mismatches.length === 0 ? "pass" : "fail",
      score,
      measure: {
        kind: "count",
        value: mismatches.length,
        detail: `${mismatches.length} component name carrier mismatches: ${formatNames(mismatches.map((mismatch) => mismatch.label))}`,
      },
      evidence: mismatches.map((mismatch) => mismatch.label).slice(0, 20),
    };
  },
};

type NameCheck = {
  label: string;
  mismatch: boolean;
};

function sourceNameChecks(symbols: ReturnType<typeof getExportedSymbols>): NameCheck[] {
  return symbols.map((symbol) => {
    const fileStem = stripKnownSuffixes(basename(symbol.relativePath, extname(symbol.relativePath)));
    const mismatch = fileStem !== "index" && fileStem !== symbol.name;
    return {
      label: `${symbol.name} source file ${symbol.relativePath}`,
      mismatch,
    };
  });
}

function storyNameChecks(files: TextFile[], componentNames: Set<string>): NameCheck[] {
  return files.filter(isStoryFile).flatMap((file) => {
    const storyName = stripKnownSuffixes(basename(file.relativePath, extname(file.relativePath)));
    const rendered = getRenderedComponentNames(file.content);
    const usedImports = getComponentImports(file.content)
      .filter((componentImport) => componentNames.has(componentImport.importedName) && rendered.has(componentImport.localName))
      .filter((componentImport, index, imports) => imports.findIndex((candidate) => candidate.importedName === componentImport.importedName) === index);

    if (usedImports.length !== 1) {
      return [];
    }

    const componentImport = usedImports[0];
    return [
      {
        label: `${componentImport.importedName} story file ${file.relativePath}`,
        mismatch: storyName !== componentImport.importedName,
      },
    ];
  });
}

function manifestNameChecks(files: TextFile[], componentNames: Set<string>): NameCheck[] {
  return files.filter((file) => isManifestCarrier(file.relativePath)).flatMap((file) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(file.content);
    } catch {
      return [];
    }

    const checks: NameCheck[] = [];
    collectManifestNameChecks(parsed, componentNames, checks);
    return checks;
  });
}

function collectManifestNameChecks(value: unknown, componentNames: Set<string>, checks: NameCheck[]): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectManifestNameChecks(item, componentNames, checks);
    }
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  const componentName = manifestComponentName(value, componentNames);
  const filePath = manifestFilePath(value);
  if (componentName && filePath) {
    const fileStem = stripKnownSuffixes(basename(filePath, extname(filePath)));
    checks.push({
      label: `${componentName} manifest file ${filePath}`,
      mismatch: fileStem !== componentName,
    });
  }

  for (const nested of Object.values(value)) {
    collectManifestNameChecks(nested, componentNames, checks);
  }
}

function manifestComponentName(record: Record<string, unknown>, componentNames: Set<string>): string | null {
  for (const field of ["name", "displayName", "exportName", "component"]) {
    const value = record[field];
    if (typeof value === "string" && componentNames.has(value)) {
      return value;
    }
  }

  return null;
}

function manifestFilePath(record: Record<string, unknown>): string | null {
  for (const field of ["filePath", "filepath", "path", "source", "sourceFile"]) {
    const value = record[field];
    if (typeof value === "string" && /\.[A-Za-z0-9]+$/.test(value)) {
      return value;
    }
  }

  return null;
}

function isStoryFile(file: TextFile): boolean {
  return isExampleCarrier(file.relativePath) && /\.stor(?:y|ies)\.[cm]?[jt]sx?$/.test(file.relativePath);
}

function stripKnownSuffixes(value: string): string {
  return value.replace(/\.stories?$/i, "");
}
