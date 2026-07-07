import { basename } from "node:path";
import { isRecord, type TextFile } from "./file-system.ts";

export type ManifestCoverage = {
  manifestFiles: TextFile[];
  coveredNames: Set<string>;
};

export function isManifestCarrier(relativePath: string): boolean {
  const fileName = basename(relativePath).toLowerCase();
  return fileName.includes("manifest") || fileName === "components.json" || fileName === "component-metadata.json";
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

    if ((key === "name" || key === "displayName" || key === "exportName" || key === "component") && typeof nested === "string") {
      if (componentSet.has(nested)) {
        coveredNames.add(nested);
      }
    }

    visitManifestValue(nested, componentSet, coveredNames);
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
