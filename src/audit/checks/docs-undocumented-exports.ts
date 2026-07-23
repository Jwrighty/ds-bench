import { findDocOrExampleCarrier } from "../documentation-evidence.ts";
import type { TextFile } from "../file-system.ts";
import { isManifestCarrier, manifestDescribesExport } from "../manifest-carriers.ts";
import type { AuditCheck, AuditContext, CheckResult } from "../types.ts";
import { formatCarrierCitations, formatNames, hasCommentDescription } from "./support.ts";

export const docsUndocumentedExportsCheck: AuditCheck = {
  id: "docs.undocumented-exports",
  category: "docs",
  severity: "warning",
  signal: "documentation coverage",
  carriers: ["JSDoc/TSDoc", "docs files", "examples", "manifests"],
  measure: "count of exports with no documentation evidence, listed by name",
  fix: "Document or un-export undocumented public exports.",
  naBehavior: "Never N/A; undocumented exports are a scored docs gap.",
  receipt: "Undocumented public exports are trap surface for agents choosing from the design system.",
  run(context: AuditContext): CheckResult {
    const files = context.files;
    const symbols = context.exportedSymbols;
    const manifestFiles = files.filter((file) => isManifestCarrier(file.relativePath));
    const resolutions = symbols.map((symbol) => ({
      symbol,
      ...resolveDocsPresence(symbol.name, symbol.leadingComment, files, manifestFiles),
    }));
    const undocumented = resolutions.filter((resolution) => !resolution.documented).map((resolution) => resolution.symbol);
    const citations = resolutions
      .filter((resolution) => resolution.carrierFile !== null)
      .map((resolution) => ({ name: resolution.symbol.name, carrierFile: resolution.carrierFile as string }));
    const score = symbols.length === 0 ? 1 : (symbols.length - undocumented.length) / symbols.length;
    const baseDetail = `${undocumented.length} exported ${undocumented.length === 1 ? "symbol has" : "symbols have"} no documentation evidence: ${formatNames(
      undocumented.map((symbol) => symbol.name),
    )}`;

    return {
      outcome: undocumented.length === 0 ? "pass" : "fail",
      score,
      measure: {
        kind: "count",
        value: undocumented.length,
        detail: citations.length === 0 ? baseDetail : `${baseDetail}; documentation evidence resolved via file: ${formatCarrierCitations(citations)}`,
      },
      evidence: undocumented.map((symbol) => symbol.name).slice(0, 20),
    };
  },
};

// Documentation evidence is one of: meaningful JSDoc/TSDoc on the export, an
// importable usage example or dedicated Markdown section/API-table entry, or a
// described manifest record. `carrierFile` is set only when a file satisfied the
// match (not the symbol's own JSDoc), so the caller can cite which file did.
function resolveDocsPresence(
  name: string,
  leadingComment: string,
  files: TextFile[],
  manifestFiles: TextFile[],
): { documented: boolean; carrierFile: string | null } {
  if (hasCommentDescription(leadingComment)) {
    return { documented: true, carrierFile: null };
  }

  const docCarrier = findDocOrExampleCarrier(name, files);
  if (docCarrier) {
    return { documented: true, carrierFile: docCarrier };
  }

  const manifestCarrier = manifestFiles.find((file) => manifestDescribesExport(file.content, name));
  return manifestCarrier
    ? { documented: true, carrierFile: manifestCarrier.relativePath }
    : { documented: false, carrierFile: null };
}
