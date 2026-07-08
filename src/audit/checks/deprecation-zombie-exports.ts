import { extname } from "node:path";
import { isExampleCarrier } from "../example-carriers.ts";
import { escapeRegExp, type TextFile } from "../file-system.ts";
import type { AuditCheck, AuditContext, CheckResult } from "../types.ts";
import { formatNames } from "./support.ts";

export const deprecationZombieExportsCheck: AuditCheck = {
  id: "deprecation.zombie-exports",
  category: "deprecation",
  severity: "info",
  scored: false,
  signal: "trap surface",
  carriers: ["barrel exports", "docs", "stories"],
  measure: "exports in barrel but absent from docs/stories, listed",
  fix: "Document, deprecate, or remove zombie exports.",
  naBehavior: "Reported but not scored in v0.",
  receipt: "Zombie exports are trap surface for training-data gravity.",
  run(context: AuditContext): CheckResult {
    const files = context.files;
    const docsAndStories = files.filter(isDocsOrStoryCarrier);
    const exported = context.exportedSymbols.filter((symbol) => symbol.kind === "value");
    const zombies = exported.filter((symbol) => !hasDocsOrStoryPresence(symbol.name, docsAndStories));

    return {
      outcome: zombies.length === 0 ? "pass" : "fail",
      score: null,
      measure: {
        kind: "count",
        value: zombies.length,
        detail: `${zombies.length} barrel ${zombies.length === 1 ? "export is" : "exports are"} absent from docs/stories: ${formatNames(
          zombies.map((symbol) => symbol.name),
        )}`,
      },
      evidence: zombies.map((symbol) => symbol.name).slice(0, 20),
    };
  },
};

function isDocsOrStoryCarrier(file: TextFile): boolean {
  const extension = extname(file.relativePath);
  return extension === ".md" || extension === ".mdx" || isExampleCarrier(file.relativePath);
}

function hasDocsOrStoryPresence(name: string, files: TextFile[]): boolean {
  const pattern = new RegExp(`\\b${escapeRegExp(name)}\\b`);
  return files.some((file) => pattern.test(file.content));
}
