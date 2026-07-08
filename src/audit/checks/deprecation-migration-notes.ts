import type { AuditCheck, AuditContext, CheckResult } from "../types.ts";
import { hasDeprecatedTag, isKnownDeprecated } from "./deprecation-marked.ts";
import { formatNames, naResult, roundRatio } from "./support.ts";

export const deprecationMigrationNotesCheck: AuditCheck = {
  id: "deprecation.migration-notes",
  category: "deprecation",
  severity: "warning",
  signal: "replacement guidance for deprecated exports",
  carriers: ["JSDoc @deprecated"],
  measure: "% @deprecated marks naming a replacement or migration path",
  fix: "Append replacement guidance to every @deprecated mark.",
  naBehavior:
    "N/A when zero @deprecated marks exist; clean when no deprecated surface exists, uncovered when unmarked deprecations stay deprecation.marked's gap.",
  naReason: "clean",
  receipt: "A bare deprecation mark does not redirect an agent away from deprecated training-data gravity.",
  run(context: AuditContext): CheckResult {
    const files = context.files;
    const exports = context.exportedSymbols;
    const markedExports = exports.filter((symbol) => hasDeprecatedTag(symbol.leadingComment));

    if (markedExports.length === 0) {
      const knownDeprecated = exports.filter((symbol) => isKnownDeprecated(symbol, files));
      return naResult(
        "ratio",
        "0 @deprecated marks found; migration notes are not applicable (deprecation.marked carries unmarked deprecations).",
        knownDeprecated.length === 0 ? "clean" : "uncovered",
      );
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
