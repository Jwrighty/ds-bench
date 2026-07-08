import { existsSync } from "node:fs";
import { join } from "node:path";
import { getLlmsTxtFiles, resolveLlmsLocalReference } from "../agent-metadata-carriers.ts";
import type { AuditCheck, AuditContext, CheckResult } from "../types.ts";
import { formatNames, roundRatio } from "./support.ts";

export const agentLlmsTxtCheck: AuditCheck = {
  id: "agent.llms-txt",
  category: "agent",
  severity: "info",
  signal: "agent discovery index",
  carriers: ["llms.txt"],
  measure: "present; local/relative references resolve; external URLs are syntax-valid only",
  fix: "Add or repair llms.txt references.",
  naBehavior: "Never N/A; absence or broken references are scored as agent discovery gaps.",
  receipt: "llms.txt is a contested convention, so it is weighted low but still captures discovery intent.",
  run(context: AuditContext): CheckResult {
    const files = context.files;
    const llmsFiles = getLlmsTxtFiles(files);

    if (llmsFiles.length === 0) {
      return {
        outcome: "fail",
        score: 0,
        measure: {
          kind: "ratio",
          value: 0,
          detail: "0 llms.txt files found; invalid references: missing llms.txt",
        },
        evidence: [],
      };
    }

    const invalidReferences: string[] = [];
    let totalReferences = 0;

    for (const file of llmsFiles) {
      for (const href of extractLlmsReferences(file.content)) {
        if (shouldSkipReference(href)) {
          continue;
        }

        totalReferences += 1;
        if (isExternalReference(href)) {
          if (!isValidExternalUrl(href)) {
            invalidReferences.push(href);
          }
          continue;
        }

        const resolved = resolveLlmsLocalReference(file, href);
        if (resolved.length === 0 || !existsSync(join(context.targetPath, resolved))) {
          invalidReferences.push(href);
        }
      }
    }

    const validReferences = totalReferences - invalidReferences.length;
    const ratio = totalReferences === 0 ? 1 : validReferences / totalReferences;

    return {
      outcome: invalidReferences.length === 0 ? "pass" : "fail",
      score: ratio,
      measure: {
        kind: "ratio",
        value: roundRatio(ratio),
        detail: `${validReferences}/${totalReferences} llms.txt references are valid; invalid references: ${formatNames(invalidReferences)}`,
      },
      evidence: invalidReferences.slice(0, 20),
    };
  },
};

function extractLlmsReferences(content: string): string[] {
  const references = new Set<string>();

  for (const match of content.matchAll(/\[[^\]]+\]\(([^)\s]+)\)/g)) {
    references.add(match[1]);
  }

  for (const match of content.matchAll(/(?<!\()(?<url>https?:\/\/[^\s<>)]+)/g)) {
    const url = match.groups?.url;
    if (url) {
      references.add(url.replace(/[.,;:]+$/, ""));
    }
  }

  for (const line of content.split(/\r?\n/)) {
    const candidate = line.trim().replace(/^[-*]\s+/, "");
    if (isBareLocalReference(candidate)) {
      references.add(candidate);
    }
  }

  return Array.from(references).sort();
}

function isExternalReference(href: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(href);
}

function isValidExternalUrl(href: string): boolean {
  try {
    const parsed = new URL(href);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function shouldSkipReference(href: string): boolean {
  return href.startsWith("#") || href.startsWith("mailto:");
}

function isBareLocalReference(value: string): boolean {
  return /^(?:\.{1,2}\/|\/)?[A-Za-z0-9._/-]+\.(?:css|js|jsx|json|md|mdx|ts|tsx|txt)(?:#[A-Za-z0-9._/-]+)?$/.test(value);
}
