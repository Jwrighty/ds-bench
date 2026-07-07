import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, readFileSync } from "node:fs";
import { CHECK_REGISTRY } from "./checks/registry.ts";
import { detectCarriers, getPackageName, isRecord, listTextFiles } from "./file-system.ts";
import { scoreFindings, toReportFinding, type FindingScoreInput } from "./scoring.ts";
import type { AuditConfig, AuditFinding, AuditReport } from "./types.ts";

const RUBRIC_VERSION = "ARS v0";

export async function audit(targetPath: string, config: AuditConfig = {}): Promise<AuditReport> {
  const resolvedTarget = resolve(targetPath);
  const files = listTextFiles(resolvedTarget);
  const findingsForScoring: FindingScoreInput[] = [];

  for (const check of CHECK_REGISTRY) {
    const result = await check.run({ targetPath: resolvedTarget });
    findingsForScoring.push({
      checkId: check.id,
      category: check.category,
      severity: check.severity,
      outcome: result.outcome,
      score: result.score,
      measure: result.measure,
      evidence: result.evidence,
      fix: check.fix,
      receipt: check.receipt,
    });
  }

  const findings = sortFindingsForReport(findingsForScoring.map(toReportFinding));

  return {
    rubricVersion: RUBRIC_VERSION,
    toolVersion: getToolVersion(),
    target: {
      name: getPackageName(resolvedTarget),
      path: resolvedTarget,
      detectedCarriers: detectCarriers(resolvedTarget, files),
    },
    ...scoreFindings(CHECK_REGISTRY, findingsForScoring, config),
    findings,
  };
}

const SEVERITY_RANK: Record<AuditFinding["severity"], number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

export function sortFindingsForReport(findings: AuditFinding[]): AuditFinding[] {
  return [...findings].sort((left, right) => SEVERITY_RANK[left.severity] - SEVERITY_RANK[right.severity]);
}

function getToolVersion(): string {
  const packageJsonPath = findPackageJson(dirname(fileURLToPath(import.meta.url)));
  if (!packageJsonPath) {
    return "0.0.0";
  }

  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as unknown;

  if (isRecord(packageJson) && typeof packageJson.version === "string") {
    return packageJson.version;
  }

  return "0.0.0";
}

function findPackageJson(startPath: string): string | null {
  let currentPath = startPath;

  while (currentPath !== dirname(currentPath)) {
    const candidate = join(currentPath, "package.json");
    if (existsSync(candidate)) {
      const packageJson = JSON.parse(readFileSync(candidate, "utf8")) as unknown;
      if (isRecord(packageJson) && packageJson.name === "ds-bench") {
        return candidate;
      }
    }

    currentPath = dirname(currentPath);
  }

  return null;
}
