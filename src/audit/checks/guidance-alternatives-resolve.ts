import { getExportedComponents } from "../component-inventory.ts";
import { listTextFiles } from "../file-system.ts";
import type { AuditCheck, CheckContext, CheckResult } from "../types.ts";
import { formatNames, naResult, roundRatio } from "./support.ts";
import { getGuidanceSections, isCandidateGuidanceReferenceName, type GuidanceSection } from "./guidance-support.ts";

type AlternativeReference = {
  name: string;
  subject: string | null;
};

type StructuredAlternativeCollection = {
  references: AlternativeReference[];
  subjects: Set<string>;
};

const ALTERNATIVE_CONTENT = /\b(?:alternatives?|instead)\b/i;

export const guidanceAlternativesResolveCheck: AuditCheck = {
  id: "guidance.alternatives-resolve",
  category: "guidance",
  severity: "warning",
  signal: "alternative signposting",
  carriers: ["meta files", "manifest fields", "docs sections"],
  measure: '% "alternatives/instead" references that resolve to real exports',
  fix: "Reference real components in alternatives guidance.",
  naBehavior: "N/A when no alternatives content exists anywhere; guidance.when-to-use carries the selection gap (uncovered).",
  naReason: "uncovered",
  receipt: "Resolvable cross-references can't be faked by boilerplate.",
  run(context: CheckContext): CheckResult {
    const files = context.files ?? listTextFiles(context.targetPath);
    const components = getExportedComponents(files).components;
    const exported = new Set(components);
    const sections = getGuidanceSections(files, components);
    const structured = collectStructuredAlternativeReferences(sections);
    const alternativeSections = sections.filter((section) => ALTERNATIVE_CONTENT.test(section.content));

    if (structured.references.length === 0 && structured.subjects.size === 0 && alternativeSections.length === 0) {
      return naResult("ratio", "No alternatives/instead guidance content found; alternatives resolution is not applicable.");
    }

    const references = [
      ...structured.references,
      ...collectProseAlternativeReferences(alternativeSections, structured.subjects),
    ];
    const resolved = references.filter((reference) => exported.has(reference.name));
    const unresolved = references.filter((reference) => !exported.has(reference.name)).map((reference) => reference.name);

    if (references.length === 0) {
      return naResult("ratio", "No alternatives/instead component references found; alternatives resolution is not applicable.");
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

function collectProseAlternativeReferences(sections: GuidanceSection[], structuredSubjects: Set<string>): AlternativeReference[] {
  const references = new Map<string, AlternativeReference>();

  for (const section of sections) {
    if (!section.subject || structuredSubjects.has(section.subject)) {
      continue;
    }

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
        references.set(key, { name, subject: section.subject });
      }
    });
  }

  return Array.from(references.values());
}

function extractComponentLikeNames(content: string): string[] {
  const names = new Set<string>();
  const patterns = [
    /`([A-Z][A-Za-z0-9]*)`/g,
    /<([A-Z][A-Za-z0-9]*)(?:\s|>|\/)/g,
    /["']([A-Z][A-Za-z0-9]*)["']/g,
  ];

  for (const pattern of patterns) {
    for (const match of content.matchAll(pattern)) {
      const name = match[1];
      if (isCandidateComponentName(name)) {
        names.add(name);
      }
    }
  }

  return Array.from(names);
}

function collectStructuredAlternativeReferences(sections: GuidanceSection[]): StructuredAlternativeCollection {
  const references = new Map<string, AlternativeReference>();
  const subjects = new Set<string>();

  for (const section of sections) {
    if (!section.structured) {
      continue;
    }

    if (section.subject && section.structuredAlternative) {
      subjects.add(section.subject);
    }

    for (const name of section.structuredReferences ?? []) {
      references.set(`${section.subject ?? ""}:${name}`, { name, subject: section.subject });
    }
  }

  return { references: Array.from(references.values()), subjects };
}

function isCandidateComponentName(name: string | null | undefined): name is string {
  return isCandidateGuidanceReferenceName(name);
}
