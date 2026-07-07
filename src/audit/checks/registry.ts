import type { AuditCheck } from "../types.ts";
import { agentManifestCoverageCheck } from "./agent-manifest-coverage.ts";
import { apiBarrelCompletenessCheck } from "./api-barrel-completeness.ts";
import { apiNameCoherenceCheck } from "./api-name-coherence.ts";
import { apiPropTypeSoundnessCheck } from "./api-prop-type-soundness.ts";
import { apiTypesResolveCheck } from "./api-types-resolve.ts";
import { deprecationManifestExclusionCheck } from "./deprecation-manifest-exclusion.ts";
import { deprecationMarkedCheck } from "./deprecation-marked.ts";
import { deprecationMigrationNotesCheck } from "./deprecation-migration-notes.ts";
import { deprecationZombieExportsCheck } from "./deprecation-zombie-exports.ts";
import { docsExampleImportsRealCheck } from "./docs-example-imports-real.ts";
import { docsPropDescriptionsCheck } from "./docs-prop-descriptions.ts";
import { docsUndocumentedExportsCheck } from "./docs-undocumented-exports.ts";
import { docsUsageExamplesCheck } from "./docs-usage-examples.ts";
import { guidanceAlternativesResolveCheck } from "./guidance-alternatives-resolve.ts";
import { guidanceConfusablePairsCheck } from "./guidance-confusable-pairs.ts";
import { guidanceWhenToUseCheck } from "./guidance-when-to-use.ts";
import { tokensHardcodedValuesCheck } from "./tokens-hardcoded-values.ts";
import { tokensMachineReadableCheck } from "./tokens-machine-readable.ts";
import { tokensNamingConsistencyCheck } from "./tokens-naming-consistency.ts";

export const CHECK_REGISTRY: AuditCheck[] = [
  docsPropDescriptionsCheck,
  docsUsageExamplesCheck,
  docsExampleImportsRealCheck,
  docsUndocumentedExportsCheck,
  apiPropTypeSoundnessCheck,
  apiTypesResolveCheck,
  apiNameCoherenceCheck,
  apiBarrelCompletenessCheck,
  guidanceWhenToUseCheck,
  guidanceAlternativesResolveCheck,
  guidanceConfusablePairsCheck,
  tokensHardcodedValuesCheck,
  tokensMachineReadableCheck,
  tokensNamingConsistencyCheck,
  deprecationMarkedCheck,
  deprecationMigrationNotesCheck,
  deprecationManifestExclusionCheck,
  deprecationZombieExportsCheck,
  agentManifestCoverageCheck,
];
