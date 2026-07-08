import ts from "typescript";
import { basename, dirname, extname } from "node:path";
import { scopeFilesToLibraryPackages } from "./component-inventory.ts";
import { isRecord, walkJson, SOURCE_EXTENSIONS, STYLE_EXTENSIONS, type TextFile } from "./file-system.ts";

export type TokenSourceKind = "json" | "css" | "source";

export type TokenSource = {
  relativePath: string;
  kind: TokenSourceKind;
  tokenNames: string[];
  valid: boolean;
  invalidReason: string | null;
};

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
  const scopedFiles = scopeFilesToLibraryPackages(files, { includeRootFiles: true });
  const tokenPackageRoots = getTokenPackageRoots(files);
  const tokenPackagesWithDataSources = getTokenPackageRootsWithDataSources(scopedFiles, tokenPackageRoots);
  const sources: TokenSource[] = [];

  for (const file of scopedFiles) {
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
          kind: "css",
          tokenNames: cssTokenNames,
          valid: true,
          invalidReason: null,
        });
      }
      continue;
    }

    if (
      SOURCE_EXTENSIONS.has(extension) &&
      isInsideTokenPackage(file.relativePath, tokenPackageRoots) &&
      !isInsideTokenPackage(file.relativePath, tokenPackagesWithDataSources)
    ) {
      const sourceTokenNames = getObjectPropertyTokenNames(file.content);
      if (sourceTokenNames.length > 0) {
        sources.push({
          relativePath: file.relativePath,
          kind: "source",
          tokenNames: sourceTokenNames,
          valid: true,
          invalidReason: null,
        });
      }
    }
  }

  return sources;
}

function getTokenPackageRootsWithDataSources(files: TextFile[], tokenPackageRoots: string[]): string[] {
  const roots = new Set<string>();

  for (const file of files) {
    const extension = extname(file.relativePath);
    const root = getContainingTokenPackageRoot(file.relativePath, tokenPackageRoots);
    if (root === null) {
      continue;
    }

    if (
      (extension === ".json" && file.relativePath.endsWith("package.json") === false && isTokenJsonCandidate(file)) ||
      (STYLE_EXTENSIONS.has(extension) && getCssCustomPropertyNames(file.content).length > 0)
    ) {
      roots.add(root);
    }
  }

  return Array.from(roots);
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

function getContainingTokenPackageRoot(relativePath: string, roots: string[]): string | null {
  const matchingRoots = roots.filter((root) => root === "" || relativePath.startsWith(`${root}/`));
  if (matchingRoots.length === 0) {
    return null;
  }

  return matchingRoots.sort((left, right) => right.length - left.length)[0];
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
      kind: "json",
      tokenNames: [],
      valid: false,
      invalidReason: "invalid JSON",
    };
  }

  const tokenNames = getDtcgTokenNames(parsed);
  const validationError = claimsDtcg(parsed) ? validateDtcgTokens(parsed) : null;

  return {
    relativePath: file.relativePath,
    kind: "json",
    tokenNames,
    valid: validationError === null,
    invalidReason: validationError,
  };
}

function claimsDtcg(value: unknown): boolean {
  let claims = false;
  walkJson(value, (node) => {
    if (isRecord(node)) {
      claims =
        claims ||
        (typeof node.$schema === "string" && /\b(?:design-tokens|dtcg|tokens)\b/i.test(node.$schema)) ||
        Object.hasOwn(node, "$value") ||
        Object.hasOwn(node, "$type");
    }

    return !claims;
  });

  return claims;
}

function getDtcgTokenNames(value: unknown): string[] {
  const names: string[] = [];
  walkJson(value, (node, path) => {
    // DTCG token trees are pure records; arrays and "$"-prefixed keys ($extensions, ...) never hold groups.
    if (Array.isArray(node) || !isRecord(node) || path[path.length - 1]?.startsWith("$")) {
      return false;
    }

    if (Object.hasOwn(node, "$value")) {
      names.push(path.join("."));
      return false;
    }

    return true;
  });

  return names;
}

function validateDtcgTokens(value: unknown): string | null {
  const errors = validateDtcgValue(value, [], null);
  return errors.length === 0 ? null : errors.join("; ");
}

function validateDtcgValue(value: unknown, path: string[], inheritedType: string | null): string[] {
  if (Array.isArray(value) || !isRecord(value)) {
    return [];
  }

  const type = typeof value.$type === "string" ? value.$type : inheritedType;
  if (Object.hasOwn(value, "$value")) {
    if (!type) {
      return [`DTCG token ${path.join(".") || "(root)"} is missing $type`];
    }

    if (!DTCG_TYPES.has(type)) {
      return [`DTCG token ${path.join(".") || "(root)"} has unknown $type ${type}`];
    }

    const tokenValueError = validateDtcgTokenValue(value.$value, type, path.join(".") || "(root)");
    return tokenValueError ? [tokenValueError] : [];
  }

  const errors: string[] = [];
  for (const [key, nested] of Object.entries(value)) {
    if (key.startsWith("$")) {
      continue;
    }

    errors.push(...validateDtcgValue(nested, [...path, key], type));
  }

  return errors;
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
  const sourceFile = ts.createSourceFile("tokens.ts", content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const names = new Set<string>();

  const collectFromCandidate = (node: ts.ObjectLiteralExpression, forceTokenTree: boolean) => {
    const tokenNames = collectObjectLiteralTokenNames(node);
    if (forceTokenTree || tokenNames.length > 1 || hasDtcgValueRecord(node)) {
      for (const name of tokenNames) {
        names.add(name);
      }
    }
  };

  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer && ts.isObjectLiteralExpression(node.initializer)) {
      if (isTokenRootName(node.name.text)) {
        collectFromCandidate(node.initializer, true);
      }
    } else if (ts.isPropertyAssignment(node) && ts.isObjectLiteralExpression(node.initializer) && isTokenPropertyName(node.name)) {
      collectFromCandidate(node.initializer, true);
    } else if (ts.isExportAssignment(node) && ts.isObjectLiteralExpression(node.expression)) {
      collectFromCandidate(node.expression, false);
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  return Array.from(names);
}

function collectObjectLiteralTokenNames(node: ts.ObjectLiteralExpression, path: string[] = []): string[] {
  if (hasDtcgValueRecord(node)) {
    return path.length > 0 ? [path.join(".")] : [];
  }

  const names: string[] = [];
  for (const property of node.properties) {
    if (!ts.isPropertyAssignment(property)) {
      continue;
    }

    const propertyName = getPropertyNameText(property.name);
    if (!propertyName || propertyName.startsWith("$") || ["value", "type", "description"].includes(propertyName)) {
      continue;
    }

    const nestedPath = [...path, propertyName];
    if (ts.isObjectLiteralExpression(property.initializer)) {
      names.push(...collectObjectLiteralTokenNames(property.initializer, nestedPath));
    } else if (isPrimitiveTokenLeaf(property.initializer)) {
      names.push(nestedPath.join("."));
    }
  }

  return names;
}

function hasDtcgValueRecord(node: ts.ObjectLiteralExpression): boolean {
  return node.properties.some((property) => ts.isPropertyAssignment(property) && getPropertyNameText(property.name) === "$value");
}

function isPrimitiveTokenLeaf(node: ts.Expression): boolean {
  return ts.isStringLiteralLike(node) || ts.isNumericLiteral(node) || node.kind === ts.SyntaxKind.TrueKeyword || node.kind === ts.SyntaxKind.FalseKeyword;
}

function isTokenPropertyName(name: ts.PropertyName): boolean {
  const text = getPropertyNameText(name);
  return text !== null && isTokenRootName(text);
}

function isTokenRootName(name: string): boolean {
  return /(?:^|[-_.])(?:tokens?|theme)(?:[-_.]|$)/i.test(name);
}

function getPropertyNameText(name: ts.PropertyName): string | null {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }

  return null;
}
