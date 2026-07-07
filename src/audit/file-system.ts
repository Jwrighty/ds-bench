import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, extname, join, relative } from "node:path";
import { EXAMPLE_CARRIER_KINDS } from "./example-carriers.ts";
import { isManifestCarrier } from "./manifest-carriers.ts";

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mts", ".cts"]);
const EXAMPLE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".md", ".mdx"]);
const STYLE_EXTENSIONS = new Set([".css", ".scss", ".sass", ".less"]);
const DATA_EXTENSIONS = new Set([".json"]);
const IGNORED_DIRECTORIES = new Set([
  ".cache",
  ".claude",
  ".git",
  ".next",
  ".pnpm-store",
  ".turbo",
  ".worktrees",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "storybook-static",
]);

export type TextFile = {
  path: string;
  relativePath: string;
  content: string;
};

export function readJsonFile(path: string): unknown | null {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

export function listTextFiles(root: string): TextFile[] {
  return walk(root)
    .filter(
      (path) =>
        SOURCE_EXTENSIONS.has(extname(path)) ||
        EXAMPLE_EXTENSIONS.has(extname(path)) ||
        STYLE_EXTENSIONS.has(extname(path)) ||
        DATA_EXTENSIONS.has(extname(path)),
    )
    .map((path) => ({
      path,
      relativePath: relative(root, path),
      content: readFileSync(path, "utf8"),
    }));
}

export function getPackageName(targetPath: string): string {
  const packageJson = readJsonFile(join(targetPath, "package.json"));
  if (isRecord(packageJson) && typeof packageJson.name === "string") {
    return packageJson.name;
  }

  return basename(targetPath);
}

export function detectCarriers(targetPath: string, files: TextFile[]): string[] {
  const carriers = new Set<string>();

  if (files.some((file) => SOURCE_EXTENSIONS.has(extname(file.path)))) {
    carriers.add("TypeScript exports");
  }

  for (const kind of EXAMPLE_CARRIER_KINDS) {
    if (files.some((file) => kind.matches(file.relativePath))) {
      carriers.add(kind.label);
    }
  }

  const packageJson = readJsonFile(join(targetPath, "package.json"));
  if (isRecord(packageJson) && (packageJson.exports || packageJson.types)) {
    carriers.add("package.json exports/types");
  }

  if (files.some((file) => isManifestCarrier(file.relativePath))) {
    carriers.add("manifests");
  }

  if (files.some((file) => STYLE_EXTENSIONS.has(extname(file.path)))) {
    carriers.add("CSS files");
  }

  if (files.some((file) => /(--[A-Za-z0-9-]+\s*:)|(["']?\$?(?:color|space|spacing|zIndex|z-index)[A-Za-z0-9_.-]*["']?\s*:)/.test(file.content))) {
    carriers.add("token files/CSS custom properties");
  }

  return Array.from(carriers).sort();
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Escapes regex metacharacters so `value` can be embedded literally in a `RegExp`. */
export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function walk(root: string): string[] {
  let entries: string[];
  try {
    entries = readdirSync(root);
  } catch {
    return [];
  }

  return entries.flatMap((entry) => {
    if (IGNORED_DIRECTORIES.has(entry)) {
      return [];
    }

    const path = join(root, entry);
    const stat = statSync(path);

    if (stat.isDirectory()) {
      return walk(path);
    }

    return stat.isFile() ? [path] : [];
  });
}
