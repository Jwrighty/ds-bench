import { isExampleCarrier } from "../example-carriers.ts";
import { listTextFiles } from "../file-system.ts";
import type { AuditCheck, CheckContext, CheckResult } from "../types.ts";
import { formatNames, roundRatio } from "./support.ts";

type DeprecatedExport = {
  name: string;
  note: string;
};

export const deprecationMigrationNotesCheck: AuditCheck = {
  id: "deprecation.migration-notes",
  category: "deprecation",
  severity: "warning",
  signal: "replacement guidance for deprecated exports",
  carriers: ["JSDoc @deprecated"],
  measure: "% @deprecated marks naming a replacement or migration path",
  fix: "Append replacement guidance to every @deprecated mark.",
  naBehavior: "N/A when zero deprecated exports exist.",
  receipt: "A bare deprecation mark does not redirect an agent away from deprecated training-data gravity.",
  run(context: CheckContext): CheckResult {
    const sourceFiles = listTextFiles(context.targetPath).filter((file) => !isExampleCarrier(file.relativePath));
    const deprecatedExports = sourceFiles.flatMap((file) => getDeprecatedExports(file.content));

    if (deprecatedExports.length === 0) {
      return {
        outcome: "na",
        score: null,
        measure: {
          kind: "ratio",
          value: 0,
          detail: "0 deprecated exports found; migration notes are not applicable.",
        },
        evidence: [],
      };
    }

    const withoutMigration = deprecatedExports.filter((deprecatedExport) => !hasMigrationNote(deprecatedExport.note));
    const migratedCount = deprecatedExports.length - withoutMigration.length;
    const ratio = migratedCount / deprecatedExports.length;

    return {
      outcome: withoutMigration.length === 0 ? "pass" : "fail",
      score: ratio,
      measure: {
        kind: "ratio",
        value: roundRatio(ratio),
        detail: `${migratedCount}/${deprecatedExports.length} deprecated exports include migration guidance; missing: ${formatNames(withoutMigration.map((deprecatedExport) => deprecatedExport.name))}`,
      },
      evidence: withoutMigration.map((deprecatedExport) => deprecatedExport.name).slice(0, 20),
    };
  },
};

function getDeprecatedExports(content: string): DeprecatedExport[] {
  const deprecatedExports: DeprecatedExport[] = [];
  const pattern =
    /\/\*\*([\s\S]*?@deprecated[\s\S]*?)\*\/\s*export\s+(?:declare\s+)?(?:function|class|const|let|var)\s+([A-Z][A-Za-z0-9]*)\b/g;

  for (const match of content.matchAll(pattern)) {
    deprecatedExports.push({
      name: match[2],
      note: match[1],
    });
  }

  return deprecatedExports;
}

function hasMigrationNote(note: string): boolean {
  return /\b(use|instead|replace(?:d)? by|renamed to|migrate to)\b/i.test(note);
}
