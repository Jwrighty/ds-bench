import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, readFileSync } from "node:fs";
import { CHECK_REGISTRY } from "./checks/registry.ts";
import { detectCarriers, getPackageName, isRecord, listTextFiles } from "./file-system.ts";
import { scoreFindings } from "./scoring.ts";
import type { AuditConfig, AuditFinding, AuditReport } from "./types.ts";

const RUBRIC_VERSION = "ARS v0";

export async function audit(targetPath: string, config: AuditConfig = {}): Promise<AuditReport> {
  const resolvedTarget = resolve(targetPath);
  const files = listTextFiles(resolvedTarget);
  const findings: AuditFinding[] = [];

  for (const check of CHECK_REGISTRY) {
    const result = await check.run({ targetPath: resolvedTarget });
    findings.push({
      checkId: check.id,
      category: check.category,
      severity: check.severity,
      outcome: result.outcome,
      measure: result.measure,
      evidence: result.evidence,
      fix: check.fix,
      receipt: check.receipt,
    });
  }

  return {
    rubricVersion: RUBRIC_VERSION,
    toolVersion: getToolVersion(),
    target: {
      name: getPackageName(resolvedTarget),
      path: resolvedTarget,
      detectedCarriers: detectCarriers(resolvedTarget, files),
    },
    ...scoreFindings(CHECK_REGISTRY, findings, config),
    findings,
  };
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
