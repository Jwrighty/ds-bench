import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { isRecord } from "../file-system.ts";
import type { AuditCheck, AuditContext, CheckResult } from "../types.ts";
import { formatNames, naResult, roundRatio } from "./support.ts";
import { hasWord, type GuidanceSection } from "../guidance-support.ts";

type ConfusablePair = readonly [string, string];

const DISAMBIGUATION_CONTENT = /\b(?:alternatives?|choose|instead|prefer|rather than|use|versus|vs\.?|when\s+(?:not\s+)?to\s+use)\b/i;

export const guidanceConfusablePairsCheck: AuditCheck = {
  id: "guidance.confusable-pairs",
  category: "guidance",
  severity: "warning",
  signal: "disambiguation",
  carriers: ["meta files", "manifest fields", "docs sections"],
  measure: "For detected confusable pairs present in the inventory, % pairs that reference each other",
  fix: 'Add mutual "use X instead when..." notes.',
  naBehavior: "N/A when fewer than 2 confusable-pair members, or no complete seed pair, are in inventory (clean).",
  naReason: "clean",
  receipt: "Wrong-component selection is a recurring design-system agent failure mode.",
  run(context: AuditContext): CheckResult {
    const files = context.files;
    const components = context.components;
    const inventory = new Set(components);
    const pairs = readConfusablePairs();
    const pairMembers = new Set(pairs.flatMap((pair) => [...pair]));
    const presentPairMembers = components.filter((component) => pairMembers.has(component));

    if (presentPairMembers.length < 2) {
      return naResult("ratio", "Fewer than 2 seed confusable-pair members are in inventory; disambiguation is not applicable.");
    }

    const inventoryPairs = pairs.filter(([left, right]) => inventory.has(left) && inventory.has(right));
    if (inventoryPairs.length === 0) {
      return naResult("ratio", `No complete seed pair among ${formatNames(presentPairMembers)}; disambiguation is not applicable.`);
    }

    const sections = context.guidanceSections;
    const covered = inventoryPairs.filter(([left, right]) => referencesPair(sections, left, right));
    const missing = inventoryPairs
      .filter((pair) => !covered.includes(pair))
      .map(([left, right]) => `${left}/${right}`);
    const ratio = covered.length / inventoryPairs.length;

    return {
      outcome: missing.length === 0 ? "pass" : "fail",
      score: ratio,
      measure: {
        kind: "ratio",
        value: roundRatio(ratio),
        detail: `${covered.length}/${inventoryPairs.length} detected confusable pairs reference each other; missing: ${formatNames(missing)}`,
      },
      evidence: missing.slice(0, 20),
    };
  },
};

function referencesPair(sections: GuidanceSection[], left: string, right: string): boolean {
  return referencesComponent(sections, left, right) && referencesComponent(sections, right, left);
}

function referencesComponent(sections: GuidanceSection[], subject: string, target: string): boolean {
  return sections.some((section) => {
    if (!hasWord(section.content, target)) {
      return false;
    }

    if (section.subject === subject && DISAMBIGUATION_CONTENT.test(section.content)) {
      return true;
    }

    return false;
  });
}

function readConfusablePairs(): ConfusablePair[] {
  const candidates = [
    join(dirname(fileURLToPath(import.meta.url)), "guidance-confusable-pairs.json"),
    join(findPackageRoot(dirname(fileURLToPath(import.meta.url))) ?? process.cwd(), "src/audit/checks/guidance-confusable-pairs.json"),
  ];

  for (const candidate of candidates) {
    if (!existsSync(candidate)) {
      continue;
    }

    const parsed = JSON.parse(readFileSync(candidate, "utf8")) as unknown;
    if (!Array.isArray(parsed)) {
      continue;
    }

    return parsed.filter(isConfusablePair);
  }

  return [];
}

function isConfusablePair(value: unknown): value is ConfusablePair {
  return Array.isArray(value) && value.length === 2 && typeof value[0] === "string" && typeof value[1] === "string";
}

function findPackageRoot(startPath: string): string | null {
  let current = startPath;

  while (current !== dirname(current)) {
    const packageJsonPath = join(current, "package.json");
    if (existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as unknown;
      if (isRecord(packageJson) && packageJson.name === "ds-bench") {
        return current;
      }
    }

    current = dirname(current);
  }

  return null;
}
