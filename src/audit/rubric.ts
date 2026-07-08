import { createHash } from "node:crypto";
import type { AuditCheck } from "./types.ts";

export const RUBRIC_VERSION = "ARS v0.2";

export type CheckRegistryMetadata = {
  scoredCheckCount: number;
  registryFingerprint: string;
};

export function getCheckRegistryMetadata(checks: AuditCheck[]): CheckRegistryMetadata {
  const scoredCheckIds = getScoredCheckIds(checks);

  return {
    scoredCheckCount: scoredCheckIds.length,
    registryFingerprint: fingerprintScoredCheckIds(scoredCheckIds),
  };
}

export function getScoredCheckIds(checks: AuditCheck[]): string[] {
  return checks
    .filter((check) => check.scored !== false)
    .map((check) => check.id)
    .sort();
}

function fingerprintScoredCheckIds(scoredCheckIds: string[]): string {
  return createHash("sha256").update(scoredCheckIds.join("\n")).digest("hex").slice(0, 8);
}
