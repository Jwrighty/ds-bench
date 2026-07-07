import { getExportedComponents, COMPONENT_NAME } from "../component-inventory.ts";
import { listTextFiles } from "../file-system.ts";
import type { AuditCheck, CheckContext, CheckResult } from "../types.ts";
import { formatNames, roundRatio } from "./support.ts";
import { getGuidanceSections, type GuidanceSection } from "./guidance-support.ts";

type AlternativeReference = {
  name: string;
};

const ALTERNATIVE_CONTENT = /\b(?:alternatives?|instead)\b/i;
const COMPONENT_WORD = /\b[A-Z][A-Za-z0-9]*\b/g;
const COMMON_GUIDANCE_WORDS = new Set([
  "Alternative",
  "Alternatives",
  "Avoid",
  "Choose",
  "Docs",
  "For",
  "Prefer",
  "Read",
  "See",
  "Try",
  "Use",
  "When",
]);

export const guidanceAlternativesResolveCheck: AuditCheck = {
  id: "guidance.alternatives-resolve",
  category: "guidance",
  severity: "warning",
  signal: "alternative signposting",
  carriers: ["meta files", "manifest fields", "docs sections"],
  measure: '% "alternatives/instead" references that resolve to real exports',
  fix: "Reference real components in alternatives guidance.",
  naBehavior: "N/A when no alternatives content exists anywhere; guidance.when-to-use carries the selection gap.",
  receipt: "Resolvable cross-references can't be faked by boilerplate.",
  run(context: CheckContext): CheckResult {
    const files = context.files ?? listTextFiles(context.targetPath);
    const components = getExportedComponents(files).components;
    const exported = new Set(components);
    const sections = getGuidanceSections(files, components);
    const alternativeSections = sections.filter((section) => ALTERNATIVE_CONTENT.test(section.content));

    if (alternativeSections.length === 0) {
      return {
        outcome: "na",
        score: null,
        measure: {
          kind: "ratio",
          value: 0,
          detail: "No alternatives/instead guidance content found; alternatives resolution is not applicable.",
        },
        evidence: [],
      };
    }

    const references = collectAlternativeReferences(alternativeSections);
    const resolved = references.filter((reference) => exported.has(reference.name));
    const unresolved = references.filter((reference) => !exported.has(reference.name)).map((reference) => reference.name);

    if (references.length === 0) {
      return {
        outcome: "fail",
        score: 0,
        measure: {
          kind: "ratio",
          value: 0,
          detail: "0/0 alternatives/instead component references resolve to exported components; unresolved: none",
        },
        evidence: [],
      };
    }

    const ratio = resolved.length / references.length;

    return {
      outcome: unresolved.length === 0 ? "pass" : "fail",
      score: ratio,
      measure: {
        kind: "ratio",
        value: roundRatio(ratio),
        detail: `${resolved.length}/${references.length} alternatives/instead component references resolve to exported components; unresolved: ${formatNames(unresolved)}`,
      },
      evidence: Array.from(new Set(unresolved)).slice(0, 20),
    };
  },
};

function collectAlternativeReferences(sections: GuidanceSection[]): AlternativeReference[] {
  const references = new Map<string, AlternativeReference>();

  for (const section of sections) {
    const segments = section.content.split(/(?:\r?\n){2,}|(?<=[.!?])\s+/);
    segments.forEach((segment, index) => {
      if (!ALTERNATIVE_CONTENT.test(segment)) {
        return;
      }

      for (const name of extractComponentLikeNames(segment)) {
        if (section.subject && name === section.subject) {
          continue;
        }

        const key = `${section.relativePath}:${index}:${name}`;
        references.set(key, { name });
      }
    });
  }

  return Array.from(references.values());
}

function extractComponentLikeNames(content: string): string[] {
  const names = new Set<string>();

  for (const match of content.matchAll(COMPONENT_WORD)) {
    const name = match[0];
    if (COMPONENT_NAME.test(name) && !COMMON_GUIDANCE_WORDS.has(name)) {
      names.add(name);
    }
  }

  return Array.from(names);
}
