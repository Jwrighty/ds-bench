import { listTextFiles } from "../file-system.ts";
import type { AuditCheck, CheckContext, CheckResult } from "../types.ts";
import { formatNames, roundRatio } from "./support.ts";
import { getTokenSources } from "./token-sources.ts";

export const tokensMachineReadableCheck: AuditCheck = {
  id: "tokens.machine-readable",
  category: "tokens",
  severity: "warning",
  signal: "token availability to tools",
  carriers: ["DTCG files", "token packages", "CSS custom properties"],
  measure: "token source present and parseable; DTCG schema-valid where claimed",
  fix: "Publish tokens in a machine-readable format.",
  naBehavior: "Never N/A; missing machine-readable token sources are a scored token hygiene gap.",
  receipt: "Machine-readable tokens are the theming signal agents can consume.",
  run(context: CheckContext): CheckResult {
    const files = context.files ?? listTextFiles(context.targetPath);
    const sources = getTokenSources(files);

    if (sources.length === 0) {
      return {
        outcome: "fail",
        score: 0,
        measure: {
          kind: "ratio",
          value: 0,
          detail: "0/0 token sources are present and parseable; invalid: no machine-readable token source found",
        },
        evidence: ["no machine-readable token source found"],
      };
    }

    const invalid = sources.filter((source) => !source.valid);
    const validCount = sources.length - invalid.length;
    const ratio = validCount / sources.length;
    const invalidEvidence = invalid.map((source) => `${source.relativePath} (${source.invalidReason ?? "invalid token source"})`);

    return {
      outcome: invalid.length === 0 ? "pass" : "fail",
      score: ratio,
      measure: {
        kind: "ratio",
        value: roundRatio(ratio),
        detail: `${validCount}/${sources.length} token sources are present and parseable; invalid: ${formatNames(invalidEvidence)}`,
      },
      evidence: invalidEvidence.slice(0, 20),
    };
  },
};
