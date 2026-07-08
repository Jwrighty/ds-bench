import { listTextFiles } from "../file-system.ts";
import type { AuditCheck, CheckContext, CheckResult } from "../types.ts";
import { formatNames, naResult, roundRatio } from "./support.ts";
import { getTokenSources, type TokenSourceKind } from "./token-sources.ts";

type NamingPattern = "kebab" | "dot-kebab" | "dot-snake" | "snake" | "camel" | "unknown";

const PATTERN_ORDER: NamingPattern[] = ["dot-kebab", "kebab", "dot-snake", "snake", "camel", "unknown"];

export const tokensNamingConsistencyCheck: AuditCheck = {
  id: "tokens.naming-consistency",
  category: "tokens",
  severity: "info",
  signal: "token predictability",
  carriers: ["token source"],
  measure: "naming-pattern violation rate against the system's own dominant pattern",
  fix: "Rename token outliers to the dominant pattern.",
  naBehavior:
    "N/A when no token names are available from machine-readable token sources (then tokens.machine-readable carries the gap), or when token names use an unmodeled convention the classifier cannot score (uncovered).",
  naReason: "uncovered",
  receipt: "Inconsistent names invite fabricated tokens.",
  run(context: CheckContext): CheckResult {
    const files = context.files ?? listTextFiles(context.targetPath);
    const tokenSources = getTokenSources(files);
    const tokenNames = tokenSources.flatMap((source) => source.tokenNames);

    if (tokenNames.length === 0) {
      return naResult("ratio", "No token names found; naming consistency is not applicable (tokens.machine-readable carries the missing-token-source gap).");
    }

    const carrierResults = getCarrierNamingResults(tokenSources);
    const scoredResults = carrierResults.filter((result) => result.dominantPattern !== "unknown");
    if (scoredResults.length === 0) {
      return naResult("ratio", "Token names use an unmodeled naming convention; naming consistency is not applicable until the classifier is taught that convention.");
    }

    const offenders = scoredResults.flatMap((result) => result.offenders);
    const scoredCount = scoredResults.reduce((total, result) => total + result.names.length, 0);
    const violationRate = offenders.length / scoredCount;
    const detail =
      scoredResults.length === 1
        ? `${offenders.length}/${scoredCount} token names violate the dominant ${scoredResults[0].dominantPattern} pattern; offenders: ${formatNames(offenders)}`
        : `${offenders.length}/${scoredCount} token names violate carrier-local dominant patterns (${formatCarrierResults(scoredResults)}); offenders: ${formatNames(
            offenders,
          )}`;

    return {
      outcome: offenders.length === 0 ? "pass" : "fail",
      score: 1 - violationRate,
      measure: {
        kind: "ratio",
        value: roundRatio(violationRate),
        detail,
      },
      evidence: offenders.slice(0, 20),
    };
  },
};

type CarrierNamingResult = {
  kind: TokenSourceKind;
  names: string[];
  dominantPattern: NamingPattern;
  offenders: string[];
};

function getCarrierNamingResults(sources: ReturnType<typeof getTokenSources>): CarrierNamingResult[] {
  const namesByKind = new Map<TokenSourceKind, string[]>();
  for (const source of sources) {
    namesByKind.set(source.kind, [...(namesByKind.get(source.kind) ?? []), ...source.tokenNames]);
  }

  return Array.from(namesByKind.entries()).map(([kind, names]) => {
    const dominantPattern = getDominantPattern(names);
    return {
      kind,
      names,
      dominantPattern,
      offenders: dominantPattern === "unknown" ? [] : names.filter((name) => classifyName(name) !== dominantPattern),
    };
  });
}

function formatCarrierResults(results: CarrierNamingResult[]): string {
  return results
    .map((result) => `${formatCarrierKind(result.kind)}: ${result.offenders.length}/${result.names.length} ${result.dominantPattern}`)
    .join("; ");
}

function formatCarrierKind(kind: TokenSourceKind): string {
  if (kind === "json") {
    return "DTCG JSON";
  }

  if (kind === "css") {
    return "CSS custom properties";
  }

  return "TS/JS objects";
}

function getDominantPattern(names: string[]): NamingPattern {
  const counts = new Map<NamingPattern, number>();
  for (const name of names) {
    const pattern = classifyName(name);
    counts.set(pattern, (counts.get(pattern) ?? 0) + 1);
  }

  return [...PATTERN_ORDER].sort((left, right) => (counts.get(right) ?? 0) - (counts.get(left) ?? 0))[0];
}

function classifyName(name: string): NamingPattern {
  const dotSegments = name.split(".");
  if (dotSegments.length > 1 && dotSegments.every(isKebabSegment)) {
    return "dot-kebab";
  }

  if (dotSegments.length > 1 && dotSegments.every(isSnakeSegment)) {
    return "dot-snake";
  }

  if (isKebabName(name)) {
    return "kebab";
  }

  if (isSnakeName(name)) {
    return "snake";
  }

  if (/^[a-z][A-Za-z0-9]*$/.test(name) && /[A-Z]/.test(name)) {
    return "camel";
  }

  return "unknown";
}

function isKebabName(name: string): boolean {
  return name.includes("-") && name.split("-").every(isLowerOrNumericSegment);
}

function isKebabSegment(segment: string): boolean {
  return segment.split("-").every(isLowerOrNumericSegment);
}

function isSnakeName(name: string): boolean {
  return name.includes("_") && name.split("_").every(isLowerOrNumericSegment);
}

function isSnakeSegment(segment: string): boolean {
  return segment.split("_").every(isLowerOrNumericSegment);
}

function isLowerOrNumericSegment(segment: string): boolean {
  return /^[a-z][a-z0-9]*$/.test(segment) || /^[0-9]+$/.test(segment);
}
