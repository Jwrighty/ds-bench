import { listTextFiles } from "../file-system.ts";
import type { AuditCheck, CheckContext, CheckResult } from "../types.ts";
import { formatNames, roundRatio } from "./support.ts";
import { getTokenSources } from "./token-sources.ts";

type NamingPattern = "kebab" | "dot" | "snake" | "camel" | "unknown";

const PATTERN_ORDER: NamingPattern[] = ["kebab", "dot", "snake", "camel", "unknown"];

export const tokensNamingConsistencyCheck: AuditCheck = {
  id: "tokens.naming-consistency",
  category: "tokens",
  severity: "info",
  signal: "token predictability",
  carriers: ["token source"],
  measure: "naming-pattern violation rate against the system's own dominant pattern",
  fix: "Rename token outliers to the dominant pattern.",
  naBehavior: "N/A when no token names are available from machine-readable token sources.",
  receipt: "Inconsistent names invite fabricated tokens.",
  run(context: CheckContext): CheckResult {
    const files = context.files ?? listTextFiles(context.targetPath);
    const tokenNames = getTokenSources(files).flatMap((source) => source.tokenNames);

    if (tokenNames.length === 0) {
      return {
        outcome: "fail",
        score: 0,
        measure: {
          kind: "ratio",
          value: 1,
          detail: "0 token names found; no dominant naming pattern can be derived.",
        },
        evidence: ["no token names found"],
      };
    }

    const dominantPattern = getDominantPattern(tokenNames);
    const offenders = tokenNames.filter((name) => classifyName(name) !== dominantPattern);
    const violationRate = offenders.length / tokenNames.length;

    return {
      outcome: offenders.length === 0 ? "pass" : "fail",
      score: 1 - violationRate,
      measure: {
        kind: "ratio",
        value: roundRatio(violationRate),
        detail: `${offenders.length}/${tokenNames.length} token names violate the dominant ${dominantPattern} pattern; offenders: ${formatNames(
          offenders,
        )}`,
      },
      evidence: offenders.slice(0, 20),
    };
  },
};

function getDominantPattern(names: string[]): NamingPattern {
  const counts = new Map<NamingPattern, number>();
  for (const name of names) {
    const pattern = classifyName(name);
    counts.set(pattern, (counts.get(pattern) ?? 0) + 1);
  }

  return [...PATTERN_ORDER].sort((left, right) => (counts.get(right) ?? 0) - (counts.get(left) ?? 0))[0];
}

function classifyName(name: string): NamingPattern {
  if (/^[a-z][a-z0-9]*(?:-[a-z0-9]+)+$/.test(name)) {
    return "kebab";
  }

  if (/^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*)+$/.test(name)) {
    return "dot";
  }

  if (/^[a-z][a-z0-9]*(?:_[a-z0-9]+)+$/.test(name)) {
    return "snake";
  }

  if (/^[a-z][A-Za-z0-9]*$/.test(name) && /[A-Z]/.test(name)) {
    return "camel";
  }

  return "unknown";
}
