import type { AuditCheck } from "../types.ts";
import { agentManifestCoverageCheck } from "./agent-manifest-coverage.ts";
import { apiTypesResolveCheck } from "./api-types-resolve.ts";
import { deprecationMarkedCheck } from "./deprecation-marked.ts";
import { deprecationMigrationNotesCheck } from "./deprecation-migration-notes.ts";
import { docsExampleImportsRealCheck } from "./docs-example-imports-real.ts";
import { docsPropDescriptionsCheck } from "./docs-prop-descriptions.ts";
import { docsUndocumentedExportsCheck } from "./docs-undocumented-exports.ts";
import { docsUsageExamplesCheck } from "./docs-usage-examples.ts";
import { guidanceWhenToUseCheck } from "./guidance-when-to-use.ts";
import { tokensHardcodedValuesCheck } from "./tokens-hardcoded-values.ts";

export const CHECK_REGISTRY: AuditCheck[] = [
  docsPropDescriptionsCheck,
  docsUsageExamplesCheck,
  docsExampleImportsRealCheck,
  docsUndocumentedExportsCheck,
  apiTypesResolveCheck,
  guidanceWhenToUseCheck,
  tokensHardcodedValuesCheck,
  deprecationMarkedCheck,
  deprecationMigrationNotesCheck,
  agentManifestCoverageCheck,
];
