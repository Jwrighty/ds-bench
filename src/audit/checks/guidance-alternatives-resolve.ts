import { basename } from "node:path";
import { getExportedComponents, COMPONENT_NAME } from "../component-inventory.ts";
import { isRecord, listTextFiles, walkJson, type TextFile } from "../file-system.ts";
import { isManifestCarrier, recordNamesExport } from "../manifest-carriers.ts";
import type { AuditCheck, CheckContext, CheckResult } from "../types.ts";
import { formatNames, naResult, roundRatio } from "./support.ts";
import { getGuidanceSections, type GuidanceSection } from "./guidance-support.ts";

type AlternativeReference = {
  name: string;
  subject: string | null;
};

type StructuredFieldValueSlice = {
  field: string;
  value: string;
};

type StructuredAlternativeCollection = {
  references: AlternativeReference[];
  subjects: Set<string>;
};

const ALTERNATIVE_CONTENT = /\b(?:alternatives?|instead)\b/i;
const EXACT_COMPONENT_REFERENCE = /^[A-Z][A-Za-z0-9]*(?:\.[A-Z][A-Za-z0-9]*)?$/;
const LIST_SEPARATOR = /\s*(?:,|\/|\bor\b|\band\b|\bwith\b)\s*/i;
const STRUCTURED_ALTERNATIVE_FIELDS = new Set(["useInstead", "alternatives", "relatedComponents"]);
const META_FILE_NAME = /\.meta\.[cm]?[jt]sx?$/;

export const guidanceAlternativesResolveCheck: AuditCheck = {
  id: "guidance.alternatives-resolve",
  category: "guidance",
  severity: "warning",
  signal: "alternative signposting",
  carriers: ["meta files", "manifest fields", "docs sections"],
  measure: '% "alternatives/instead" references that resolve to real exports',
  fix: "Reference real components in alternatives guidance.",
  naBehavior: "N/A when no alternatives content exists anywhere; guidance.when-to-use carries the selection gap.",
  receipt: "Resolvable cross-references can't be faked by boilerplate.",
  run(context: CheckContext): CheckResult {
    const files = context.files ?? listTextFiles(context.targetPath);
    const components = getExportedComponents(files).components;
    const exported = new Set(components);
    const sections = getGuidanceSections(files, components);
    const structured = collectStructuredAlternativeReferences(files, components);
    const alternativeSections = sections.filter((section) => ALTERNATIVE_CONTENT.test(section.content));

    if (structured.references.length === 0 && structured.subjects.size === 0 && alternativeSections.length === 0) {
      return naResult("ratio", "No alternatives/instead guidance content found; alternatives resolution is not applicable.");
    }

    const references = [
      ...structured.references,
      ...collectProseAlternativeReferences(alternativeSections, structured.subjects),
    ];
    const resolved = references.filter((reference) => exported.has(reference.name));
    const unresolved = references.filter((reference) => !exported.has(reference.name)).map((reference) => reference.name);

    if (references.length === 0) {
      return naResult("ratio", "No alternatives/instead component references found; alternatives resolution is not applicable.");
    }

    const ratio = resolved.length / references.length;

    return {
      outcome: unresolved.length === 0 ? "pass" : "fail",
      score: ratio,
      measure: {
        kind: "ratio",
        value: roundRatio(ratio),
        detail: `${resolved.length}/${references.length} alternatives/instead component references resolve to exported components; unresolved: ${formatNames(unresolved)}`,
      },
      evidence: Array.from(new Set(unresolved)).slice(0, 20),
    };
  },
};

function collectProseAlternativeReferences(sections: GuidanceSection[], structuredSubjects: Set<string>): AlternativeReference[] {
  const references = new Map<string, AlternativeReference>();

  for (const section of sections) {
    if (!section.subject || structuredSubjects.has(section.subject)) {
      continue;
    }

    const segments = section.content.split(/(?:\r?\n){2,}|(?<=[.!?])\s+/);
    segments.forEach((segment, index) => {
      if (!ALTERNATIVE_CONTENT.test(segment)) {
        return;
      }

      for (const name of extractComponentLikeNames(segment)) {
        if (section.subject && name === section.subject) {
          continue;
        }

        const key = `${section.relativePath}:${index}:${name}`;
        references.set(key, { name, subject: section.subject });
      }
    });
  }

  return Array.from(references.values());
}

function extractComponentLikeNames(content: string): string[] {
  const names = new Set<string>();
  const patterns = [
    /`([A-Z][A-Za-z0-9]*)`/g,
    /<([A-Z][A-Za-z0-9]*)(?:\s|>|\/)/g,
    /["']([A-Z][A-Za-z0-9]*)["']/g,
  ];

  for (const pattern of patterns) {
    for (const match of content.matchAll(pattern)) {
      const name = match[1];
      if (isCandidateComponentName(name)) {
        names.add(name);
      }
    }
  }

  return Array.from(names);
}

function collectStructuredAlternativeReferences(files: TextFile[], components: string[]): StructuredAlternativeCollection {
  const references = new Map<string, AlternativeReference>();
  const subjects = new Set<string>();

  for (const file of files) {
    const fileCollection = isManifestCarrier(file.relativePath)
      ? collectJsonStructuredReferences(file, components)
      : META_FILE_NAME.test(file.relativePath)
        ? collectMetaStructuredReferences(file, components)
        : { references: [], subjects: new Set<string>() };

    for (const subject of fileCollection.subjects) {
      subjects.add(subject);
    }

    for (const reference of fileCollection.references) {
      references.set(`${reference.subject ?? ""}:${reference.name}`, reference);
    }
  }

  return { references: Array.from(references.values()), subjects };
}

function collectJsonStructuredReferences(file: TextFile, components: string[]): StructuredAlternativeCollection {
  let parsed: unknown;
  try {
    parsed = JSON.parse(file.content);
  } catch {
    return { references: [], subjects: new Set<string>() };
  }

  const references: AlternativeReference[] = [];
  const subjects = new Set<string>();
  walkJson(parsed, (node, path) => {
    if (!isRecord(node)) {
      return true;
    }

    const subject = subjectFromStructuredRecord(node, path, components);
    if (subject && hasStructuredAlternativeField(node)) {
      subjects.add(subject);
    }

    for (const [key, value] of Object.entries(node)) {
      if (STRUCTURED_ALTERNATIVE_FIELDS.has(key)) {
        references.push(...extractStructuredFieldNames(key, value).map((name) => ({ name, subject })));
      }
    }

    return true;
  });

  return { references, subjects };
}

function collectMetaStructuredReferences(file: TextFile, components: string[]): StructuredAlternativeCollection {
  const subject = subjectFromMetaFile(file, components);
  const references: AlternativeReference[] = [];
  const subjects = new Set<string>();
  const slices = getStructuredFieldValueSlices(file.content);

  if (subject && slices.length > 0) {
    subjects.add(subject);
  }

  for (const { field, value } of slices) {
    references.push(...extractStructuredFieldNamesFromSourceSlice(field, value).map((name) => ({ name, subject })));
  }

  return { references, subjects };
}

function hasStructuredAlternativeField(record: Record<string, unknown>): boolean {
  return Object.keys(record).some((key) => STRUCTURED_ALTERNATIVE_FIELDS.has(key));
}

function subjectFromStructuredRecord(record: Record<string, unknown>, path: string[], components: string[]): string | null {
  const componentSet = new Set(components);
  const pathSubject = path.at(-1);
  if (pathSubject && componentSet.has(pathSubject)) {
    return pathSubject;
  }

  return components.find((component) => recordNamesExport(record, component)) ?? null;
}

function subjectFromMetaFile(file: TextFile, components: string[]): string | null {
  const filename = basename(file.relativePath).replace(META_FILE_NAME, "");
  const byPath = components.find((component) => component === filename);
  if (byPath) {
    return byPath;
  }

  const nameField = /\b(?:name|displayName|exportName|component)\s*:\s*["']([A-Z][A-Za-z0-9]*)["']/.exec(file.content)?.[1];
  return nameField && components.includes(nameField) ? nameField : null;
}

function getStructuredFieldValueSlices(content: string): StructuredFieldValueSlice[] {
  const slices: StructuredFieldValueSlice[] = [];
  const fieldPattern = /\b(?:useInstead|alternatives|relatedComponents)\s*:/g;

  for (const match of content.matchAll(fieldPattern)) {
    const startIndex = (match.index ?? 0) + match[0].length;
    const slice = readJavaScriptValueSlice(content, startIndex);
    if (slice) {
      slices.push({ field: match[0].replace(/\s*:\s*$/, ""), value: slice });
    }
  }

  return slices;
}

function readJavaScriptValueSlice(content: string, startIndex: number): string | null {
  let index = startIndex;
  while (/\s/.test(content[index] ?? "")) {
    index += 1;
  }

  const opener = content[index];
  if (!opener) {
    return null;
  }

  if (opener === '"' || opener === "'" || opener === "`") {
    return collectQuoted(content, index, opener);
  }

  if (opener === "[" || opener === "{") {
    return collectBalanced(content, index, opener, opener === "[" ? "]" : "}");
  }

  const end = content.slice(index).search(/[,\n}]/);
  return content.slice(index, end === -1 ? undefined : index + end).trim();
}

function collectQuoted(content: string, startIndex: number, quote: string): string {
  let escaped = false;
  for (let index = startIndex + 1; index < content.length; index += 1) {
    const char = content[index];
    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = true;
      continue;
    }

    if (char === quote) {
      return content.slice(startIndex, index + 1);
    }
  }

  return content.slice(startIndex);
}

function collectBalanced(content: string, startIndex: number, opener: string, closer: string): string {
  let depth = 0;
  let quote: string | null = null;
  let escaped = false;

  for (let index = startIndex; index < content.length; index += 1) {
    const char = content[index];
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }

    if (char === '"' || char === "'" || char === "`") {
      quote = char;
      continue;
    }

    if (char === opener) {
      depth += 1;
    } else if (char === closer) {
      depth -= 1;
      if (depth === 0) {
        return content.slice(startIndex, index + 1);
      }
    }
  }

  return content.slice(startIndex);
}

function extractStructuredFieldNames(field: string, value: unknown): string[] {
  if (field === "alternatives") {
    return extractAlternativeNames(value);
  }

  return extractStructuredNames(value);
}

function extractAlternativeNames(value: unknown): string[] {
  const names = new Set<string>();

  if (typeof value === "string") {
    addComponentLikeNames(value, names);
    return Array.from(names);
  }

  if (Array.isArray(value)) {
    value.forEach((item) => {
      for (const name of extractAlternativeNames(item)) {
        names.add(name);
      }
    });
    return Array.from(names);
  }

  if (isRecord(value)) {
    for (const key of ["useInstead", "component", "relatedComponents"]) {
      if (Object.hasOwn(value, key)) {
        for (const name of extractStructuredNames(value[key])) {
          names.add(name);
        }
      }
    }
  }

  return Array.from(names);
}

function extractStructuredNames(value: unknown): string[] {
  const names = new Set<string>();

  if (typeof value === "string") {
    addComponentLikeNames(value, names);
    return Array.from(names);
  }

  if (Array.isArray(value)) {
    value.forEach((item) => {
      for (const name of extractStructuredNames(item)) {
        names.add(name);
      }
    });
    return Array.from(names);
  }

  if (isRecord(value)) {
    Object.values(value).forEach((nested) => {
      for (const name of extractStructuredNames(nested)) {
        names.add(name);
      }
    });
    return Array.from(names);
  }

  return Array.from(names);
}

function extractStructuredFieldNamesFromSourceSlice(field: string, content: string): string[] {
  if (field === "alternatives") {
    return extractAlternativeNamesFromSourceSlice(content);
  }

  return extractStructuredNamesFromSourceSlice(content);
}

function extractAlternativeNamesFromSourceSlice(content: string): string[] {
  const names = new Set<string>();
  const referenceFieldPattern = /\b(?:useInstead|component|relatedComponents)\s*:/g;

  for (const match of content.matchAll(referenceFieldPattern)) {
    const startIndex = (match.index ?? 0) + match[0].length;
    const slice = readJavaScriptValueSlice(content, startIndex);
    if (!slice) {
      continue;
    }

    for (const name of extractStructuredNamesFromSourceSlice(slice)) {
      names.add(name);
    }
  }

  if (names.size === 0) {
    for (const literal of getStringLiteralContents(content)) {
      addComponentLikeNames(literal, names);
    }
  }

  return Array.from(names);
}

function extractStructuredNamesFromSourceSlice(content: string): string[] {
  const names = new Set<string>();

  for (const literal of getStringLiteralContents(content)) {
    addComponentLikeNames(literal, names);
  }

  if (names.size === 0) {
    addComponentLikeNames(content, names);
  }

  return Array.from(names);
}

function getStringLiteralContents(content: string): string[] {
  const values: string[] = [];
  for (let index = 0; index < content.length; index += 1) {
    const quote = content[index];
    if (quote !== '"' && quote !== "'" && quote !== "`") {
      continue;
    }

    const quoted = collectQuoted(content, index, quote);
    values.push(quoted.slice(1, quoted.endsWith(quote) ? -1 : undefined));
    index += quoted.length - 1;
  }

  return values;
}

function addComponentLikeNames(content: string, names: Set<string>): void {
  const value = stripOuterQuotes(content.trim());
  const exactName = rootComponentReference(value);
  if (exactName) {
    names.add(exactName);
    return;
  }

  if (!LIST_SEPARATOR.test(value)) {
    return;
  }

  for (const part of value.split(LIST_SEPARATOR)) {
    const name = rootComponentReference(part.trim());
    if (isCandidateComponentName(name)) {
      names.add(name);
    }
  }
}

function stripOuterQuotes(value: string): string {
  if (
    value.length >= 2 &&
    ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'")) ||
      (value.startsWith("`") && value.endsWith("`")))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function rootComponentReference(value: string): string | null {
  if (!EXACT_COMPONENT_REFERENCE.test(value)) {
    return null;
  }

  const rootName = value.split(".")[0];
  return isCandidateComponentName(rootName) ? rootName : null;
}

function isCandidateComponentName(name: string | null | undefined): name is string {
  return Boolean(name && COMPONENT_NAME.test(name) && !/^[A-Z0-9]+$/.test(name));
}
