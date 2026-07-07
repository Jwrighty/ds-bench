import { extname } from "node:path";
import { listTextFiles } from "../file-system.ts";
import type { AuditCheck, CheckContext, CheckResult } from "../types.ts";
import { formatNames, roundRatio } from "./support.ts";

type StyleSignal = {
  value: string;
  file: string;
  line: number;
};

export const tokensHardcodedValuesCheck: AuditCheck = {
  id: "tokens.hardcoded-values",
  category: "tokens",
  severity: "warning",
  signal: "token discipline in design-system source",
  carriers: ["CSS files", "CSS-in-JS", "style props"],
  measure: "magic colors/spacing/z-index per 100 style-LOC vs token references",
  fix: "Replace named hardcoded colors, spacing, and z-index values with token references.",
  naBehavior: "Never N/A; absence of tokenized style carriers fails the token hygiene signal.",
  receipt: "Agents imitate the system's own styling habits; hardcoded source values become copied output.",
  run(context: CheckContext): CheckResult {
    const files = listTextFiles(context.targetPath);
    const styleFiles = files.filter((file) => isStyleCarrier(file.relativePath, file.content));
    const styleLoc = styleFiles.reduce((sum, file) => sum + countStyleLines(file.content), 0);
    const hardcoded = styleFiles.flatMap((file) => getHardcodedValues(file.relativePath, file.content));
    const tokenReferences = styleFiles.reduce((sum, file) => sum + countTokenReferences(file.content), 0);

    if (styleLoc === 0) {
      return {
        outcome: "fail",
        score: 0,
        measure: {
          kind: "count",
          value: 0,
          detail: "0 style LOC found; no token references available to compare against.",
        },
        evidence: [],
      };
    }

    const density = (hardcoded.length / styleLoc) * 100;
    const score = hardcoded.length === 0 ? 1 : tokenReferences / (tokenReferences + hardcoded.length);

    return {
      outcome: hardcoded.length === 0 ? "pass" : "fail",
      score,
      measure: {
        kind: "count",
        value: roundRatio(density),
        detail: `${hardcoded.length} magic values across ${styleLoc} style LOC (${roundRatio(density)} per 100 LOC); token references: ${tokenReferences}; offenders: ${formatNames(hardcoded.map(formatSignal))}`,
      },
      evidence: hardcoded.map(formatSignal).slice(0, 20),
    };
  },
};

function isStyleCarrier(relativePath: string, content: string): boolean {
  const extension = extname(relativePath);
  return [".css", ".scss", ".sass", ".less"].includes(extension) || /\b(?:css|styled|style|className)\b|style=\{\{/.test(content);
}

function countStyleLines(content: string): number {
  return content
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .filter((line) => /[:{}`]|style=\{\{|var\(--|tokens?\.|theme\./.test(line)).length;
}

function getHardcodedValues(relativePath: string, content: string): StyleSignal[] {
  const signals: StyleSignal[] = [];
  const patterns = [
    /#[0-9a-fA-F]{3,8}\b/g,
    /\b(?:rgb|rgba|hsl|hsla)\([^)]+\)/g,
    /\b(?:margin|padding|gap|top|right|bottom|left|width|height|minWidth|minHeight|maxWidth|maxHeight|borderRadius|fontSize|lineHeight)\s*[:=]\s*["']?(-?\d+(?:\.\d+)?(?:px|rem|em))\b/g,
    /\bzIndex\s*[:=]\s*["']?(\d+)\b/g,
    /\bz-index\s*:\s*(\d+)\b/g,
  ];

  content.split(/\r?\n/).forEach((line, index) => {
    for (const pattern of patterns) {
      for (const match of line.matchAll(pattern)) {
        signals.push({
          value: match[1] ?? match[0],
          file: relativePath,
          line: index + 1,
        });
      }
    }
  });

  return signals;
}

function countTokenReferences(content: string): number {
  return Array.from(content.matchAll(/\b(?:token|tokens|theme)\.|var\(--|(?:color|space|spacing|size|radius|zIndex|z-index)\.[A-Za-z0-9_.-]+/g)).length;
}

function formatSignal(signal: StyleSignal): string {
  return `${signal.value} in ${signal.file}:${signal.line}`;
}
