import { getExportedSymbols } from "../component-inventory.ts";
import { listTextFiles } from "../file-system.ts";
import type { AuditCheck, CheckContext, CheckResult } from "../types.ts";
import { hasDeprecatedTag, isKnownDeprecated } from "./deprecation-marked.ts";
import { formatNames, roundRatio } from "./support.ts";

export const deprecationMigrationNotesCheck: AuditCheck = {
  id: "deprecation.migration-notes",
  category: "deprecation",
  severity: "warning",
  signal: "replacement guidance for deprecated exports",
  carriers: ["JSDoc @deprecated"],
  measure: "% @deprecated marks naming a replacement or migration path",
  fix: "Append replacement guidance to every @deprecated mark.",
  naBehavior: "N/A when zero known-deprecated exports exist.",
  receipt: "A bare deprecation mark does not redirect an agent away from deprecated training-data gravity.",
  run(context: CheckContext): CheckResult {
    const files = context.files ?? listTextFiles(context.targetPath);
    const deprecatedExports = getExportedSymbols(files).filter((symbol) => isKnownDeprecated(symbol, files));

    if (deprecatedExports.length === 0) {
      return {
        outcome: "na",
        score: null,
        measure: {
          kind: "ratio",
          value: 0,
          detail: "0 known-deprecated exports found; migration notes are not applicable.",
        },
        evidence: [],
      };
    }

    const withoutMigration = deprecatedExports.filter(
      (deprecatedExport) => !hasDeprecatedTag(deprecatedExport.leadingComment) || !hasMigrationNote(deprecatedExport.leadingComment),
    );
    const migratedCount = deprecatedExports.length - withoutMigration.length;
    const ratio = migratedCount / deprecatedExports.length;

    return {
      outcome: withoutMigration.length === 0 ? "pass" : "fail",
      score: ratio,
      measure: {
        kind: "ratio",
        value: roundRatio(ratio),
        detail: `${migratedCount}/${deprecatedExports.length} known-deprecated exports include @deprecated migration guidance; missing: ${formatNames(withoutMigration.map((deprecatedExport) => deprecatedExport.name))}`,
      },
      evidence: withoutMigration.map((deprecatedExport) => deprecatedExport.name).slice(0, 20),
    };
  },
};

function hasMigrationNote(note: string): boolean {
  return /\b(use|instead|replace(?:d)? by|renamed to|migrate to)\b/i.test(note);
}
