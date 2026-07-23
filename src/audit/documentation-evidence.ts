import { extname } from "node:path";
import ts from "typescript";
import { isExampleCarrier } from "./example-carriers.ts";
import { escapeRegExp, type TextFile } from "./file-system.ts";

const DOCUMENTED_EXPORT_COLUMN_NAMES = new Set(["api", "component", "export", "name"]);
const DOCUMENTATION_COLUMN_NAMES = new Set(["description", "purpose", "summary", "usage", "when to use"]);

// One mechanical rule for "this export is documented": a directly detectable
// carrier documents or demonstrates it, rather than a bare occurrence of its
// name in prose. An audit log, task brief, changelog, or ADR that merely names
// an export is an incidental mention and earns no documentation credit.

/** A `.md`/`.mdx` file carries dedicated Markdown documentation (sections, API tables). */
export function isMarkdownDocCarrier(relativePath: string): boolean {
  const extension = extname(relativePath);
  return extension === ".md" || extension === ".mdx";
}

/**
 * A dedicated Markdown section (a heading naming the export) or an API-table
 * entry (a data row of a real table whose own cell is the export name). Both are
 * structural documentation of the export; a bare name inside a paragraph — or an
 * incidental pipe-containing prose line — is not. A table row only counts once a
 * separator row (`| --- |`) has established that we are inside a table body.
 */
export function hasMarkdownDocEntry(content: string, name: string): boolean {
  let pendingTableHeaders: string[] | null = null;
  let tableHeaders: string[] | null = null;

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (line.length === 0) {
      pendingTableHeaders = null;
      tableHeaders = null;
      continue;
    }

    const heading = /^#{1,6}\s+(?<text>.+)$/.exec(line);
    if (heading?.groups?.text && normalizeMarkdownHeading(heading.groups.text) === name) {
      return true;
    }

    if (isTableSeparatorRow(line)) {
      tableHeaders = pendingTableHeaders;
      pendingTableHeaders = null;
      continue;
    }

    const cells = markdownTableCells(line);
    if (!cells) {
      pendingTableHeaders = null;
      tableHeaders = null;
      continue;
    }

    if (!tableHeaders) {
      pendingTableHeaders = cells;
      continue;
    }

    if (isDocumentationTableEntry(tableHeaders, cells, name)) {
      return true;
    }
  }

  return false;
}

// A GitHub table separator row: pipes/colons/dashes/spaces only, at least one
// pipe and one run of dashes — distinguishing it from a plain `---` horizontal rule.
function isTableSeparatorRow(line: string): boolean {
  return /^[\s|:-]+$/.test(line) && line.includes("|") && /-{3,}/.test(line);
}

function markdownTableCells(line: string): string[] | null {
  if (!line.includes("|")) {
    return null;
  }

  const cells = line.split("|");
  if (cells[0]?.trim() === "") {
    cells.shift();
  }
  if (cells.at(-1)?.trim() === "") {
    cells.pop();
  }

  return cells.map(normalizeMarkdownText);
}

function normalizeMarkdownText(value: string): string {
  return value.replace(/[`*_]/g, "").trim();
}

function normalizeMarkdownHeading(value: string): string {
  const normalized = normalizeMarkdownText(value.replace(/\s+#+$/, ""));
  return /^<[A-Za-z_$][\w$]*>$/.test(normalized) ? normalized.slice(1, -1) : normalized;
}

function isDocumentationTableEntry(headers: string[], cells: string[], name: string): boolean {
  const normalizedHeaders = headers.map((header) => header.toLowerCase());
  const exportColumn = normalizedHeaders.findIndex((header) => DOCUMENTED_EXPORT_COLUMN_NAMES.has(header));
  const documentationColumns = normalizedHeaders
    .map((header, index) => (DOCUMENTATION_COLUMN_NAMES.has(header) ? index : -1))
    .filter((index) => index >= 0);

  return (
    exportColumn >= 0 &&
    cells[exportColumn] === name &&
    documentationColumns.some((index) => (cells[index] ?? "").length > 0)
  );
}

/** The export is imported by name and its local binding is referenced elsewhere in example-carrier source. */
export function exampleUsesExport(content: string, name: string): boolean {
  const importPattern = /\bimport\s+(?<clause>[^;]+?)\s+from\s+["'][^"']+["']/g;
  const localNames = new Set<string>();

  for (const match of content.matchAll(importPattern)) {
    // Drop a leading `type` so an `import type { … }` reads as an import, not a default named `type`.
    const clause = (match.groups?.clause ?? "").trim().replace(/^type\s+/, "");

    const named = /\{(?<specifiers>[^}]*)\}/.exec(clause);
    if (named?.groups?.specifiers) {
      for (const specifier of named.groups.specifiers.split(",")) {
        const parts = specifier.trim().replace(/^type\s+/, "").split(/\s+as\s+/);
        const imported = parts[0]?.trim();
        const localName = (parts[1] ?? parts[0])?.trim();
        if (imported === name) {
          if (localName) {
            localNames.add(localName);
          }
        }
      }
    }

    if (!clause.startsWith("{")) {
      const defaultMatch = /^(?<local>[A-Za-z_$][\w$]*)/.exec(clause);
      if (defaultMatch?.groups?.local === name) {
        localNames.add(defaultMatch.groups.local);
      }
    }
  }

  if (localNames.size === 0) {
    return false;
  }

  const sourceFile = ts.createSourceFile("example.tsx", content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let referenced = false;

  function visit(node: ts.Node): void {
    if (referenced || ts.isImportDeclaration(node)) {
      return;
    }
    if (ts.isIdentifier(node) && localNames.has(node.text) && isBindingReferenceIdentifier(node)) {
      referenced = true;
      return;
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return referenced;
}

function isBindingReferenceIdentifier(node: ts.Identifier): boolean {
  const parent = node.parent;

  // `{ Widget }` reads the binding, while `{ Widget: "label" }`, `obj.Widget`,
  // declarations, and labels merely reuse its spelling in a non-reference role.
  if (ts.isShorthandPropertyAssignment(parent) && parent.name === node) {
    return true;
  }
  if ("name" in parent && parent.name === node) {
    return false;
  }
  if (
    (ts.isPropertyAccessExpression(parent) && parent.name === node) ||
    (ts.isQualifiedName(parent) && parent.right === node) ||
    (ts.isBindingElement(parent) && parent.propertyName === node) ||
    (ts.isLabeledStatement(parent) && parent.label === node) ||
    ((ts.isBreakStatement(parent) || ts.isContinueStatement(parent)) && parent.label === node) ||
    (ts.isExportSpecifier(parent) && parent.propertyName === node)
  ) {
    return false;
  }

  return true;
}

/**
 * The first `.md`/`.mdx` section-or-table entry or used import in an example that
 * documents `name`, or `null` when none does. This is the mechanical evidence
 * shared by the scored undocumented-exports check and the unscored
 * zombie-exports check where their carrier sets overlap.
 */
export function findDocOrExampleCarrier(name: string, files: TextFile[]): string | null {
  for (const file of files) {
    if (isExampleCarrier(file.relativePath)) {
      if (exampleUsesExport(file.content, name)) {
        return file.relativePath;
      }
    } else if (isMarkdownDocCarrier(file.relativePath) && hasMarkdownDocEntry(file.content, name)) {
      return file.relativePath;
    }
  }

  return null;
}

/** The first Markdown/example carrier that merely mentions `name`, for inspectable rejected-evidence diagnostics. */
export function findIncidentalDocOrExampleCarrier(name: string, files: TextFile[]): string | null {
  const pattern = new RegExp(`\\b${escapeRegExp(name)}\\b`);
  return (
    files.find(
      (file) =>
        (isExampleCarrier(file.relativePath) || isMarkdownDocCarrier(file.relativePath)) &&
        pattern.test(file.content),
    )?.relativePath ?? null
  );
}
