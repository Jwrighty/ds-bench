import { dirname, extname, join } from "node:path";
import { escapeRegExp, type TextFile } from "./file-system.ts";

export type ComponentProp = {
  name: string;
  type: string;
  leadingComment: string;
};

export function hasTypeScriptTypes(files: TextFile[]): boolean {
  return files.some((file) => [".ts", ".tsx", ".mts", ".cts", ".d.ts"].includes(extname(file.relativePath)));
}

export function getPropsForComponent(
  content: string,
  componentName: string,
  filesByPath: Map<string, TextFile> = new Map(),
  relativePath = "",
): ComponentProp[] {
  const explicitType = findComponentPropsType(content, componentName);
  const conventionalType = `${componentName}Props`;
  const propsTypeName = explicitType ?? (hasPropsType(content, conventionalType) ? conventionalType : null);

  if (!propsTypeName) {
    return [];
  }

  const declaringContent = hasPropsType(content, propsTypeName)
    ? content
    : resolveImportedTypeContent(content, propsTypeName, filesByPath, relativePath);

  return declaringContent ? getPropsForType(declaringContent, propsTypeName) : [];
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

function resolveImportedTypeContent(
  content: string,
  typeName: string,
  filesByPath: Map<string, TextFile>,
  relativePath: string,
): string | null {
  if (filesByPath.size === 0 || relativePath.length === 0) {
    return null;
  }

  const escapedName = escapeRegExp(typeName);
  const importPattern = new RegExp(
    `\\bimport\\s+(?:type\\s+)?\\{[^}]*\\b${escapedName}\\b[^}]*\\}\\s+from\\s+["'](?<source>[^"']+)["']`,
  );
  const source = importPattern.exec(content)?.groups?.source;
  if (!source?.startsWith(".")) {
    return null;
  }

  return resolveLocalSourceFile(relativePath, source, filesByPath)?.content ?? null;
}

function resolveLocalSourceFile(currentRelativePath: string, specifier: string, filesByPath: Map<string, TextFile>): TextFile | null {
  const basePath = normalizeRelativePath(join(dirname(currentRelativePath), specifier));
  const candidates = [
    basePath,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    `${basePath}.js`,
    `${basePath}.jsx`,
    join(basePath, "index.ts"),
    join(basePath, "index.tsx"),
    join(basePath, "index.js"),
    join(basePath, "index.jsx"),
  ].map(normalizeRelativePath);

  for (const candidate of candidates) {
    const file = filesByPath.get(candidate);
    if (file) {
      return file;
    }
  }

  return null;
}

function normalizeRelativePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\.\//, "");
}

function getPropsForType(content: string, typeName: string): ComponentProp[] {
  const body = getTypeBody(content, typeName);
  if (!body) {
    return [];
  }

  const props: ComponentProp[] = [];
  const propPattern = /(?<comment>\/\*\*[\s\S]*?\*\/\s*)?(?:readonly\s+)?(?<name>[A-Za-z_$][A-Za-z0-9_$]*|["'][^"']+["'])\??\s*:/g;

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
      type: readTopLevelType(body, match.index + match[0].length),
      leadingComment: match.groups?.comment?.trim() ?? "",
    });
  }

  return props;
}

function readTopLevelType(content: string, startIndex: number): string {
  let depth = 0;
  let stringQuote: string | null = null;
  const chars: string[] = [];

  for (let index = startIndex; index < content.length; index += 1) {
    const char = content[index];

    if (stringQuote) {
      chars.push(char);
      if (char === "\\") {
        chars.push(content[index + 1] ?? "");
        index += 1;
      } else if (char === stringQuote) {
        stringQuote = null;
      }
      continue;
    }

    if (char === '"' || char === "'" || char === "`") {
      stringQuote = char;
      chars.push(char);
    } else if (char === "{" || char === "(" || char === "[") {
      depth += 1;
      chars.push(char);
    } else if (char === "}" || char === ")" || char === "]") {
      if (depth === 0 && char === "}") {
        break;
      }
      depth = Math.max(0, depth - 1);
      chars.push(char);
    } else if (depth === 0 && (char === ";" || char === "," || char === "\n")) {
      break;
    } else {
      chars.push(char);
    }
  }

  return chars.join("").trim();
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
