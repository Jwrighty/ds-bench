import type { TextFile } from "./file-system.ts";

export type CategoryId =
  | "docs"
  | "api"
  | "guidance"
  | "tokens"
  | "deprecation"
  | "agent";

export type Severity = "critical" | "warning" | "info";
export type Outcome = "pass" | "fail" | "na";
export type Confidence = "high" | "medium" | "low";

export type Measure = {
  kind: "ratio" | "count";
  value: number;
  detail: string;
};

export type AuditFinding = {
  checkId: string;
  category: CategoryId;
  severity: Severity;
  outcome: Outcome;
  measure: Measure;
  evidence: string[];
  fix: string;
  receipt: string;
};

export type AuditReport = {
  rubricVersion: string;
  toolVersion: string;
  target: {
    name: string;
    path: string;
    detectedCarriers: string[];
  };
  weights: {
    source: "default" | "custom";
    values: Record<CategoryId, number>;
  };
  composite: number;
  applicability: {
    applicable: number;
    total: number;
    confidence: Confidence;
  };
  categories: Array<{
    id: CategoryId;
    score: number | null;
    applicable: number;
    total: number;
    weightRedistributed: boolean;
  }>;
  findings: AuditFinding[];
};

export type AuditConfig = {
  exclude?: string[];
  weights?: Partial<Record<CategoryId, number>>;
};

export type CheckMetadata = {
  id: string;
  category: CategoryId;
  severity: Severity;
  scored?: boolean;
  signal: string;
  carriers: string[];
  measure: string;
  fix: string;
  naBehavior: string;
  receipt: string;
};

export type CheckResult = {
  outcome: Outcome;
  score: number | null;
  measure: Measure;
  evidence: string[];
};

export type CheckContext = {
  targetPath: string;
  files?: TextFile[];
};

export type AuditCheck = CheckMetadata & {
  run(context: CheckContext): Promise<CheckResult> | CheckResult;
};
