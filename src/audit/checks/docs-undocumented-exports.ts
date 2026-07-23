import { extname } from "node:path";
import { isExampleCarrier } from "../example-carriers.ts";
import { escapeRegExp, type TextFile } from "../file-system.ts";
import { isManifestCarrier } from "../manifest-carriers.ts";
import type { AuditCheck, AuditContext, CheckResult } from "../types.ts";
import { formatCarrierCitations, formatNames, hasCommentDescription, roundRatio } from "./support.ts";

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
  run(context: AuditContext): CheckResult {
    const files = context.files;
    const symbols = context.exportedSymbols;
    const docsFiles = files.filter(isDocsPresenceCarrier);
    const resolutions = symbols.map((symbol) => ({ symbol, ...resolveDocsPresence(symbol.name, symbol.leadingComment, docsFiles) }));
    const undocumented = resolutions.filter((resolution) => !resolution.documented).map((resolution) => resolution.symbol);
    const citations = resolutions
      .filter((resolution) => resolution.carrierFile !== null)
      .map((resolution) => ({ name: resolution.symbol.name, carrierFile: resolution.carrierFile as string }));
    const score = symbols.length === 0 ? 1 : (symbols.length - undocumented.length) / symbols.length;
    const baseDetail = `${undocumented.length} exported ${undocumented.length === 1 ? "symbol has" : "symbols have"} no docs presence anywhere: ${formatNames(
      undocumented.map((symbol) => symbol.name),
    )}`;

    return {
      outcome: undocumented.length === 0 ? "pass" : "fail",
      score,
      measure: {
        kind: "count",
        value: undocumented.length,
        detail: citations.length === 0 ? baseDetail : `${baseDetail}; docs presence resolved via file: ${formatCarrierCitations(citations)}`,
      },
      evidence: undocumented.map((symbol) => symbol.name).slice(0, 20),
    };
  },
};

function isDocsPresenceCarrier(file: TextFile): boolean {
  const extension = extname(file.relativePath);
  return extension === ".md" || extension === ".mdx" || isExampleCarrier(file.relativePath) || isManifestCarrier(file.relativePath);
}

// `carrierFile` is set only when presence resolves via file search (not the
// symbol's own JSDoc), so the caller can cite which file satisfied the match.
function resolveDocsPresence(
  name: string,
  leadingComment: string,
  docsFiles: TextFile[],
): { documented: boolean; carrierFile: string | null } {
  if (hasCommentDescription(leadingComment)) {
    return { documented: true, carrierFile: null };
  }

  const pattern = new RegExp(`\\b${escapeRegExp(name)}\\b`);
  const carrier = docsFiles.find((file) => pattern.test(file.content));
  return carrier ? { documented: true, carrierFile: carrier.relativePath } : { documented: false, carrierFile: null };
}
