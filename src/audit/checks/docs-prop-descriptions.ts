import { getPropsForComponent } from "../component-props.ts";
import { getExportedSymbols, COMPONENT_NAME } from "../component-inventory.ts";
import { isRecord, listTextFiles, walkJson, type TextFile } from "../file-system.ts";
import { MANIFEST_NAME_FIELDS } from "../manifest-carriers.ts";
import type { AuditCheck, CheckContext, CheckResult } from "../types.ts";
import { formatNames, hasCommentDescription, roundRatio } from "./support.ts";

export const docsPropDescriptionsCheck: AuditCheck = {
  id: "docs.prop-descriptions",
  category: "docs",
  severity: "warning",
  signal: "prop documentation",
  carriers: ["JSDoc/TSDoc", "manifest prop docs"],
  measure: "% exported components whose public props carry descriptions",
  fix: "Add TSDoc descriptions to public props, starting with the most-used components.",
  naBehavior: "Never N/A; undocumented public props are a scored docs gap.",
  receipt: "Agents invent props when public prop contracts lack descriptions.",
  run(context: CheckContext): CheckResult {
    const files = context.files ?? listTextFiles(context.targetPath);
    const filesByPath = new Map(files.map((file) => [file.relativePath, file]));
    const componentSymbols = getExportedSymbols(files).filter((symbol) => symbol.kind === "value" && COMPONENT_NAME.test(symbol.name));

    if (componentSymbols.length === 0) {
      return {
        outcome: "fail",
        score: 0,
        measure: {
          kind: "ratio",
          value: 0,
          detail: "0/0 exported components have documented public props; missing: no exports found",
        },
        evidence: [],
      };
    }

    const covered = new Set<string>();
    const evidence: string[] = [];

    for (const symbol of componentSymbols) {
      const file = filesByPath.get(symbol.relativePath);
      const props = file ? getPropsForComponent(file.content, symbol.name, filesByPath, symbol.relativePath) : [];
      const manifestDescriptions = getManifestPropDescriptions(files, symbol.name);
      const missingProps = props.filter((prop) => !hasCommentDescription(prop.leadingComment) && !manifestDescriptions.has(prop.name));

      if (missingProps.length === 0) {
        covered.add(symbol.name);
      } else {
        evidence.push(`${symbol.name}: ${formatNames(missingProps.map((prop) => prop.name))}`);
      }
    }

    const missing = componentSymbols.map((symbol) => symbol.name).filter((component) => !covered.has(component));
    const ratio = covered.size / componentSymbols.length;

    return {
      outcome: missing.length === 0 ? "pass" : "fail",
      score: ratio,
      measure: {
        kind: "ratio",
        value: roundRatio(ratio),
        detail: `${covered.size}/${componentSymbols.length} exported components have documented public props; missing: ${formatNames(missing)}`,
      },
      evidence: evidence.slice(0, 20),
    };
  },
};

function getManifestPropDescriptions(files: TextFile[], componentName: string): Set<string> {
  const descriptions = new Set<string>();

  for (const file of files.filter((candidate) => candidate.relativePath.endsWith(".json"))) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(file.content);
    } catch {
      continue;
    }

    walkJson(parsed, (node) => {
      if (isRecord(node) && recordNamesComponent(node, componentName)) {
        collectPropDescriptions(node.props, descriptions);
        collectPropDescriptions(node.properties, descriptions);
      }

      return true;
    });
  }

  return descriptions;
}

function collectPropDescriptions(value: unknown, descriptions: Set<string>): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      if (isRecord(item) && typeof item.name === "string" && typeof item.description === "string" && item.description.trim().length > 0) {
        descriptions.add(item.name);
      }
    }
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  for (const [name, prop] of Object.entries(value)) {
    if (typeof prop === "string" && prop.trim().length > 0) {
      descriptions.add(name);
    } else if (isRecord(prop) && typeof prop.description === "string" && prop.description.trim().length > 0) {
      descriptions.add(name);
    }
  }
}

function recordNamesComponent(record: Record<string, unknown>, componentName: string): boolean {
  return MANIFEST_NAME_FIELDS.some((field) => record[field] === componentName);
}
