import { getAgentContextFiles, getReferencedComponentNames } from "../agent-metadata-carriers.ts";
import type { AuditCheck, AuditContext, CheckResult } from "../types.ts";
import { formatNames, roundRatio } from "./support.ts";

export const agentContextFileQualityCheck: AuditCheck = {
  id: "agent.context-file-quality",
  category: "agent",
  severity: "warning",
  signal: "agent context accuracy",
  carriers: ["AGENTS.md", "CLAUDE.md", ".cursorrules"],
  measure: "file exists and component references resolve against real exports",
  fix: "Regenerate or correct stale component references in agent context files.",
  naBehavior: "Never N/A; absence or stale references are scored as agent metadata gaps.",
  receipt: "Stale context misleads agents worse than no context.",
  run(context: AuditContext): CheckResult {
    const files = context.files;
    const contextFiles = getAgentContextFiles(files);
    const components = new Set(context.components);

    if (contextFiles.length === 0) {
      return {
        outcome: "fail",
        score: 0,
        measure: {
          kind: "ratio",
          value: 0,
          detail: "0 agent context files found; dead references: no context file",
        },
        evidence: [],
      };
    }

    const references = new Set<string>();
    for (const file of contextFiles) {
      for (const reference of getReferencedComponentNames(file.content)) {
        references.add(reference);
      }
    }

    const deadReferences = Array.from(references).filter((reference) => !components.has(reference)).sort();
    const liveReferenceCount = references.size - deadReferences.length;
    const ratio = references.size === 0 ? 1 : liveReferenceCount / references.size;

    return {
      outcome: deadReferences.length === 0 ? "pass" : "fail",
      score: ratio,
      measure: {
        kind: "ratio",
        value: roundRatio(ratio),
        detail: `${liveReferenceCount}/${references.size} agent context component references resolve against exported components; dead references: ${formatNames(deadReferences)}`,
      },
      evidence: deadReferences.slice(0, 20),
    };
  },
};
