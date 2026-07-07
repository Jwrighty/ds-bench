import { getExportedComponentSymbols } from "../component-inventory.ts";
import { isExampleCarrier } from "../example-carriers.ts";
import { isRecord, listTextFiles, walkJson, type TextFile } from "../file-system.ts";
import { isManifestCarrier, recordNamesExport } from "../manifest-carriers.ts";
import type { AuditCheck, CheckContext, CheckResult } from "../types.ts";
import { isKnownDeprecated } from "./deprecation-marked.ts";
import { formatNames, naResult, roundRatio } from "./support.ts";

export const deprecationManifestExclusionCheck: AuditCheck = {
  id: "deprecation.manifest-exclusion",
  category: "deprecation",
  severity: "warning",
  signal: "metadata-level deprecation",
  carriers: ["Storybook !manifest tag", "manifest deprecated fields"],
  measure: "% deprecated components excluded from or tagged in manifest",
  fix: "Tag deprecated entries in the manifest or exclude them from generated agent metadata.",
  naBehavior: "N/A when zero deprecated exports exist, or no manifest exists.",
  receipt: "Manifest-level deprecation signalling keeps deprecated components out of agent-first metadata paths.",
  run(context: CheckContext): CheckResult {
    const files = context.files ?? listTextFiles(context.targetPath);
    const deprecatedComponents = getExportedComponentSymbols(files).filter((symbol) => isKnownDeprecated(symbol, files));

    if (deprecatedComponents.length === 0) {
      return naResult("ratio", "0 deprecated components found; manifest deprecation signalling is not applicable.");
    }

    const manifestFiles = files.filter((file) => isManifestCarrier(file.relativePath));
    const hasStorybookExclusion = deprecatedComponents.some((component) => hasStorybookManifestExclusion(files, component.name));
    if (manifestFiles.length === 0 && !hasStorybookExclusion) {
      return naResult("ratio", "No manifest found; manifest deprecation signalling is not applicable because agent.manifest-coverage carries the gap.");
    }

    const missing = deprecatedComponents.filter((component) => !isExcludedOrTagged(files, manifestFiles, component.name));
    const compliantCount = deprecatedComponents.length - missing.length;
    const ratio = compliantCount / deprecatedComponents.length;

    return {
      outcome: missing.length === 0 ? "pass" : "fail",
      score: ratio,
      measure: {
        kind: "ratio",
        value: roundRatio(ratio),
        detail: `${compliantCount}/${deprecatedComponents.length} deprecated components are excluded from or tagged in a manifest; missing: ${formatNames(
          missing.map((component) => component.name),
        )}`,
      },
      evidence: missing.map((component) => component.name).slice(0, 20),
    };
  },
};

function isExcludedOrTagged(files: TextFile[], manifestFiles: TextFile[], componentName: string): boolean {
  if (hasStorybookManifestExclusion(files, componentName)) {
    return true;
  }

  const records = manifestFiles.flatMap((file) => findManifestRecordsNaming(file.content, componentName));
  if (records.length === 0) {
    return true;
  }

  return records.some(recordMarksDeprecatedOrExcluded);
}

function findManifestRecordsNaming(content: string, componentName: string): Array<Record<string, unknown>> {
  try {
    const parsed = JSON.parse(content) as unknown;
    const records: Array<Record<string, unknown>> = [];
    walkJson(parsed, (node) => {
      if (isRecord(node) && recordNamesExport(node, componentName)) {
        records.push(node);
      }

      return true;
    });
    return records;
  } catch {
    return [];
  }
}

function recordMarksDeprecatedOrExcluded(record: Record<string, unknown>): boolean {
  if (record.deprecated === true || record.status === "deprecated" || record.manifest === false) {
    return true;
  }

  if (Array.isArray(record.tags)) {
    return record.tags.some((tag) => tag === "deprecated" || tag === "!manifest");
  }

  return false;
}

function hasStorybookManifestExclusion(files: TextFile[], componentName: string): boolean {
  return files
    .filter((file) => isExampleCarrier(file.relativePath))
    .some((file) => new RegExp(`\\b${componentName}\\b`).test(file.content) && /["']!manifest["']/.test(file.content));
}
