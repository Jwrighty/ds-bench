import { getExportedSymbols, type ExportedSymbol } from "../component-inventory.ts";
import { escapeRegExp, isRecord, listTextFiles } from "../file-system.ts";
import { recordNamesExport } from "../manifest-carriers.ts";
import type { AuditCheck, CheckContext, CheckResult } from "../types.ts";
import { formatNames, naResult, roundRatio } from "./support.ts";

export const deprecationMarkedCheck: AuditCheck = {
  id: "deprecation.marked",
  category: "deprecation",
  severity: "critical",
  signal: "deprecation marks",
  carriers: ["JSDoc @deprecated"],
  measure:
    "% known-deprecated exports carrying the mark (known-deprecated = docs/changelog/manifest cross-reference where available, plus name-pattern inference: Legacy*/Deprecated*/Old* prefixes and suffixes)",
  fix: "Add @deprecated to legacy exports.",
  naBehavior: "N/A when zero known-deprecated exports detected (clean).",
  naReason: "clean",
  receipt: "Deprecated patterns dominate training data unless current source clearly marks them as deprecated.",
  run(context: CheckContext): CheckResult {
    const files = context.files ?? listTextFiles(context.targetPath);
    const exports = getExportedSymbols(files);
    const knownDeprecated = exports.filter((symbol) => isKnownDeprecated(symbol, files));

    if (knownDeprecated.length === 0) {
      return naResult("ratio", "0 known-deprecated exports found; deprecation marks are not applicable.");
    }

    const unmarked = knownDeprecated.filter((symbol) => !hasDeprecatedTag(symbol.leadingComment));
    const markedCount = knownDeprecated.length - unmarked.length;
    const ratio = markedCount / knownDeprecated.length;

    return {
      outcome: unmarked.length === 0 ? "pass" : "fail",
      score: ratio,
      measure: {
        kind: "ratio",
        value: roundRatio(ratio),
        detail: `${markedCount}/${knownDeprecated.length} known-deprecated exports carry @deprecated; missing: ${formatNames(unmarked.map((symbol) => symbol.name))}`,
      },
      evidence: unmarked.map((symbol) => symbol.name).slice(0, 20),
    };
  },
};

export function isKnownDeprecated(symbol: ExportedSymbol, files: ReturnType<typeof listTextFiles>): boolean {
  if (hasDeprecatedTag(symbol.leadingComment)) {
    return true;
  }

  if (/^(?:Legacy|Deprecated|Old)[A-Z]/.test(symbol.name) || /(?:Legacy|Deprecated|Old)$/.test(symbol.name)) {
    return true;
  }

  return files.some((file) => {
    if (/\.json$/.test(file.relativePath)) {
      return isDeprecatedInJson(file.content, symbol.name);
    }

    if (!/\.(md|mdx)$/.test(file.relativePath)) {
      return false;
    }

    return markdownMarksDeprecated(file.content, symbol.name);
  });
}

function markdownMarksDeprecated(content: string, exportName: string): boolean {
  const text = stripFencedCodeBlocks(content);
  const name = `(?:\`${escapeRegExp(exportName)}\`|\\b${escapeRegExp(exportName)}\\b|~~${escapeRegExp(exportName)}~~)`;
  const patterns = [
    new RegExp(`${name}\\s+(?:is|was|has been|is now)?\\s*[Dd]eprecated\\b`),
    new RegExp(`${name}\\s*\\([^)]*\\b[Dd]eprecated\\b[^)]*\\)`),
    new RegExp(`\\b[Dd]eprecated\\s*[:\\-]\\s*${name}`),
    new RegExp(`~~${escapeRegExp(exportName)}~~\\s*(?:is\\s+)?[Dd]eprecated\\b`),
  ];

  return patterns.some((pattern) => pattern.test(text));
}

function stripFencedCodeBlocks(content: string): string {
  return content.replace(/```[\s\S]*?```/g, "");
}

function isDeprecatedInJson(content: string, exportName: string): boolean {
  try {
    return jsonValueMarksDeprecated(JSON.parse(content) as unknown, exportName);
  } catch {
    return false;
  }
}

function jsonValueMarksDeprecated(value: unknown, exportName: string): boolean {
  if (Array.isArray(value)) {
    return value.some((item) => jsonValueMarksDeprecated(item, exportName));
  }

  if (!isRecord(value)) {
    return false;
  }

  if (recordNamesExport(value, exportName) && (value.deprecated === true || value.status === "deprecated")) {
    return true;
  }

  return Object.values(value).some((nested) => jsonValueMarksDeprecated(nested, exportName));
}

export function hasDeprecatedTag(comment: string): boolean {
  return /@deprecated\b/i.test(comment);
}
