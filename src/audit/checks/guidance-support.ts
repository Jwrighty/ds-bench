import { basename, extname } from "node:path";
import { COMPONENT_NAME } from "../component-inventory.ts";
import { isManifestCarrier, MANIFEST_NAME_FIELDS } from "../manifest-carriers.ts";
import { escapeRegExp, isRecord, walkJson, type TextFile } from "../file-system.ts";

export type GuidanceSection = {
  relativePath: string;
  subject: string | null;
  content: string;
  structured?: boolean;
  structuredAlternative?: boolean;
  structuredReferences?: string[];
};

const GUIDANCE_EXTENSIONS = new Set([".md", ".mdx", ".json", ".ts", ".tsx"]);
const COMPOUND_SUFFIXES = [".meta", ".stories", ".test", ".spec"] as const;
const STRUCTURED_GUIDANCE_FIELDS = new Set(["useInstead", "alternatives", "relatedComponents", "whenToUse"]);
const STRUCTURED_REFERENCE_FIELDS = new Set(["useInstead", "alternatives", "relatedComponents"]);
const EXACT_COMPONENT_REFERENCE = /^[A-Z][A-Za-z0-9]*(?:\.[A-Z][A-Za-z0-9]*)?$/;
const LIST_SEPARATOR = /\s*(?:,|\/|\bor\b|\band\b|\bwith\b)\s*/i;
const AUXILIARY_PATH_SEGMENT =
  /(?:^|\/)(?:__tests__|__stories__|__mocks__|__fixtures__|\.storybook|tests?|stories?|mocks?|fixtures?|release-notes?)(?:\/)/i;
const AUXILIARY_SOURCE_FILE = /\.(?:test|spec|stories)\.[cm]?[jt]sx?$/i;
const AUXILIARY_PROSE_FILE = /^(?:changelog|changes|migration|migrations|release-notes?)(?:[._-].*)?$/i;
const PLACEHOLDER_REFERENCE_PREFIX = /^(?:My|Example|Sample)[A-Z0-9]/;
const METASYNTACTIC_PARTS = new Set(["Foo", "Bar", "Baz", "Qux"]);

export function getGuidanceFiles(files: TextFile[]): TextFile[] {
  return files.filter(
    (file) =>
      !isAuxiliarySurfacePath(file.relativePath) &&
      (GUIDANCE_EXTENSIONS.has(extname(file.relativePath)) || isManifestCarrier(file.relativePath)),
  );
}

export function isAuxiliarySurfacePath(relativePath: string): boolean {
  const normalized = relativePath.replace(/\\/g, "/");
  if (AUXILIARY_PATH_SEGMENT.test(normalized) || AUXILIARY_SOURCE_FILE.test(normalized)) {
    return true;
  }

  const fileStem = basename(normalized, extname(normalized));
  return AUXILIARY_PROSE_FILE.test(fileStem);
}

export function isCandidateGuidanceReferenceName(name: string | null | undefined): name is string {
  return Boolean(
    name &&
      COMPONENT_NAME.test(name) &&
      !/^[A-Z0-9]+$/.test(name) &&
      !isPlaceholderGuidanceReferenceName(name),
  );
}

function isPlaceholderGuidanceReferenceName(name: string): boolean {
  if (PLACEHOLDER_REFERENCE_PREFIX.test(name)) {
    return true;
  }

  const parts = name.match(/[A-Z][a-z0-9]*/g) ?? [];
  return parts.length > 0 && parts.every((part) => METASYNTACTIC_PARTS.has(part));
}

export function getGuidanceSections(files: TextFile[], components: string[]): GuidanceSection[] {
  return getGuidanceFiles(files).flatMap((file) => sectionsForFile(file, components));
}

export function hasWord(content: string, word: string): boolean {
  return new RegExp(`\\b${escapeRegExp(word)}\\b`).test(content);
}

function sectionsForFile(file: TextFile, components: string[]): GuidanceSection[] {
  const markdownSections = splitMarkdownSections(file, components);
  if (markdownSections.length > 0) {
    return markdownSections;
  }

  const structuredSections = splitStructuredSections(file, components);
  if (structuredSections.length > 0) {
    return structuredSections;
  }

  return [
    {
      relativePath: file.relativePath,
      subject: subjectFromPath(file.relativePath, components),
      content: file.content,
    },
  ];
}

function splitMarkdownSections(file: TextFile, components: string[]): GuidanceSection[] {
  if (![".md", ".mdx"].includes(extname(file.relativePath))) {
    return [];
  }

  const sections: GuidanceSection[] = [];
  const fileSubject = subjectFromPath(file.relativePath, components);
  let current: GuidanceSection | null = null;

  for (const line of file.content.split(/\r?\n/)) {
    const heading = /^(?<marks>#{1,6})\s+(?<text>.+?)\s*$/.exec(line);
    if (heading) {
      if (current) {
        sections.push(current);
      }

      const headingText = heading.groups?.text ?? "";
      current = {
        relativePath: file.relativePath,
        subject: subjectFromText(headingText, components) ?? fileSubject,
        content: line,
      };
      continue;
    }

    if (!current) {
      current = {
        relativePath: file.relativePath,
        subject: fileSubject,
        content: "",
      };
    }

    current.content += `\n${line}`;
  }

  if (current) {
    sections.push(current);
  }

  return sections;
}

function subjectFromPath(relativePath: string, components: string[]): string | null {
  let filename = basename(relativePath, extname(relativePath));
  for (const suffix of COMPOUND_SUFFIXES) {
    if (filename.endsWith(suffix)) {
      filename = filename.slice(0, -suffix.length);
      break;
    }
  }

  return components.find((component) => component === filename) ?? null;
}

function subjectFromText(text: string, components: string[]): string | null {
  return components.find((component) => hasWord(text, component)) ?? null;
}

function splitStructuredSections(file: TextFile, components: string[]): GuidanceSection[] {
  if (isManifestCarrier(file.relativePath)) {
    return splitManifestSections(file, components);
  }

  if (/\.meta\.[cm]?[jt]sx?$/.test(file.relativePath)) {
    return splitMetaSections(file, components);
  }

  return [];
}

function splitManifestSections(file: TextFile, components: string[]): GuidanceSection[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(file.content);
  } catch {
    return [];
  }

  const sections: GuidanceSection[] = [];
  walkJson(parsed, (node, path) => {
    if (!isRecord(node)) {
      return true;
    }

    const subject = subjectFromStructuredRecord(node, path, components);
    if (!subject || !hasStructuredGuidanceField(node)) {
      return true;
    }

    sections.push({
      relativePath: file.relativePath,
      subject,
      content: structuredRecordContent(node),
      structured: true,
      structuredAlternative: hasStructuredReferenceField(node),
      structuredReferences: structuredRecordReferences(node),
    });

    return true;
  });

  return sections;
}

function splitMetaSections(file: TextFile, components: string[]): GuidanceSection[] {
  const subject = subjectFromMetaFile(file, components);
  const slices = getStructuredFieldValueSlices(file.content, STRUCTURED_GUIDANCE_FIELDS);
  if (!subject || slices.length === 0) {
    return [];
  }

  return [
    {
      relativePath: file.relativePath,
      subject,
      content: slices.map(({ field, value }) => `${readableFieldName(field)}: ${value}`).join("\n"),
      structured: true,
      structuredAlternative: slices.some(({ field }) => STRUCTURED_REFERENCE_FIELDS.has(field)),
      structuredReferences: slices.flatMap(({ field, value }) =>
        STRUCTURED_REFERENCE_FIELDS.has(field) ? extractStructuredFieldNamesFromSourceSlice(field, value) : [],
      ),
    },
  ];
}

function subjectFromStructuredRecord(record: Record<string, unknown>, path: string[], components: string[]): string | null {
  const componentSet = new Set(components);
  const pathSubject = path.at(-1);
  if (pathSubject && componentSet.has(pathSubject)) {
    return pathSubject;
  }

  for (const field of MANIFEST_NAME_FIELDS) {
    const value = record[field];
    if (typeof value === "string" && componentSet.has(value)) {
      return value;
    }
  }

  return null;
}

function subjectFromMetaFile(file: TextFile, components: string[]): string | null {
  const byPath = subjectFromPath(file.relativePath, components);
  if (byPath) {
    return byPath;
  }

  const nameField = /\b(?:name|displayName|exportName|component)\s*:\s*["']([A-Z][A-Za-z0-9]*)["']/.exec(file.content)?.[1];
  return nameField && components.includes(nameField) ? nameField : null;
}

function hasStructuredGuidanceField(record: Record<string, unknown>): boolean {
  return Object.keys(record).some((key) => STRUCTURED_GUIDANCE_FIELDS.has(key));
}

function hasStructuredReferenceField(record: Record<string, unknown>): boolean {
  return Object.keys(record).some((key) => STRUCTURED_REFERENCE_FIELDS.has(key));
}

function structuredRecordContent(record: Record<string, unknown>): string {
  return Object.entries(record)
    .filter(([key]) => STRUCTURED_GUIDANCE_FIELDS.has(key))
    .map(([key, value]) => `${readableFieldName(key)}: ${stringifyStructuredValue(value)}`)
    .join("\n");
}

function structuredRecordReferences(record: Record<string, unknown>): string[] {
  return Object.entries(record).flatMap(([key, value]) =>
    STRUCTURED_REFERENCE_FIELDS.has(key) ? extractStructuredFieldNames(key, value) : [],
  );
}

function stringifyStructuredValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  return JSON.stringify(value);
}

function readableFieldName(field: string): string {
  return field.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
}

type StructuredFieldValueSlice = {
  field: string;
  value: string;
};

function getStructuredFieldValueSlices(content: string, fields: Set<string>): StructuredFieldValueSlice[] {
  const slices: StructuredFieldValueSlice[] = [];
  const fieldPattern = new RegExp(`\\b(?:${Array.from(fields).map(escapeRegExp).join("|")})\\s*:`, "g");

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
  return isCandidateGuidanceReferenceName(name);
}
