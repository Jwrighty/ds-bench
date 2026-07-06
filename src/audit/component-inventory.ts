import { isExampleCarrier } from "./example-carriers.ts";
import type { TextFile } from "./file-system.ts";

const COMPONENT_NAME = /^[A-Z][A-Za-z0-9]*$/;

export type ComponentInventory = {
  components: string[];
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
