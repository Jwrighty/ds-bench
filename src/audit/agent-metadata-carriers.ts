import { dirname, extname, join, normalize } from "node:path";
import { getComponentImports, getPublicPackage, getRenderedComponentNames, COMPONENT_NAME } from "./component-inventory.ts";
import { isRecord, walkJson, type TextFile } from "./file-system.ts";
import { AGENT_CONTEXT_FILE_PATTERN, AGENT_INSTRUCTION_FILE_PATTERN, LLMS_TXT_FILE_PATTERN } from "./agent-metadata-paths.ts";

const COMMON_NON_COMPONENT_WORDS = new Set([
  "AGENTS",
  "API",
  "CSS",
  "CLAUDE",
  "CLI",
  "DESIGN",
  "HTML",
  "HTTP",
  "HTTPS",
  "JSON",
  "JavaScript",
  "MCP",
  "MDX",
  "React",
  "TypeScript",
  "URL",
  "URLs",
]);
const COMPONENTISH_SUFFIX_PATTERN =
  /(?:Accordion|Alert|Avatar|Badge|Banner|Box|Button|Calendar|Card|Checkbox|Combobox|Dialog|Field|Form|Grid|Heading|Icon|Input|Link|Menu|Modal|Popover|Radio|Select|Slider|Stack|Switch|Table|Tabs|Text|Toast|Tooltip)$/;

export type MetadataCodeExample = {
  file: TextFile;
  index: number;
  content: string;
};

export function getAgentContextFiles(files: TextFile[]): TextFile[] {
  return files.filter((file) => AGENT_CONTEXT_FILE_PATTERN.test(file.relativePath)).sort(byRelativePath);
}

export function getInstructionMetadataFiles(files: TextFile[]): TextFile[] {
  return files.filter((file) => AGENT_INSTRUCTION_FILE_PATTERN.test(file.relativePath)).sort(byRelativePath);
}

export function getLlmsTxtFiles(files: TextFile[]): TextFile[] {
  return files.filter((file) => LLMS_TXT_FILE_PATTERN.test(file.relativePath)).sort(byRelativePath);
}

export function getMetadataCodeExamples(files: TextFile[]): MetadataCodeExample[] {
  return getInstructionMetadataFiles(files).flatMap((file) => extractCodeFences(file));
}

export function getReferencedComponentNames(content: string): Set<string> {
  const names = new Set<string>();

  for (const name of getRenderedComponentNames(content)) {
    names.add(name);
  }

  for (const componentImport of getComponentImports(content)) {
    names.add(componentImport.importedName);
  }

  for (const match of content.matchAll(/`([A-Z][A-Za-z0-9]*)`/g)) {
    const name = match[1];
    if (COMPONENT_NAME.test(name)) {
      names.add(name);
    }
  }

  for (const match of content.matchAll(/\b([A-Z][A-Za-z0-9]*)\b/g)) {
    const name = match[1];
    if (isLikelyComponentReference(name)) {
      names.add(name);
    }
  }

  return names;
}

export function getPackageImportNames(files: TextFile[]): string[] {
  const publicPackage = getPublicPackage(files);
  const names = new Set<string>();

  if (publicPackage?.name) {
    names.add(publicPackage.name);
  }

  for (const file of files.filter((candidate) => candidate.relativePath.endsWith("package.json"))) {
    try {
      const packageJson = JSON.parse(file.content) as unknown;
      if (isRecord(packageJson) && typeof packageJson.name === "string") {
        names.add(packageJson.name);
      }
    } catch {
      // Broken package.json is handled by other checks; it simply cannot help classify examples here.
    }
  }

  return Array.from(names).sort();
}

export function importsSystemComponent(code: string, components: Set<string>, packageNames: string[]): boolean {
  for (const match of code.matchAll(/\bimport\s+(?<clause>[^;]+?)\s+from\s+["'](?<source>[^"']+)["']/g)) {
    const source = match.groups?.source ?? "";
    const clause = match.groups?.clause ?? "";
    if (!isPackageImport(source, packageNames)) {
      continue;
    }

    const namedMatch = clause.match(/\{([^}]+)\}/);
    if (namedMatch) {
      for (const specifier of namedMatch[1].split(",")) {
        const importedName = specifier.trim().replace(/^type\s+/, "").split(/\s+as\s+/)[0]?.trim();
        if (importedName && components.has(importedName)) {
          return true;
        }
      }
    }

    const defaultMatch = clause.match(/^([A-Z][A-Za-z0-9]*)\b/);
    if (defaultMatch && components.has(defaultMatch[1])) {
      return true;
    }
  }

  return false;
}

export function declaresSystemComponent(code: string, components: Set<string>): boolean {
  for (const component of components) {
    const declaration = new RegExp(
      `\\b(?:export\\s+)?(?:function|class)\\s+${component}\\b|\\b(?:export\\s+)?(?:const|let|var)\\s+${component}\\s*(?::|=)`,
    );
    if (declaration.test(code)) {
      return true;
    }
  }

  return false;
}

export function isRebuildStyleExample(code: string, components: Set<string>): boolean {
  if (declaresSystemComponent(code, components)) {
    return true;
  }

  return (
    /\b(?:export\s+)?(?:function|class)\s+[A-Z][A-Za-z0-9]*\b/.test(code) ||
    /\b(?:export\s+)?(?:const|let|var)\s+[A-Z][A-Za-z0-9]*\s*(?::|=)/.test(code) ||
    /<[a-z][a-z0-9-]*(?:\s|>|\/)/.test(code) ||
    /\bclassName\s*=/.test(code)
  );
}

export function detectMcpCarriers(files: TextFile[]): string[] {
  const detections = new Set<string>();

  for (const file of files) {
    const normalizedPath = file.relativePath.replace(/\\/g, "/");
    const basename = normalizedPath.split("/").at(-1) ?? normalizedPath;

    if (/^(?:mcp|\.mcp)\.json$/i.test(basename) || /(^|\/)\.cursor\/mcp\.json$/i.test(normalizedPath)) {
      detections.add(normalizedPath);
    }

    if (!normalizedPath.endsWith("package.json") && extname(normalizedPath) !== ".json") {
      continue;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(file.content);
    } catch {
      continue;
    }

    if (!isRecord(parsed)) {
      continue;
    }

    if (hasMcpServersConfig(parsed)) {
      detections.add(`${normalizedPath} mcpServers`);
    }

    if (normalizedPath.endsWith("package.json")) {
      for (const packageName of packageDependencyNames(parsed)) {
        if (isMcpPackageName(packageName)) {
          detections.add(`${normalizedPath} dependency ${packageName}`);
        }
      }

    }
  }

  return Array.from(detections).sort();
}

function isLikelyComponentReference(name: string): boolean {
  return !COMMON_NON_COMPONENT_WORDS.has(name) && COMPONENTISH_SUFFIX_PATTERN.test(name);
}

function extractCodeFences(file: TextFile): MetadataCodeExample[] {
  const examples: MetadataCodeExample[] = [];
  let index = 1;

  for (const match of file.content.matchAll(/```[^\n`]*\n([\s\S]*?)```/g)) {
    examples.push({
      file,
      index,
      content: match[1],
    });
    index += 1;
  }

  return examples;
}

function isPackageImport(source: string, packageNames: string[]): boolean {
  if (source.startsWith(".")) {
    return false;
  }

  return packageNames.some((packageName) => source === packageName || source.startsWith(`${packageName}/`));
}

function hasMcpServersConfig(value: unknown): boolean {
  let found = false;
  walkJson(value, (node) => {
    if (isRecord(node) && isRecord(node.mcpServers)) {
      found = true;
    }

    // Records only: array items never carry an mcpServers config.
    return !found && isRecord(node);
  });

  return found;
}

function packageDependencyNames(packageJson: Record<string, unknown>): string[] {
  return ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"].flatMap((field) => {
    const dependencies = packageJson[field];
    return isRecord(dependencies) ? Object.keys(dependencies) : [];
  });
}

function isMcpPackageName(packageName: string): boolean {
  return packageName === "@modelcontextprotocol/sdk" || /(^|[-/@])mcp($|[-/])|modelcontextprotocol/i.test(packageName);
}

function byRelativePath(left: TextFile, right: TextFile): number {
  return left.relativePath.localeCompare(right.relativePath);
}

export function resolveLlmsLocalReference(llmsFile: TextFile, href: string): string {
  const withoutHash = href.split("#")[0] ?? href;
  const withoutQuery = withoutHash.split("?")[0] ?? withoutHash;
  const baseDir = dirname(llmsFile.relativePath);
  return normalize(baseDir === "." ? withoutQuery : join(baseDir, withoutQuery)).replace(/\\/g, "/").replace(/^\.\//, "");
}
