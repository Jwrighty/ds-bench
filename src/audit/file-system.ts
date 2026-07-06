import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, extname, join, relative } from "node:path";

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mts", ".cts"]);
const EXAMPLE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".md", ".mdx"]);

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
    .filter((path) => SOURCE_EXTENSIONS.has(extname(path)) || EXAMPLE_EXTENSIONS.has(extname(path)))
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

  if (files.some((file) => /\.stories\.[jt]sx?$/.test(file.relativePath) || file.relativePath.endsWith(".stories.mdx"))) {
    carriers.add("Storybook stories/MDX");
  }

  if (files.some((file) => file.relativePath.startsWith("examples/"))) {
    carriers.add("examples dir");
  }

  if (files.some((file) => /canonical-examples/i.test(file.relativePath))) {
    carriers.add("canonical-examples files");
  }

  const packageJson = readJsonFile(join(targetPath, "package.json"));
  if (isRecord(packageJson) && (packageJson.exports || packageJson.types)) {
    carriers.add("package.json exports/types");
  }

  return Array.from(carriers).sort();
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function walk(root: string): string[] {
  let entries: string[];
  try {
    entries = readdirSync(root);
  } catch {
    return [];
  }

  return entries.flatMap((entry) => {
    if (entry === "node_modules" || entry === ".git") {
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
