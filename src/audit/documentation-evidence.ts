import { extname } from "node:path";
import { isExampleCarrier } from "./example-carriers.ts";
import { escapeRegExp, type TextFile } from "./file-system.ts";

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
  const nameWord = new RegExp(`\\b${escapeRegExp(name)}\\b`);
  let inTableBody = false;

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (line.length === 0) {
      inTableBody = false;
      continue;
    }

    const heading = /^#{1,6}\s+(?<text>.+)$/.exec(line);
    if (heading?.groups?.text && nameWord.test(heading.groups.text)) {
      return true;
    }

    if (isTableSeparatorRow(line)) {
      inTableBody = true;
      continue;
    }

    if (inTableBody && line.includes("|")) {
      const cells = line
        .split("|")
        .map((cell) => cell.replace(/[`*_]/g, "").trim())
        .filter((cell) => cell.length > 0);
      if (cells.includes(name)) {
        return true;
      }
    }
  }

  return false;
}

// A GitHub table separator row: pipes/colons/dashes/spaces only, at least one
// pipe and one run of dashes — distinguishing it from a plain `---` horizontal rule.
function isTableSeparatorRow(line: string): boolean {
  return /^[\s|:-]+$/.test(line) && line.includes("|") && /-{3,}/.test(line);
}

/** The export is imported by name (named or default import) in example-carrier source — an importable usage example. */
export function exampleImportsExport(content: string, name: string): boolean {
  for (const match of content.matchAll(/\bimport\s+(?<clause>[^;]+?)\s+from\s+["'][^"']+["']/g)) {
    // Drop a leading `type` so an `import type { … }` reads as an import, not a default named `type`.
    const clause = (match.groups?.clause ?? "").trim().replace(/^type\s+/, "");

    const named = /\{(?<specifiers>[^}]*)\}/.exec(clause);
    if (named?.groups?.specifiers) {
      for (const specifier of named.groups.specifiers.split(",")) {
        const imported = specifier.trim().replace(/^type\s+/, "").split(/\s+as\s+/)[0]?.trim();
        if (imported === name) {
          return true;
        }
      }
    }

    if (!clause.startsWith("{")) {
      const defaultMatch = /^(?<local>[A-Za-z_$][\w$]*)/.exec(clause);
      if (defaultMatch?.groups?.local === name) {
        return true;
      }
    }
  }

  return false;
}

/**
 * The first `.md`/`.mdx` section-or-table entry or importable example that
 * documents `name`, or `null` when none does. This is the mechanical evidence
 * shared by the scored undocumented-exports check and the unscored
 * zombie-exports check where their carrier sets overlap.
 */
export function findDocOrExampleCarrier(name: string, files: TextFile[]): string | null {
  for (const file of files) {
    if (isExampleCarrier(file.relativePath)) {
      if (exampleImportsExport(file.content, name)) {
        return file.relativePath;
      }
    } else if (isMarkdownDocCarrier(file.relativePath) && hasMarkdownDocEntry(file.content, name)) {
      return file.relativePath;
    }
  }

  return null;
}
