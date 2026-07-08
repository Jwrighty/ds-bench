import { extname } from "node:path";
import { scopeFilesToLibraryPackages } from "../component-inventory.ts";
import { listTextFiles, SOURCE_EXTENSIONS, STYLE_EXTENSIONS } from "../file-system.ts";
import type { AuditCheck, CheckContext, CheckResult } from "../types.ts";
import { isAuxiliarySurfacePath } from "./guidance-support.ts";
import { formatNames, naResult, roundRatio } from "./support.ts";

type HardcodedValue = {
  value: string;
  file: string;
  line: number;
};

const STYLE_FILE_EXTENSIONS = [".css", ".scss", ".sass", ".less"];

// Matches the opening line of a CSS-in-JS tagged template: styled.x`, styled(X)`, css`, keyframes`
const STYLE_TEMPLATE_OPEN = /\b(?:styled(?:\.[A-Za-z0-9_]+|\([^)]*\))|css|keyframes)\s*`/;
// Matches an inline style-object expression: style={{
const STYLE_OBJECT_OPEN = /\bstyle=\{\{/;

export const tokensHardcodedValuesCheck: AuditCheck = {
  id: "tokens.hardcoded-values",
  category: "tokens",
  severity: "warning",
  signal: "token discipline in design-system source",
  carriers: ["CSS files", "CSS-in-JS", "style props"],
  measure: "magic colors/spacing/z-index per 100 style-LOC vs token references",
  fix: "Replace named hardcoded colors, spacing, and z-index values with token references.",
  naBehavior: "N/A when zero style-LOC detected across all style carriers (clean).",
  naReason: "clean",
  receipt: "Agents imitate the system's own styling habits; hardcoded source values become copied output.",
  run(context: CheckContext): CheckResult {
    const files = context.files ?? listTextFiles(context.targetPath);
    const scopedFiles = scopeFilesToLibraryPackages(files).filter((file) => isStyleAuditableSource(file.relativePath));
    const styleContents = scopedFiles
      .map((file) => ({ relativePath: file.relativePath, styleContent: extractStyleContent(file.relativePath, file.content) }))
      .filter((file) => file.styleContent.length > 0);

    const styleLoc = styleContents.reduce((sum, file) => sum + countStyleLines(file.styleContent), 0);

    if (styleLoc === 0) {
      return naResult("count", "0 style LOC found across CSS files, CSS-in-JS, and style props; token discipline is not applicable.");
    }

    const hardcoded = styleContents.flatMap((file) => getHardcodedValues(file.relativePath, file.styleContent));
    const tokenReferences = styleContents.reduce((sum, file) => sum + countTokenReferences(file.styleContent), 0);

    const density = (hardcoded.length / styleLoc) * 100;
    const score = hardcoded.length === 0 ? 1 : tokenReferences / (tokenReferences + hardcoded.length);

    return {
      outcome: hardcoded.length === 0 ? "pass" : "fail",
      score,
      measure: {
        kind: "count",
        value: roundRatio(density),
        detail: `${hardcoded.length} magic values across ${styleLoc} style LOC (${roundRatio(density)} per 100 LOC); token references: ${tokenReferences}; offenders: ${formatNames(hardcoded.map(formatHardcodedValue))}`,
      },
      evidence: hardcoded.map(formatHardcodedValue).slice(0, 20),
    };
  },
};

/**
 * Returns the portion of a file's content that counts as style source.
 * CSS-family files contribute their entire content. TS/JS/TSX/JSX files
 * contribute only the text inside detected CSS-in-JS constructs (tagged
 * templates like styled.x`...`/css`...`/keyframes`...`, or style={{...}}
 * inline-style objects) — never the whole file.
 */
/**
 * True for files that carry the shipping styling surface agents imitate: style-family
 * files (.css/.scss/...) and code source (.ts/.tsx/.js/.jsx) that may hold CSS-in-JS.
 * Excludes non-style extensions (markdown/JSON/txt) and auxiliary test/story/config paths.
 */
function isStyleAuditableSource(relativePath: string): boolean {
  const extension = extname(relativePath);
  if (!STYLE_EXTENSIONS.has(extension) && !SOURCE_EXTENSIONS.has(extension)) {
    return false;
  }
  return !isAuxiliarySurfacePath(relativePath);
}

function extractStyleContent(relativePath: string, content: string): string {
  const extension = extname(relativePath);
  if (STYLE_FILE_EXTENSIONS.includes(extension)) {
    return content;
  }

  return extractCodeStyleConstructs(content).join("\n");
}

function extractCodeStyleConstructs(content: string): string[] {
  const lines = content.split(/\r?\n/);
  const constructs: string[] = [];

  let index = 0;
  while (index < lines.length) {
    const line = lines[index] ?? "";

    if (STYLE_TEMPLATE_OPEN.test(line)) {
      const { block, endIndex } = collectUntilClosingBacktick(lines, index);
      constructs.push(block);
      index = endIndex + 1;
      continue;
    }

    if (STYLE_OBJECT_OPEN.test(line)) {
      const { block, endIndex } = collectUntilClosingBrace(lines, index);
      constructs.push(block);
      index = endIndex + 1;
      continue;
    }

    index += 1;
  }

  return constructs;
}

// Collects lines from the opening tagged-template line to the line containing
// the closing backtick (a simple deterministic scan; no template-literal parser).
function collectUntilClosingBacktick(lines: string[], startIndex: number): { block: string; endIndex: number } {
  const openLine = lines[startIndex] ?? "";
  const openBacktickPos = openLine.indexOf("`");
  const rest = openLine.slice(openBacktickPos + 1);

  if (rest.includes("`")) {
    return { block: openLine, endIndex: startIndex };
  }

  const collected = [openLine];
  let endIndex = startIndex;
  for (let i = startIndex + 1; i < lines.length; i += 1) {
    const currentLine = lines[i] ?? "";
    collected.push(currentLine);
    endIndex = i;
    if (currentLine.includes("`")) {
      break;
    }
  }

  return { block: collected.join("\n"), endIndex };
}

// Collects lines from the opening `style={{` line to the line containing the
// closing `}}` (a simple deterministic brace-depth scan).
function collectUntilClosingBrace(lines: string[], startIndex: number): { block: string; endIndex: number } {
  const collected: string[] = [];
  let depth = 0;
  let endIndex = startIndex;
  let started = false;

  for (let i = startIndex; i < lines.length; i += 1) {
    const currentLine = lines[i] ?? "";
    collected.push(currentLine);
    endIndex = i;

    for (const char of currentLine) {
      if (char === "{") {
        depth += 1;
        started = true;
      } else if (char === "}") {
        depth -= 1;
      }
    }

    if (started && depth <= 0) {
      break;
    }
  }

  return { block: collected.join("\n"), endIndex };
}

function countStyleLines(styleContent: string): number {
  return styleContent
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .filter((line) => /[:{}`]|style=\{\{|var\(--|tokens?\.|theme\./.test(line)).length;
}

function getHardcodedValues(relativePath: string, styleContent: string): HardcodedValue[] {
  const hardcodedValues: HardcodedValue[] = [];
  const patterns = [
    /#[0-9a-fA-F]{3,8}\b/g,
    /\b(?:rgb|rgba|hsl|hsla)\([^)]+\)/g,
    /\b(?:margin|padding|gap|top|right|bottom|left|width|height|minWidth|minHeight|maxWidth|maxHeight|borderRadius|fontSize|lineHeight)\s*[:=]\s*["']?(-?\d+(?:\.\d+)?(?:px|rem|em))\b/g,
    /\bzIndex\s*[:=]\s*["']?(\d+)\b/g,
    /\bz-index\s*:\s*(\d+)\b/g,
  ];

  styleContent.split(/\r?\n/).forEach((line, index) => {
    for (const pattern of patterns) {
      for (const match of line.matchAll(pattern)) {
        hardcodedValues.push({
          value: match[1] ?? match[0],
          file: relativePath,
          line: index + 1,
        });
      }
    }
  });

  return hardcodedValues;
}

function countTokenReferences(styleContent: string): number {
  return Array.from(styleContent.matchAll(/\b(?:token|tokens|theme)\.|var\(--|(?:color|space|spacing|size|radius|zIndex|z-index)\.[A-Za-z0-9_.-]+/g)).length;
}

function formatHardcodedValue(hardcodedValue: HardcodedValue): string {
  return `${hardcodedValue.value} in ${hardcodedValue.file}:${hardcodedValue.line}`;
}
