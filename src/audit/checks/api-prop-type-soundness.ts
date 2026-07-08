import { getPropsForComponent, hasTypeScriptTypes } from "../component-props.ts";
import { getExportedComponentSymbols } from "../component-inventory.ts";
import { listTextFiles } from "../file-system.ts";
import type { AuditCheck, CheckContext, CheckResult } from "../types.ts";
import { formatNames, naResult, roundRatio } from "./support.ts";

type UnsoundProp = {
  component: string;
  prop: string;
  type: "any" | "unknown";
};

export const apiPropTypeSoundnessCheck: AuditCheck = {
  id: "api.prop-type-soundness",
  category: "api",
  severity: "warning",
  signal: "type precision",
  carriers: ["TS types"],
  measure: "any/unknown rate on exported component props",
  fix: "Replace any/unknown props with precise public prop types.",
  naBehavior: "N/A when the system ships no TypeScript types; api.types-resolve carries the importability failure (uncovered).",
  naReason: "uncovered",
  receipt: "Hallucinated-prop detection depends on sound public prop types.",
  run(context: CheckContext): CheckResult {
    const files = context.files ?? listTextFiles(context.targetPath);
    if (!hasTypeScriptTypes(files)) {
      return naResult("ratio", "No TypeScript types found; api.types-resolve carries the importability failure.");
    }

    const filesByPath = new Map(files.map((file) => [file.relativePath, file]));
    const componentSymbols = getExportedComponentSymbols(files);
    const props = componentSymbols.flatMap((symbol) => {
      const file = filesByPath.get(symbol.relativePath);
      return file ? getPropsForComponent(file.content, symbol.name, filesByPath, symbol.relativePath).map((prop) => ({ component: symbol.name, prop })) : [];
    });
    const unsound = props.flatMap(({ component, prop }) => {
      const type = unsoundType(prop.type);
      return type ? [{ component, prop: prop.name, type }] : [];
    });
    const total = props.length;
    const ratio = total === 0 ? 0 : unsound.length / total;

    return {
      outcome: unsound.length === 0 ? "pass" : "fail",
      score: total === 0 ? 1 : 1 - ratio,
      measure: {
        kind: "ratio",
        value: roundRatio(ratio),
        detail: `${unsound.length}/${total} exported component props use any/unknown; offenders: ${formatNames(unsound.map(formatUnsoundProp))}`,
      },
      evidence: unsound.map(formatUnsoundProp).slice(0, 20),
    };
  },
};

function unsoundType(type: string): UnsoundProp["type"] | null {
  if (/\bany\b/.test(type)) {
    return "any";
  }

  if (/\bunknown\b/.test(type)) {
    return "unknown";
  }

  return null;
}

function formatUnsoundProp(prop: UnsoundProp): string {
  return `${prop.component}.${prop.prop} (${prop.type})`;
}
