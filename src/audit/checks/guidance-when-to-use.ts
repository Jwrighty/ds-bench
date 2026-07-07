import { extname } from "node:path";
import { getExportedComponents } from "../component-inventory.ts";
import { isManifestCarrier } from "../manifest-carriers.ts";
import { escapeRegExp, listTextFiles } from "../file-system.ts";
import type { AuditCheck, CheckContext, CheckResult } from "../types.ts";
import { formatNames, roundRatio } from "./support.ts";

export const guidanceWhenToUseCheck: AuditCheck = {
  id: "guidance.when-to-use",
  category: "guidance",
  severity: "warning",
  signal: "selection guidance",
  carriers: ["meta files", "manifest fields", "docs sections"],
  measure: "% components with when-to-use / when-not content",
  fix: "Add when-to-use/when-not sections to component docs.",
  naBehavior: "Never N/A; missing guidance is a scored selection gap.",
  receipt: "Agents must choose components, not just call them (Atlassian recreation finding).",
  run(context: CheckContext): CheckResult {
    const files = context.files ?? listTextFiles(context.targetPath);
    const components = getExportedComponents(files).components;

    if (components.length === 0) {
      return {
        outcome: "fail",
        score: 0,
        measure: {
          kind: "ratio",
          value: 0,
          detail: "0/0 exported components include when-to-use guidance; missing: no exports found",
        },
        evidence: [],
      };
    }

    const covered = new Set<string>();
    const docsAndMetaFiles = files.filter(
      (file) => [".md", ".mdx", ".json", ".ts", ".tsx"].includes(extname(file.relativePath)) || isManifestCarrier(file.relativePath),
    );

    for (const component of components) {
      if (docsAndMetaFiles.some((file) => hasGuidanceForComponent(file.content, component))) {
        covered.add(component);
      }
    }

    const missing = components.filter((component) => !covered.has(component));
    const ratio = covered.size / components.length;

    return {
      outcome: missing.length === 0 ? "pass" : "fail",
      score: ratio,
      measure: {
        kind: "ratio",
        value: roundRatio(ratio),
        detail: `${covered.size}/${components.length} exported components include when-to-use guidance; missing: ${formatNames(missing)}`,
      },
      evidence: missing.slice(0, 20),
    };
  },
};

function hasGuidanceForComponent(content: string, component: string): boolean {
  const componentPattern = new RegExp(`\\b${escapeRegExp(component)}\\b`);
  if (!componentPattern.test(content)) {
    return false;
  }

  return /\bwhen\s+(?:not\s+)?to\s+use\b|when[-_\s]?not|when[-_\s]?to[-_\s]?use|usageGuidance|useWhen|avoidWhen/i.test(content);
}
