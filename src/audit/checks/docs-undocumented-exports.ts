import { extname } from "node:path";
import { getExportedSymbols } from "../component-inventory.ts";
import { isExampleCarrier } from "../example-carriers.ts";
import { escapeRegExp, listTextFiles, type TextFile } from "../file-system.ts";
import { isManifestCarrier } from "../manifest-carriers.ts";
import type { AuditCheck, CheckContext, CheckResult } from "../types.ts";
import { formatNames, hasCommentDescription, roundRatio } from "./support.ts";

export const docsUndocumentedExportsCheck: AuditCheck = {
  id: "docs.undocumented-exports",
  category: "docs",
  severity: "warning",
  signal: "documentation coverage",
  carriers: ["JSDoc/TSDoc", "docs files", "examples", "manifests"],
  measure: "count of exports with no docs presence anywhere, listed by name",
  fix: "Document or un-export undocumented public exports.",
  naBehavior: "Never N/A; undocumented exports are a scored docs gap.",
  receipt: "Undocumented public exports are trap surface for agents choosing from the design system.",
  run(context: CheckContext): CheckResult {
    const files = context.files ?? listTextFiles(context.targetPath);
    const symbols = getExportedSymbols(files);
    const docsFiles = files.filter(isDocsPresenceCarrier);
    const undocumented = symbols.filter((symbol) => !hasDocsPresence(symbol.name, symbol.leadingComment, docsFiles));
    const score = symbols.length === 0 ? 1 : (symbols.length - undocumented.length) / symbols.length;

    return {
      outcome: undocumented.length === 0 ? "pass" : "fail",
      score,
      measure: {
        kind: "count",
        value: undocumented.length,
        detail: `${undocumented.length} exported ${undocumented.length === 1 ? "symbol has" : "symbols have"} no docs presence anywhere: ${formatNames(
          undocumented.map((symbol) => symbol.name),
        )}`,
      },
      evidence: undocumented.map((symbol) => symbol.name).slice(0, 20),
    };
  },
};

function isDocsPresenceCarrier(file: TextFile): boolean {
  const extension = extname(file.relativePath);
  return extension === ".md" || extension === ".mdx" || isExampleCarrier(file.relativePath) || isManifestCarrier(file.relativePath);
}

function hasDocsPresence(name: string, leadingComment: string, docsFiles: TextFile[]): boolean {
  if (hasCommentDescription(leadingComment)) {
    return true;
  }

  const pattern = new RegExp(`\\b${escapeRegExp(name)}\\b`);
  return docsFiles.some((file) => pattern.test(file.content));
}
