import { getExportedSymbols, type ExportedSymbol } from "../component-inventory.ts";
import { isRecord, listTextFiles } from "../file-system.ts";
import type { AuditCheck, CheckContext, CheckResult } from "../types.ts";
import { formatNames, roundRatio } from "./support.ts";

export const deprecationMarkedCheck: AuditCheck = {
  id: "deprecation.marked",
  category: "deprecation",
  severity: "critical",
  signal: "deprecation marks",
  carriers: ["JSDoc @deprecated"],
  measure: "% known-deprecated exports carrying @deprecated",
  fix: "Add @deprecated to legacy exports.",
  naBehavior: "N/A when no known-deprecated exports can be inferred from source, docs, changelog, or manifest carriers.",
  receipt: "Deprecated patterns dominate training data unless current source clearly marks them as deprecated.",
  run(context: CheckContext): CheckResult {
    const files = listTextFiles(context.targetPath);
    const exports = getExportedSymbols(files);
    const knownDeprecated = exports.filter((symbol) => isKnownDeprecated(symbol, files));

    if (knownDeprecated.length === 0) {
      return {
        outcome: "na",
        score: null,
        measure: {
          kind: "ratio",
          value: 0,
          detail: "0 known-deprecated exports found; deprecation marks are not applicable.",
        },
        evidence: [],
      };
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

function isKnownDeprecated(symbol: ExportedSymbol, files: ReturnType<typeof listTextFiles>): boolean {
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

    const nearby = new RegExp(`\\b${escapeRegExp(symbol.name)}\\b[\\s\\S]{0,120}\\bdeprecated\\b|\\bdeprecated\\b[\\s\\S]{0,120}\\b${escapeRegExp(symbol.name)}\\b`, "i");
    return nearby.test(file.content);
  });
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

  const namesExport =
    Object.entries(value).some(([key, nested]) => {
      return ["name", "displayName", "exportName", "component"].includes(key) && nested === exportName;
    }) || Object.hasOwn(value, exportName);

  if (namesExport && (value.deprecated === true || value.status === "deprecated")) {
    return true;
  }

  return Object.values(value).some((nested) => jsonValueMarksDeprecated(nested, exportName));
}

function hasDeprecatedTag(comment: string): boolean {
  return /@deprecated\b/i.test(comment);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
