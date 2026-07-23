import { findDocOrExampleCarrier, findIncidentalDocOrExampleCarrier } from "../documentation-evidence.ts";
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
    const resolutions = exported.map((symbol) => {
      const carrierFile = findDocOrExampleCarrier(symbol.name, files);
      return {
        symbol,
        carrierFile,
        incidentalFile: carrierFile ? null : findIncidentalDocOrExampleCarrier(symbol.name, files),
      };
    });
    const zombies = resolutions.filter((resolution) => resolution.carrierFile === null).map((resolution) => resolution.symbol);
    const citations = resolutions
      .filter((resolution) => resolution.carrierFile !== null)
      .map((resolution) => ({ name: resolution.symbol.name, carrierFile: resolution.carrierFile as string }));
    const incidentalCitations = resolutions
      .filter((resolution) => resolution.carrierFile === null && resolution.incidentalFile !== null)
      .map((resolution) => ({ name: resolution.symbol.name, carrierFile: resolution.incidentalFile as string }));
    const baseDetail = `${zombies.length} barrel ${zombies.length === 1 ? "export is" : "exports are"} absent from docs/stories: ${formatNames(
      zombies.map((symbol) => symbol.name),
    )}`;
    const details = [baseDetail];
    if (citations.length > 0) {
      details.push(`docs/story presence resolved via file: ${formatCarrierCitations(citations)}`);
    }
    if (incidentalCitations.length > 0) {
      details.push(`incidental mentions ignored: ${formatCarrierCitations(incidentalCitations)}`);
    }

    return {
      outcome: zombies.length === 0 ? "pass" : "fail",
      score: null,
      measure: {
        kind: "count",
        value: zombies.length,
        detail: details.join("; "),
      },
      evidence: zombies.map((symbol) => symbol.name).slice(0, 20),
    };
  },
};
