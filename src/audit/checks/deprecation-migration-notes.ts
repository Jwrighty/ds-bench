import { getExportedSymbols } from "../component-inventory.ts";
import { listTextFiles } from "../file-system.ts";
import type { AuditCheck, CheckContext, CheckResult } from "../types.ts";
import { hasDeprecatedTag } from "./deprecation-marked.ts";
import { formatNames, naResult, roundRatio } from "./support.ts";

export const deprecationMigrationNotesCheck: AuditCheck = {
  id: "deprecation.migration-notes",
  category: "deprecation",
  severity: "warning",
  signal: "replacement guidance for deprecated exports",
  carriers: ["JSDoc @deprecated"],
  measure: "% @deprecated marks naming a replacement or migration path",
  fix: "Append replacement guidance to every @deprecated mark.",
  naBehavior: "N/A when zero @deprecated marks exist (unmarked deprecations stay deprecation.marked's gap).",
  receipt: "A bare deprecation mark does not redirect an agent away from deprecated training-data gravity.",
  run(context: CheckContext): CheckResult {
    const files = context.files ?? listTextFiles(context.targetPath);
    const markedExports = getExportedSymbols(files).filter((symbol) => hasDeprecatedTag(symbol.leadingComment));

    if (markedExports.length === 0) {
      return naResult("ratio", "0 @deprecated marks found; migration notes are not applicable (deprecation.marked carries unmarked deprecations).");
    }

    const withoutMigration = markedExports.filter((markedExport) => !hasMigrationNote(markedExport.leadingComment));
    const migratedCount = markedExports.length - withoutMigration.length;
    const ratio = migratedCount / markedExports.length;

    return {
      outcome: withoutMigration.length === 0 ? "pass" : "fail",
      score: ratio,
      measure: {
        kind: "ratio",
        value: roundRatio(ratio),
        detail: `${migratedCount}/${markedExports.length} @deprecated marks name a replacement or migration path; missing: ${formatNames(withoutMigration.map((markedExport) => markedExport.name))}`,
      },
      evidence: withoutMigration.map((markedExport) => markedExport.name).slice(0, 20),
    };
  },
};

function hasMigrationNote(note: string): boolean {
  return /\b(use|instead|replace(?:d)? by|renamed to|migrate to)\b/i.test(note);
}
