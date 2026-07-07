import type { AuditCheck } from "../types.ts";
import { deprecationMigrationNotesCheck } from "./deprecation-migration-notes.ts";
import { docsExampleImportsRealCheck } from "./docs-example-imports-real.ts";
import { docsUsageExamplesCheck } from "./docs-usage-examples.ts";

export const CHECK_REGISTRY: AuditCheck[] = [
  docsUsageExamplesCheck,
  docsExampleImportsRealCheck,
  deprecationMigrationNotesCheck,
];
