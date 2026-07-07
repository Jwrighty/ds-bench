import { basename, dirname, extname } from "node:path";
import { isRecord, type TextFile } from "../file-system.ts";

export type TokenSource = {
  relativePath: string;
  tokenNames: string[];
  valid: boolean;
  invalidReason: string | null;
};

const STYLE_EXTENSIONS = new Set([".css", ".scss", ".sass", ".less"]);
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mts", ".cts"]);
const TOKEN_FILE_NAME = /(?:^|[-_.])(?:tokens?|theme)(?:[-_.]|$)/i;
const DTCG_TYPES = new Set([
  "border",
  "color",
  "cubicBezier",
  "dimension",
  "duration",
  "fontFamily",
  "fontWeight",
  "gradient",
  "number",
  "shadow",
  "strokeStyle",
  "transition",
  "typography",
]);

export function getTokenSources(files: TextFile[]): TokenSource[] {
  const tokenPackageRoots = getTokenPackageRoots(files);
  const sources: TokenSource[] = [];

  for (const file of files) {
    const extension = extname(file.relativePath);

    if (extension === ".json" && file.relativePath.endsWith("package.json") === false && isTokenJsonCandidate(file)) {
      sources.push(readJsonTokenSource(file));
      continue;
    }

    if (STYLE_EXTENSIONS.has(extension)) {
      const cssTokenNames = getCssCustomPropertyNames(file.content);
      if (cssTokenNames.length > 0) {
        sources.push({
          relativePath: file.relativePath,
          tokenNames: cssTokenNames,
          valid: true,
          invalidReason: null,
        });
      }
      continue;
    }

    if (SOURCE_EXTENSIONS.has(extension) && isInsideTokenPackage(file.relativePath, tokenPackageRoots)) {
      const sourceTokenNames = getObjectPropertyTokenNames(file.content);
      if (sourceTokenNames.length > 0) {
        sources.push({
          relativePath: file.relativePath,
          tokenNames: sourceTokenNames,
          valid: true,
          invalidReason: null,
        });
      }
    }
  }

  return sources;
}

function getTokenPackageRoots(files: TextFile[]): string[] {
  return files
    .filter((file) => file.relativePath.endsWith("package.json"))
    .flatMap((file) => {
      try {
        const packageJson = JSON.parse(file.content) as unknown;
        if (isRecord(packageJson) && typeof packageJson.name === "string" && /\b(?:tokens?|theme)\b/i.test(packageJson.name)) {
          return [dirname(file.relativePath) === "." ? "" : dirname(file.relativePath)];
        }
      } catch {
        return [];
      }

      return [];
    });
}

function isInsideTokenPackage(relativePath: string, roots: string[]): boolean {
  return roots.some((root) => root === "" || relativePath.startsWith(`${root}/`));
}

function isTokenJsonCandidate(file: TextFile): boolean {
  return TOKEN_FILE_NAME.test(basename(file.relativePath)) || /"\$(?:value|type|schema)"\s*:/.test(file.content);
}

function readJsonTokenSource(file: TextFile): TokenSource {
  let parsed: unknown;
  try {
    parsed = JSON.parse(file.content) as unknown;
  } catch {
    return {
      relativePath: file.relativePath,
      tokenNames: [],
      valid: false,
      invalidReason: "invalid JSON",
    };
  }

  const tokenNames = getDtcgTokenNames(parsed);
  const validationError = claimsDtcg(parsed) ? validateDtcgTokens(parsed) : null;

  return {
    relativePath: file.relativePath,
    tokenNames,
    valid: validationError === null,
    invalidReason: validationError,
  };
}

function claimsDtcg(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some(claimsDtcg);
  }

  if (!isRecord(value)) {
    return false;
  }

  if (typeof value.$schema === "string" && /\b(?:design-tokens|dtcg|tokens)\b/i.test(value.$schema)) {
    return true;
  }

  if (Object.hasOwn(value, "$value") || Object.hasOwn(value, "$type")) {
    return true;
  }

  return Object.values(value).some(claimsDtcg);
}

function getDtcgTokenNames(value: unknown): string[] {
  const names: string[] = [];
  collectDtcgTokenNames(value, [], names);
  return names;
}

function collectDtcgTokenNames(value: unknown, path: string[], names: string[]): void {
  if (Array.isArray(value) || !isRecord(value)) {
    return;
  }

  if (Object.hasOwn(value, "$value")) {
    names.push(path.join("."));
    return;
  }

  for (const [key, nested] of Object.entries(value)) {
    if (key.startsWith("$")) {
      continue;
    }

    collectDtcgTokenNames(nested, [...path, key], names);
  }
}

function validateDtcgTokens(value: unknown): string | null {
  return validateDtcgValue(value, [], null);
}

function validateDtcgValue(value: unknown, path: string[], inheritedType: string | null): string | null {
  if (Array.isArray(value) || !isRecord(value)) {
    return null;
  }

  const type = typeof value.$type === "string" ? value.$type : inheritedType;
  if (Object.hasOwn(value, "$value")) {
    if (!type) {
      return `DTCG token ${path.join(".") || "(root)"} is missing $type`;
    }

    if (!DTCG_TYPES.has(type)) {
      return `DTCG token ${path.join(".") || "(root)"} has unknown $type ${type}`;
    }

    return validateDtcgTokenValue(value.$value, type, path.join(".") || "(root)");
  }

  for (const [key, nested] of Object.entries(value)) {
    if (key.startsWith("$")) {
      continue;
    }

    const error = validateDtcgValue(nested, [...path, key], type);
    if (error) {
      return error;
    }
  }

  return null;
}

function validateDtcgTokenValue(value: unknown, type: string, name: string): string | null {
  if (isAliasValue(value)) {
    return null;
  }

  if (type === "color" && typeof value === "string" && !/^(?:#[0-9a-fA-F]{3,8}|(?:rgb|rgba|hsl|hsla)\([^)]+\))$/.test(value)) {
    return `DTCG token ${name} has non-color $value`;
  }

  if (type === "dimension" && typeof value !== "number" && !(typeof value === "string" && /^-?\d+(?:\.\d+)?(?:px|rem|em|%|vh|vw|s|ms)$/.test(value))) {
    return `DTCG token ${name} has non-dimension $value`;
  }

  if (type === "number" && typeof value !== "number") {
    return `DTCG token ${name} has non-number $value`;
  }

  return null;
}

function isAliasValue(value: unknown): boolean {
  return typeof value === "string" && /^\{[^}]+\}$/.test(value);
}

function getCssCustomPropertyNames(content: string): string[] {
  return Array.from(content.matchAll(/--([A-Za-z0-9_.-]+)\s*:/g), (match) => match[1]);
}

function getObjectPropertyTokenNames(content: string): string[] {
  const names = Array.from(content.matchAll(/["']?([A-Za-z][A-Za-z0-9_.-]*)["']?\s*:/g), (match) => match[1]).filter(
    (name) => !["value", "type", "description"].includes(name),
  );

  return Array.from(new Set(names));
}
