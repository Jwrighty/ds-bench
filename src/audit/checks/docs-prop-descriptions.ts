import { getExportedSymbols, COMPONENT_NAME } from "../component-inventory.ts";
import { isRecord, listTextFiles, type TextFile } from "../file-system.ts";
import type { AuditCheck, CheckContext, CheckResult } from "../types.ts";
import { formatNames, hasCommentDescription, roundRatio } from "./support.ts";

type PropField = {
  name: string;
  described: boolean;
};

export const docsPropDescriptionsCheck: AuditCheck = {
  id: "docs.prop-descriptions",
  category: "docs",
  severity: "warning",
  signal: "prop documentation",
  carriers: ["JSDoc/TSDoc", "manifest prop docs"],
  measure: "% exported components whose public props carry descriptions",
  fix: "Add TSDoc descriptions to public props, starting with the most-used components.",
  naBehavior: "Never N/A; undocumented public props are a scored docs gap.",
  receipt: "Agents invent props when public prop contracts lack descriptions.",
  run(context: CheckContext): CheckResult {
    const files = context.files ?? listTextFiles(context.targetPath);
    const filesByPath = new Map(files.map((file) => [file.relativePath, file]));
    const componentSymbols = getExportedSymbols(files).filter((symbol) => symbol.kind === "value" && COMPONENT_NAME.test(symbol.name));

    if (componentSymbols.length === 0) {
      return {
        outcome: "fail",
        score: 0,
        measure: {
          kind: "ratio",
          value: 0,
          detail: "0/0 exported components have documented public props; missing: no exports found",
        },
        evidence: [],
      };
    }

    const covered = new Set<string>();
    const evidence: string[] = [];

    for (const symbol of componentSymbols) {
      const file = filesByPath.get(symbol.relativePath);
      const props = file ? getPropsForComponent(file.content, symbol.name) : [];
      const manifestDescriptions = getManifestPropDescriptions(files, symbol.name);
      const missingProps = props.filter((prop) => !prop.described && !manifestDescriptions.has(prop.name));

      if (missingProps.length === 0) {
        covered.add(symbol.name);
      } else {
        evidence.push(`${symbol.name}: ${formatNames(missingProps.map((prop) => prop.name))}`);
      }
    }

    const missing = componentSymbols.map((symbol) => symbol.name).filter((component) => !covered.has(component));
    const ratio = covered.size / componentSymbols.length;

    return {
      outcome: missing.length === 0 ? "pass" : "fail",
      score: ratio,
      measure: {
        kind: "ratio",
        value: roundRatio(ratio),
        detail: `${covered.size}/${componentSymbols.length} exported components have documented public props; missing: ${formatNames(missing)}`,
      },
      evidence: evidence.slice(0, 20),
    };
  },
};

function getPropsForComponent(content: string, componentName: string): PropField[] {
  const explicitType = findComponentPropsType(content, componentName);
  const conventionalType = `${componentName}Props`;
  const propsTypeName = explicitType ?? (hasPropsType(content, conventionalType) ? conventionalType : null);

  if (!propsTypeName) {
    return [];
  }

  return getPropsForType(content, propsTypeName);
}

function findComponentPropsType(content: string, componentName: string): string | null {
  const escapedName = escapeRegExp(componentName);
  const functionMatch = new RegExp(`\\bfunction\\s+${escapedName}\\s*\\((?<params>[^)]*)\\)`).exec(content);
  const functionType = propsTypeFromParams(functionMatch?.groups?.params ?? "");
  if (functionType) {
    return functionType;
  }

  const constMatch = new RegExp(
    `\\bconst\\s+${escapedName}\\s*(?::\\s*(?:React\\.)?(?:FC|FunctionComponent)<(?<fcType>[A-Za-z_$][A-Za-z0-9_$]*)>)?\\s*=\\s*(?:\\((?<params>[^)]*)\\)|(?<singleParam>[A-Za-z_$][A-Za-z0-9_$]*(?:\\s*:\\s*[A-Za-z_$][A-Za-z0-9_$]*)?))\\s*=>`,
  ).exec(content);

  return constMatch?.groups?.fcType ?? propsTypeFromParams(constMatch?.groups?.params ?? constMatch?.groups?.singleParam ?? "");
}

function propsTypeFromParams(params: string): string | null {
  return /:\s*(?<typeName>[A-Za-z_$][A-Za-z0-9_$]*)\b/.exec(params)?.groups?.typeName ?? null;
}

function hasPropsType(content: string, typeName: string): boolean {
  const escapedName = escapeRegExp(typeName);
  return new RegExp(`\\b(?:type|interface)\\s+${escapedName}\\b`).test(content);
}

function getPropsForType(content: string, typeName: string): PropField[] {
  const body = getTypeBody(content, typeName);
  if (!body) {
    return [];
  }

  const props: PropField[] = [];
  const propPattern = /(?<comment>\/\*\*[\s\S]*?\*\/\s*)?(?:readonly\s+)?(?<name>[A-Za-z_$][A-Za-z0-9_$]*|["'][^"']+["'])\??\s*[:(]/g;

  for (const match of body.matchAll(propPattern)) {
    if (braceDepthAt(body, match.index) !== 0) {
      continue;
    }

    const rawName = match.groups?.name;
    if (!rawName) {
      continue;
    }

    props.push({
      name: rawName.replace(/^["']|["']$/g, ""),
      described: hasCommentDescription(match.groups?.comment ?? ""),
    });
  }

  return props;
}

function braceDepthAt(content: string, targetIndex: number): number {
  let depth = 0;
  let inBlockComment = false;
  let stringQuote: string | null = null;

  for (let index = 0; index < targetIndex; index += 1) {
    const char = content[index];
    const next = content[index + 1];

    if (inBlockComment) {
      if (char === "*" && next === "/") {
        inBlockComment = false;
        index += 1;
      }
      continue;
    }

    if (stringQuote) {
      if (char === "\\") {
        index += 1;
      } else if (char === stringQuote) {
        stringQuote = null;
      }
      continue;
    }

    if (char === "/" && next === "*") {
      inBlockComment = true;
      index += 1;
    } else if (char === '"' || char === "'" || char === "`") {
      stringQuote = char;
    } else if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth = Math.max(0, depth - 1);
    }
  }

  return depth;
}

function getTypeBody(content: string, typeName: string): string | null {
  const escapedName = escapeRegExp(typeName);
  const declaration = new RegExp(`\\b(?:export\\s+)?(?:type\\s+${escapedName}\\s*=|interface\\s+${escapedName}(?:\\s+extends\\s+[^ {]+)?)\\s*\\{`).exec(content);
  if (!declaration) {
    return null;
  }

  return collectBraceBody(content, declaration.index + declaration[0].length - 1);
}

function collectBraceBody(content: string, openBraceIndex: number): string | null {
  let depth = 0;
  for (let index = openBraceIndex; index < content.length; index += 1) {
    const char = content[index];
    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return content.slice(openBraceIndex + 1, index);
      }
    }
  }

  return null;
}

function getManifestPropDescriptions(files: TextFile[], componentName: string): Set<string> {
  const descriptions = new Set<string>();

  for (const file of files.filter((candidate) => candidate.relativePath.endsWith(".json"))) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(file.content);
    } catch {
      continue;
    }

    collectManifestPropDescriptions(parsed, componentName, descriptions);
  }

  return descriptions;
}

function collectManifestPropDescriptions(value: unknown, componentName: string, descriptions: Set<string>): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectManifestPropDescriptions(item, componentName, descriptions);
    }
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  if (recordNamesComponent(value, componentName)) {
    collectPropDescriptions(value.props, descriptions);
    collectPropDescriptions(value.properties, descriptions);
  }

  for (const nested of Object.values(value)) {
    collectManifestPropDescriptions(nested, componentName, descriptions);
  }
}

function collectPropDescriptions(value: unknown, descriptions: Set<string>): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      if (isRecord(item) && typeof item.name === "string" && typeof item.description === "string" && item.description.trim().length > 0) {
        descriptions.add(item.name);
      }
    }
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  for (const [name, prop] of Object.entries(value)) {
    if (typeof prop === "string" && prop.trim().length > 0) {
      descriptions.add(name);
    } else if (isRecord(prop) && typeof prop.description === "string" && prop.description.trim().length > 0) {
      descriptions.add(name);
    }
  }
}

function recordNamesComponent(record: Record<string, unknown>, componentName: string): boolean {
  return ["name", "displayName", "exportName", "component"].some((field) => record[field] === componentName);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
