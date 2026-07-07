import { basename } from "node:path";
import { escapeRegExp, isRecord, type TextFile } from "./file-system.ts";

export type ManifestCoverage = {
  manifestFiles: TextFile[];
  coveredNames: Set<string>;
};

/** JSON object keys that manifest/metadata records conventionally use to name an export or component. */
export const MANIFEST_NAME_FIELDS = ["name", "displayName", "exportName", "component"] as const;

/** Whether `record` names `exportName` via a bare key or one of the conventional name fields. */
export function recordNamesExport(record: Record<string, unknown>, exportName: string): boolean {
  if (Object.hasOwn(record, exportName)) {
    return true;
  }

  return Object.entries(record).some(
    ([key, nested]) => (MANIFEST_NAME_FIELDS as readonly string[]).includes(key) && nested === exportName,
  );
}

/**
 * Whether `relativePath` is a manifest carrier: any file whose name mentions "manifest",
 * the conventional `components.json`/`component-metadata.json` names, or a `storybook*.json` file.
 */
export function isManifestCarrier(relativePath: string): boolean {
  const fileName = basename(relativePath).toLowerCase();
  return (
    fileName.includes("manifest") ||
    fileName === "components.json" ||
    fileName === "component-metadata.json" ||
    /storybook.*\.json$/.test(fileName)
  );
}

export function getManifestCoverage(files: TextFile[], componentNames: string[]): ManifestCoverage {
  const manifestFiles = files.filter((file) => isManifestCarrier(file.relativePath));
  const componentSet = new Set(componentNames);
  const coveredNames = new Set<string>();

  for (const file of manifestFiles) {
    collectComponentNames(file.content, componentSet, coveredNames);
  }

  return { manifestFiles, coveredNames };
}

function collectComponentNames(content: string, componentSet: Set<string>, coveredNames: Set<string>): void {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    for (const component of componentSet) {
      if (new RegExp(`\\b${escapeRegExp(component)}\\b`).test(content)) {
        coveredNames.add(component);
      }
    }
    return;
  }

  visitManifestValue(parsed, componentSet, coveredNames);
}

function visitManifestValue(value: unknown, componentSet: Set<string>, coveredNames: Set<string>): void {
  if (typeof value === "string") {
    if (componentSet.has(value)) {
      coveredNames.add(value);
    }
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      visitManifestValue(item, componentSet, coveredNames);
    }
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  for (const [key, nested] of Object.entries(value)) {
    if (componentSet.has(key)) {
      coveredNames.add(key);
    }

    if ((MANIFEST_NAME_FIELDS as readonly string[]).includes(key) && typeof nested === "string") {
      if (componentSet.has(nested)) {
        coveredNames.add(nested);
      }
    }

    visitManifestValue(nested, componentSet, coveredNames);
  }
}
