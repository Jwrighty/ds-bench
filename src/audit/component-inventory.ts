import { isExampleCarrier } from "./example-carriers.ts";
import type { TextFile } from "./file-system.ts";

export const COMPONENT_NAME = /^[A-Z][A-Za-z0-9]*$/;

export type ComponentInventory = {
  components: string[];
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
