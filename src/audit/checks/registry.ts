import type { AuditCheck } from "../types.ts";
import { docsUsageExamplesCheck } from "./docs-usage-examples.ts";

export const CHECK_REGISTRY: AuditCheck[] = [docsUsageExamplesCheck];
