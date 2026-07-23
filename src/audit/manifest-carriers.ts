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
 * Whether a structured manifest record both names and *describes* `exportName`:
 * it names the export and carries at least one free-text field (a `{ Button:
 * "..." }` map, a `{ name, description }` record, a `{ Button: { description }}`
 * descriptor). A name-only inventory entry (`{ "name": "Button" }`) names but
 * does not describe, so it earns no documentation credit.
 */
export function manifestDescribesExport(content: string, exportName: string): boolean {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    // A described record is a structured signal; unparseable text is prose, not evidence.
    return false;
  }

  return nodeDescribesExport(parsed, exportName);
}

function nodeDescribesExport(value: unknown, exportName: string): boolean {
  if (Array.isArray(value)) {
    return value.some((item) => nodeDescribesExport(item, exportName));
  }

  if (!isRecord(value)) {
    return false;
  }

  if (recordDescribesExport(value, exportName)) {
    return true;
  }

  // `{ Button: <descriptor> }` — the export name keys its own description or descriptor record.
  const keyed = value[exportName];
  if (isProse(keyed) || (isRecord(keyed) && Object.values(keyed).some(isProse))) {
    return true;
  }

  return Object.values(value).some((nested) => nodeDescribesExport(nested, exportName));
}

// The record names the export and carries a descriptive sibling field — not just
// the name itself and not just enum/boolean/reference tags like `deprecated` or `useInstead`.
function recordDescribesExport(record: Record<string, unknown>, exportName: string): boolean {
  if (!recordNamesExport(record, exportName)) {
    return false;
  }

  return Object.entries(record).some(
    ([key, nested]) => key !== exportName && !(MANIFEST_NAME_FIELDS as readonly string[]).includes(key) && isProse(nested),
  );
}

// Free-text description: at least two whitespace-separated word tokens, so a bare
// identifier, category tag, or cross-reference ("Popover") is not read as prose.
function isProse(value: unknown): boolean {
  return typeof value === "string" && /[A-Za-z]/.test(value) && /\S\s+\S/.test(value);
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
