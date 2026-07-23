import { findDocOrExampleCarrier } from "../documentation-evidence.ts";
import type { AuditCheck, AuditContext, CheckResult } from "../types.ts";
import { formatCarrierCitations, formatNames } from "./support.ts";

export const deprecationZombieExportsCheck: AuditCheck = {
  id: "deprecation.zombie-exports",
  category: "deprecation",
  severity: "info",
  scored: false,
  signal: "trap surface",
  carriers: ["barrel exports", "docs", "stories"],
  measure: "exports in barrel but absent from docs/stories, listed",
  fix: "Document, deprecate, or remove zombie exports.",
  naBehavior: "Reported but not scored in v0.",
  receipt: "Zombie exports are trap surface for training-data gravity.",
  run(context: AuditContext): CheckResult {
    const files = context.files;
    const exported = context.exportedSymbols.filter((symbol) => symbol.kind === "value");
    const resolutions = exported.map((symbol) => ({ symbol, carrierFile: findDocOrExampleCarrier(symbol.name, files) }));
    const zombies = resolutions.filter((resolution) => resolution.carrierFile === null).map((resolution) => resolution.symbol);
    const citations = resolutions
      .filter((resolution) => resolution.carrierFile !== null)
      .map((resolution) => ({ name: resolution.symbol.name, carrierFile: resolution.carrierFile as string }));
    const baseDetail = `${zombies.length} barrel ${zombies.length === 1 ? "export is" : "exports are"} absent from docs/stories: ${formatNames(
      zombies.map((symbol) => symbol.name),
    )}`;

    return {
      outcome: zombies.length === 0 ? "pass" : "fail",
      score: null,
      measure: {
        kind: "count",
        value: zombies.length,
        detail: citations.length === 0 ? baseDetail : `${baseDetail}; docs/story presence resolved via file: ${formatCarrierCitations(citations)}`,
      },
      evidence: zombies.map((symbol) => symbol.name).slice(0, 20),
    };
  },
};
