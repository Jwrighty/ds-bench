import { basename, extname } from "node:path";
import {
  getComponentImports,
  getExportedComponentSymbols,
  getExportedSymbols,
  getRenderedComponentNames,
} from "../component-inventory.ts";
import { isExampleCarrier } from "../example-carriers.ts";
import { isRecord, walkJson, type TextFile } from "../file-system.ts";
import { isManifestCarrier, MANIFEST_NAME_FIELDS } from "../manifest-carriers.ts";
import type { AuditCheck, AuditContext, CheckResult } from "../types.ts";
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
  run(context: AuditContext): CheckResult {
    const files = context.files;
    const symbols = context.exportedComponentSymbols;
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
  const namesByPath = new Map<string, Set<string>>();
  for (const symbol of symbols) {
    const names = namesByPath.get(symbol.relativePath) ?? new Set<string>();
    names.add(symbol.name);
    namesByPath.set(symbol.relativePath, names);
  }

  return symbols.map((symbol) => {
    const fileStem = stripKnownSuffixes(basename(symbol.relativePath, extname(symbol.relativePath)));
    const mismatch =
      fileStem !== "index" &&
      fileStem !== symbol.name &&
      !isCompoundComponentPart(symbol.name, fileStem, namesByPath.get(symbol.relativePath));
    return {
      label: `${symbol.name} source file ${symbol.relativePath}`,
      mismatch,
    };
  });
}

// Compound-component parts (`CardHeader`/`CardBody`) grouped in the parent's
// file (`Card.tsx`, which also exports `Card`) are a standard, discoverable
// React pattern — not a name mismatch. Real aliases/renames (`MetricCard` in
// `Stat.tsx`) share no such prefix relationship and stay flagged.
function isCompoundComponentPart(name: string, fileStem: string, fileNames: Set<string> | undefined): boolean {
  return (
    fileNames?.has(fileStem) === true &&
    name.startsWith(fileStem) &&
    /^[A-Z]/.test(name.slice(fileStem.length))
  );
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
    walkJson(parsed, (node) => {
      if (isRecord(node)) {
        const componentName = manifestComponentName(node, componentNames);
        const filePath = manifestFilePath(node);
        if (componentName && filePath) {
          const fileStem = stripKnownSuffixes(basename(filePath, extname(filePath)));
          checks.push({
            label: `${componentName} manifest file ${filePath}`,
            mismatch: fileStem !== componentName,
          });
        }
      }

      return true;
    });
    return checks;
  });
}

function manifestComponentName(record: Record<string, unknown>, componentNames: Set<string>): string | null {
  for (const field of MANIFEST_NAME_FIELDS) {
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
