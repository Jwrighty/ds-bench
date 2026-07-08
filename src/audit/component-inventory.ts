import { dirname, extname, join } from "node:path";
import { isExampleCarrier } from "./example-carriers.ts";
import { escapeRegExp, isRecord, type TextFile } from "./file-system.ts";

export const COMPONENT_NAME = /^[A-Z][A-Za-z0-9]*$/;
const SOURCE_MODULE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mts", ".cts", ".d.ts"] as const;

export type ComponentInventory = {
  components: string[];
};

export type PublicPackage = {
  name: string;
  rootRelativePath: string;
  packageJsonPath: string;
  declaredEntryRelativePaths: string[];
  sourceEntryRelativePaths: string[];
};

export type ExportedSymbol = {
  name: string;
  filePath: string;
  relativePath: string;
  declaration: string;
  leadingComment: string;
  kind: "value" | "type";
};

export type ComponentImport = {
  importedName: string;
  localName: string;
};

export type LibraryPackageScopeOptions = {
  includeRootFiles?: boolean;
};

export function getExportedComponents(files: TextFile[]): ComponentInventory {
  const components = new Set(
    getExportedComponentSymbols(files)
      .map((symbol) => symbol.name),
  );

  return {
    components: Array.from(components).sort(),
  };
}

export function getExportedComponentSymbols(files: TextFile[]): ExportedSymbol[] {
  return getExportedSymbols(files).filter((symbol) => symbol.kind === "value" && COMPONENT_NAME.test(symbol.name));
}

export function getExportedSymbols(files: TextFile[]): ExportedSymbol[] {
  const publicPackage = getPublicPackage(files);
  if (publicPackage && publicPackage.sourceEntryRelativePaths.length > 0) {
    return collectPublicEntrySymbols(files, publicPackage.sourceEntryRelativePaths);
  }

  const symbols = new Map<string, ExportedSymbol>();

  for (const file of files.filter((file) => !isExampleCarrier(file.relativePath))) {
    const declarationPattern =
      /(?<comment>\/\*\*[\s\S]*?\*\/\s*)?\bexport\s+(?:declare\s+)?(?<kind>function|class|const|let|var|type|interface)\s+(?<name>[A-Za-z_$][A-Za-z0-9_$]*)\b/g;

    for (const match of file.content.matchAll(declarationPattern)) {
      const name = match.groups?.name;
      if (!name) {
        continue;
      }

      symbols.set(name, {
        name,
        filePath: file.path,
        relativePath: file.relativePath,
        declaration: match[0],
        leadingComment: match.groups?.comment?.trim() ?? "",
        kind: declarationKind(match.groups?.kind),
      });
    }

    for (const match of file.content.matchAll(/\bexport\s+(?<typeOnly>type\s+)?\{\s*(?<specifiers>[^}]+)\s*\}/g)) {
      for (const specifier of (match.groups?.specifiers ?? "").split(",")) {
        const exported = specifier.trim().split(/\s+as\s+/).at(-1)?.trim();
        if (!exported || symbols.has(exported)) {
          continue;
        }

        symbols.set(exported, {
          name: exported,
          filePath: file.path,
          relativePath: file.relativePath,
          declaration: specifier.trim(),
          leadingComment: findLeadingCommentForName(file.content, exported),
          kind: match.groups?.typeOnly ? "type" : "value",
        });
      }
    }
  }

  return Array.from(symbols.values()).sort((left, right) => left.name.localeCompare(right.name));
}

export function getPublicPackage(files: TextFile[]): PublicPackage | null {
  const candidates = discoverPackageCandidates(files);
  if (candidates.length === 0) {
    return null;
  }

  const rootCandidate = candidates.find((candidate) => candidate.rootRelativePath === "");
  if (rootCandidate && rootCandidate.componentCount > 0) {
    return toPublicPackage(rootCandidate);
  }

  const componentCandidates = candidates.filter((candidate) => candidate.componentCount > 0);
  if (componentCandidates.length > 0) {
    componentCandidates.sort((left, right) => {
      const componentDelta = right.componentCount - left.componentCount;
      if (componentDelta !== 0) {
        return componentDelta;
      }

      const nameDelta = packageNameScore(right.name) - packageNameScore(left.name);
      if (nameDelta !== 0) {
        return nameDelta;
      }

      return pathDepth(left.rootRelativePath) - pathDepth(right.rootRelativePath);
    });
    return toPublicPackage(componentCandidates[0]);
  }

  if (rootCandidate) {
    return toPublicPackage(rootCandidate);
  }

  return toPublicPackage(candidates[0]);
}

export function getLibraryPackageRootPaths(files: TextFile[]): string[] {
  const candidates = discoverPackageCandidates(files);
  const nonRootCandidates = candidates.filter((candidate) => candidate.rootRelativePath.length > 0);

  if (nonRootCandidates.length === 0) {
    return candidates.some((candidate) => candidate.rootRelativePath === "") ? [""] : [];
  }

  const libraryRoots = nonRootCandidates
    .filter(isLibraryPackageCandidate)
    .map((candidate) => candidate.rootRelativePath)
    .sort();

  return Array.from(new Set(libraryRoots));
}

export function scopeFilesToLibraryPackages(files: TextFile[], options: LibraryPackageScopeOptions = {}): TextFile[] {
  const roots = getLibraryPackageRootPaths(files);
  if (roots.length === 0 || roots.includes("")) {
    return files.filter((file) => !isConsumerWorkspacePath(file.relativePath));
  }

  return files.filter(
    (file) =>
      (options.includeRootFiles === true && isRootLevelPath(file.relativePath)) ||
      roots.some((root) => file.relativePath === root || file.relativePath.startsWith(`${root}/`)),
  );
}

type PackageCandidate = PublicPackage & {
  componentCount: number;
};

function discoverPackageCandidates(files: TextFile[]): PackageCandidate[] {
  const filesByPath = mapFilesByRelativePath(files);
  const candidates: PackageCandidate[] = [];

  for (const file of files.filter((candidate) => candidate.relativePath.endsWith("package.json"))) {
    const packageJson = parseJsonObject(file.content);
    if (!packageJson || typeof packageJson.name !== "string") {
      continue;
    }

    const rootRelativePath = normalizeRelativePath(dirname(file.relativePath) === "." ? "" : dirname(file.relativePath));
    const declaredEntryRelativePaths = getDeclaredEntryRelativePaths(rootRelativePath, packageJson);
    if (declaredEntryRelativePaths.length === 0) {
      continue;
    }

    const sourceEntryRelativePaths = getSourceEntryRelativePaths(rootRelativePath, declaredEntryRelativePaths, filesByPath);
    const symbols = collectPublicEntrySymbols(files, sourceEntryRelativePaths);
    candidates.push({
      name: packageJson.name,
      rootRelativePath,
      packageJsonPath: file.relativePath,
      declaredEntryRelativePaths,
      sourceEntryRelativePaths,
      componentCount: symbols.filter((symbol) => symbol.kind === "value" && COMPONENT_NAME.test(symbol.name)).length,
    });
  }

  return candidates.sort((left, right) => pathDepth(left.rootRelativePath) - pathDepth(right.rootRelativePath));
}

function toPublicPackage(candidate: PackageCandidate): PublicPackage {
  return {
    name: candidate.name,
    rootRelativePath: candidate.rootRelativePath,
    packageJsonPath: candidate.packageJsonPath,
    declaredEntryRelativePaths: candidate.declaredEntryRelativePaths,
    sourceEntryRelativePaths: candidate.sourceEntryRelativePaths,
  };
}

/**
 * Shared state for one entry-symbol resolution pass. `resolved` memoizes each file's
 * fully-collected symbols so a barrel that re-exports the same source for several
 * specifiers pays for it once; `inProgress` marks files on the current traversal path
 * so re-export cycles (common in large barrels — MUI/Chakra/Polaris) terminate instead
 * of overflowing the stack.
 */
type SymbolResolution = {
  filesByPath: Map<string, TextFile>;
  resolved: Map<string, ExportedSymbol[]>;
  inProgress: Set<string>;
};

function collectPublicEntrySymbols(files: TextFile[], entryRelativePaths: string[]): ExportedSymbol[] {
  const resolution: SymbolResolution = {
    filesByPath: mapFilesByRelativePath(files),
    resolved: new Map(),
    inProgress: new Set(),
  };
  const symbols = new Map<string, ExportedSymbol>();

  for (const entryRelativePath of entryRelativePaths) {
    const entryFile = resolution.filesByPath.get(entryRelativePath);
    if (!entryFile) {
      continue;
    }

    for (const symbol of collectSymbolsFromFile(entryFile, resolution)) {
      symbols.set(symbol.name, symbol);
    }
  }

  return Array.from(symbols.values()).sort((left, right) => left.name.localeCompare(right.name));
}

function collectSymbolsFromFile(file: TextFile, resolution: SymbolResolution): ExportedSymbol[] {
  const cached = resolution.resolved.get(file.relativePath);
  if (cached) {
    return cached;
  }
  if (resolution.inProgress.has(file.relativePath)) {
    // Re-export cycle: break without caching this partial view.
    return [];
  }
  resolution.inProgress.add(file.relativePath);

  const filesByPath = resolution.filesByPath;
  const symbols: ExportedSymbol[] = [];
  const declarationPattern =
    /(?<comment>\/\*\*[\s\S]*?\*\/\s*)?\bexport\s+(?:declare\s+)?(?<kind>function|class|const|let|var|type|interface)\s+(?<name>[A-Za-z_$][A-Za-z0-9_$]*)\b/g;

  for (const match of file.content.matchAll(declarationPattern)) {
    const name = match.groups?.name;
    if (!name) {
      continue;
    }

    symbols.push({
      name,
      filePath: file.path,
      relativePath: file.relativePath,
      declaration: match[0],
      leadingComment: match.groups?.comment?.trim() ?? "",
      kind: declarationKind(match.groups?.kind),
    });
  }

  const namedExportPattern = /\bexport\s+(?<typeOnly>type\s+)?\{\s*(?<specifiers>[^}]+)\s*\}(?:\s*from\s*["'](?<source>[^"']+)["'])?/g;
  for (const match of file.content.matchAll(namedExportPattern)) {
    const specifiers = match.groups?.specifiers ?? "";
    const source = match.groups?.source;
    const sourceFile = source ? resolveLocalSourceFile(file.relativePath, source, filesByPath) : file;
    const typeOnly = Boolean(match.groups?.typeOnly);

    for (const specifier of specifiers.split(",")) {
      const parsed = parseExportSpecifier(specifier);
      if (!parsed) {
        continue;
      }

      const resolved = sourceFile ? findDeclaredSymbol(sourceFile, parsed.localName, resolution) : null;
      symbols.push(
        resolved
          ? { ...resolved, name: parsed.exportedName, kind: typeOnly ? "type" : resolved.kind }
          : {
              name: parsed.exportedName,
              filePath: file.path,
              relativePath: file.relativePath,
              declaration: specifier.trim(),
              leadingComment: findLeadingCommentForName(file.content, parsed.localName),
              kind: typeOnly ? "type" : "value",
            },
      );
    }
  }

  const exportStarPattern = /\bexport\s+\*\s+from\s*["'](?<source>[^"']+)["']/g;
  for (const match of file.content.matchAll(exportStarPattern)) {
    const source = match.groups?.source;
    const sourceFile = source ? resolveLocalSourceFile(file.relativePath, source, filesByPath) : null;
    if (sourceFile) {
      symbols.push(...collectSymbolsFromFile(sourceFile, resolution));
    }
  }

  resolution.inProgress.delete(file.relativePath);
  resolution.resolved.set(file.relativePath, symbols);
  return symbols;
}

function findDeclaredSymbol(file: TextFile, name: string, resolution: SymbolResolution): ExportedSymbol | null {
  for (const symbol of collectSymbolsFromFile(file, resolution)) {
    if (symbol.name === name) {
      return symbol;
    }
  }

  const declaration = findLocalDeclaration(file, name);
  return declaration ? { ...declaration, name } : null;
}

/** Local names of JSX elements rendered in `content`, e.g. `<Button>` or `<Dialog.Root>` -> the imported root name. */
export function getRenderedComponentNames(content: string): Set<string> {
  const names = new Set<string>();

  for (const match of content.matchAll(/<([A-Z][A-Za-z0-9]*)(?:\.|\s|>|\/)/g)) {
    names.add(match[1]);
  }

  return names;
}

/** Component-shaped default and named imports (aliasing-aware) across every `import` statement in `content`. */
export function getComponentImports(content: string): ComponentImport[] {
  const imports: ComponentImport[] = [];

  for (const match of content.matchAll(/\bimport\s+([^;]+?)\s+from\s+["'][^"']+["']/g)) {
    const clause = match[1].trim();
    const namedMatch = clause.match(/\{([^}]+)\}/);
    const defaultMatch = clause.match(/^([A-Z][A-Za-z0-9]*)\b/);

    if (defaultMatch) {
      imports.push({ importedName: defaultMatch[1], localName: defaultMatch[1] });
    }

    if (!namedMatch) {
      continue;
    }

    for (const specifier of namedMatch[1].split(",")) {
      const parts = specifier.trim().split(/\s+as\s+/);
      const importedName = parts[0]?.trim();
      const localName = (parts[1] ?? parts[0])?.trim();
      if (importedName && localName && COMPONENT_NAME.test(importedName) && COMPONENT_NAME.test(localName)) {
        imports.push({ importedName, localName });
      }
    }
  }

  return imports;
}

/** Whether `component` is both imported and rendered as JSX in `content`. */
export function hasImportableUsage(content: string, component: string): boolean {
  if (!getRenderedComponentNames(content).has(component)) {
    return false;
  }

  return getComponentImports(content).some((componentImport) => componentImport.localName === component);
}

function findLeadingCommentForName(content: string, name: string): string {
  const escapedName = escapeRegExp(name);
  const declaration = new RegExp(
    `/\\*\\*([\\s\\S]*?)\\*/\\s*(?:export\\s+)?(?:declare\\s+)?(?:function|class|const|let|var|type|interface)\\s+${escapedName}\\b`,
  );
  return declaration.exec(content)?.[0] ?? "";
}

function findLocalDeclaration(file: TextFile, name: string): ExportedSymbol | null {
  const escapedName = escapeRegExp(name);
  const declaration = new RegExp(
    `(?<comment>/\\*\\*[\\s\\S]*?\\*/\\s*)?\\b(?:export\\s+)?(?:declare\\s+)?(?<kind>function|class|const|let|var|type|interface)\\s+${escapedName}\\b`,
  );
  const match = declaration.exec(file.content);
  if (!match) {
    return null;
  }

  return {
    name,
    filePath: file.path,
    relativePath: file.relativePath,
    declaration: match[0],
    leadingComment: match.groups?.comment?.trim() ?? "",
    kind: declarationKind(match.groups?.kind),
  };
}

function declarationKind(kind: string | undefined): ExportedSymbol["kind"] {
  return kind === "type" || kind === "interface" ? "type" : "value";
}

function parseExportSpecifier(specifier: string): { localName: string; exportedName: string } | null {
  const withoutType = specifier.trim().replace(/^type\s+/, "");
  if (withoutType.length === 0) {
    return null;
  }

  const parts = withoutType.split(/\s+as\s+/);
  const localName = parts[0]?.trim();
  const exportedName = (parts[1] ?? parts[0])?.trim();
  if (!localName || !exportedName) {
    return null;
  }

  return { localName, exportedName };
}

function resolveLocalSourceFile(currentRelativePath: string, specifier: string, filesByPath: Map<string, TextFile>): TextFile | null {
  if (!specifier.startsWith(".")) {
    return null;
  }

  const basePath = normalizeRelativePath(join(dirname(currentRelativePath), specifier));
  return findModuleFile(basePath, filesByPath);
}

function findModuleFile(basePath: string, filesByPath: Map<string, TextFile>): TextFile | null {
  const candidates = [
    basePath,
    ...SOURCE_MODULE_EXTENSIONS.map((extension) => `${basePath}${extension}`),
    ...SOURCE_MODULE_EXTENSIONS.map((extension) => join(basePath, `index${extension}`)),
  ].map(normalizeRelativePath);

  for (const candidate of candidates) {
    const file = filesByPath.get(candidate);
    if (file) {
      return file;
    }
  }

  return null;
}

function getDeclaredEntryRelativePaths(rootRelativePath: string, packageJson: Record<string, unknown>): string[] {
  const entries = new Set<string>();
  const exportsValue = rootExportValue(packageJson.exports);

  for (const entry of collectEntryTargets(exportsValue)) {
    entries.add(joinRelativePath(rootRelativePath, entry));
  }

  for (const field of ["types", "typings", "module", "main"] as const) {
    const value = packageJson[field];
    if (typeof value === "string") {
      entries.add(joinRelativePath(rootRelativePath, value));
    }
  }

  return Array.from(entries).filter((entry) => entry.length > 0).sort();
}

function rootExportValue(exportsValue: unknown): unknown {
  if (!isRecord(exportsValue)) {
    return exportsValue;
  }

  const keys = Object.keys(exportsValue);
  const hasSubpathKeys = keys.some((key) => key === "." || key.startsWith("./"));
  return hasSubpathKeys ? exportsValue["."] : exportsValue;
}

function collectEntryTargets(value: unknown): string[] {
  if (typeof value === "string") {
    return value.includes("*") ? [] : [value];
  }

  if (Array.isArray(value)) {
    return value.flatMap(collectEntryTargets);
  }

  if (!isRecord(value)) {
    return [];
  }

  return Object.values(value).flatMap(collectEntryTargets);
}

function getSourceEntryRelativePaths(
  rootRelativePath: string,
  declaredEntryRelativePaths: string[],
  filesByPath: Map<string, TextFile>,
): string[] {
  const entries = new Set<string>();

  for (const declaredEntry of declaredEntryRelativePaths) {
    for (const candidate of sourceEntryCandidates(rootRelativePath, declaredEntry)) {
      if (filesByPath.has(candidate)) {
        entries.add(candidate);
      }
    }
  }

  for (const fallback of ["src/index.ts", "src/index.tsx", "index.ts", "index.tsx"]) {
    const candidate = joinRelativePath(rootRelativePath, fallback);
    if (filesByPath.has(candidate)) {
      entries.add(candidate);
    }
  }

  return Array.from(entries).sort();
}

function sourceEntryCandidates(rootRelativePath: string, declaredEntry: string): string[] {
  const candidates = new Set<string>();
  const normalized = normalizeRelativePath(declaredEntry);
  candidates.add(normalized);

  const withoutDeclarationExtension = normalized.replace(/\.d\.ts$/, ".ts").replace(/\.(js|jsx|mjs|cjs)$/, ".ts");
  candidates.add(withoutDeclarationExtension);
  candidates.add(withoutDeclarationExtension.replace(/\.ts$/, ".tsx"));

  if (normalized.includes("/dist/")) {
    const sourcePath = withoutDeclarationExtension.replace("/dist/", "/src/");
    candidates.add(sourcePath);
    candidates.add(sourcePath.replace(/\.ts$/, ".tsx"));
  }

  if (extname(normalized) === "") {
    for (const extension of SOURCE_MODULE_EXTENSIONS) {
      candidates.add(`${normalized}${extension}`);
    }
  }

  const sourceIndex = joinRelativePath(rootRelativePath, "src/index.ts");
  if (normalized.endsWith("/dist/index.d.ts") || normalized.endsWith("/dist/index.js")) {
    candidates.add(sourceIndex);
    candidates.add(sourceIndex.replace(/\.ts$/, ".tsx"));
  }

  return Array.from(candidates).map(normalizeRelativePath);
}

function parseJsonObject(content: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(content) as unknown;
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function mapFilesByRelativePath(files: TextFile[]): Map<string, TextFile> {
  return new Map(files.map((file) => [normalizeRelativePath(file.relativePath), file]));
}

function joinRelativePath(rootRelativePath: string, childPath: string): string {
  const cleanedChild = childPath.replace(/^\.\//, "");
  return normalizeRelativePath(rootRelativePath.length === 0 ? cleanedChild : join(rootRelativePath, cleanedChild));
}

function normalizeRelativePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\.\//, "");
}

function isRootLevelPath(path: string): boolean {
  return !path.includes("/");
}

function packageNameScore(packageName: string): number {
  return /\b(?:react|ui|components?)\b|(?:^|[-/])react(?:$|[-/])|(?:^|[-/])ui(?:$|[-/])|(?:^|[-/])components?(?:$|[-/])/i.test(packageName)
    ? 1
    : 0;
}

function pathDepth(path: string): number {
  return path.length === 0 ? 0 : path.split("/").length;
}

function isLibraryPackageCandidate(candidate: PackageCandidate): boolean {
  const [workspaceRoot] = candidate.rootRelativePath.split("/");
  if (isConsumerWorkspaceRoot(workspaceRoot)) {
    return false;
  }

  if (workspaceRoot === "packages") {
    return true;
  }

  return packageNameScore(candidate.name) > 0 || /\b(?:tokens?|theme|design-system)\b/i.test(candidate.name);
}

function isConsumerWorkspacePath(relativePath: string): boolean {
  const [workspaceRoot] = normalizeRelativePath(relativePath).split("/");
  return isConsumerWorkspaceRoot(workspaceRoot);
}

function isConsumerWorkspaceRoot(workspaceRoot: string | undefined): boolean {
  return workspaceRoot === "apps" || workspaceRoot === "examples" || workspaceRoot === "docs";
}
