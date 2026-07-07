import { isExampleCarrier } from "./example-carriers.ts";
import { escapeRegExp, type TextFile } from "./file-system.ts";

export const COMPONENT_NAME = /^[A-Z][A-Za-z0-9]*$/;

export type ComponentInventory = {
  components: string[];
};

export type ExportedSymbol = {
  name: string;
  filePath: string;
  relativePath: string;
  declaration: string;
  leadingComment: string;
};

export type ComponentImport = {
  importedName: string;
  localName: string;
};

export function getExportedComponents(files: TextFile[]): ComponentInventory {
  const components = new Set<string>();

  for (const file of files.filter((file) => !isExampleCarrier(file.relativePath))) {
    for (const match of file.content.matchAll(/\bexport\s+(?:declare\s+)?(?:function|class|const|let|var)\s+([A-Z][A-Za-z0-9]*)\b/g)) {
      components.add(match[1]);
    }

    for (const match of file.content.matchAll(/\bexport\s*\{\s*([^}]+)\s*\}/g)) {
      for (const specifier of match[1].split(",")) {
        const exported = specifier.trim().split(/\s+as\s+/).at(-1)?.trim();
        if (exported && COMPONENT_NAME.test(exported)) {
          components.add(exported);
        }
      }
    }
  }

  return {
    components: Array.from(components).sort(),
  };
}

export function getExportedSymbols(files: TextFile[]): ExportedSymbol[] {
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
      });
    }

    for (const match of file.content.matchAll(/\bexport\s*\{\s*([^}]+)\s*\}/g)) {
      for (const specifier of match[1].split(",")) {
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
        });
      }
    }
  }

  return Array.from(symbols.values()).sort((left, right) => left.name.localeCompare(right.name));
}

/** Local names of JSX elements rendered in `content`, e.g. `<Button>` -> "Button". */
export function getRenderedComponentNames(content: string): Set<string> {
  const names = new Set<string>();

  for (const match of content.matchAll(/<([A-Z][A-Za-z0-9]*)(?:\s|>|\/)/g)) {
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
