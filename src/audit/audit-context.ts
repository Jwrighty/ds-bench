import type { TextFile } from "./file-system.ts";
import {
  getExportedComponents,
  getExportedComponentSymbols,
  getExportedSymbols,
  getPublicPackage,
  type ExportedSymbol,
  type PublicPackage,
} from "./component-inventory.ts";
import { getGuidanceSections, type GuidanceSection } from "./guidance-support.ts";
import { getTokenSources, type TokenSource } from "./token-sources.ts";

/**
 * The parsed, memoized view of a target the audit checks read from. Each accessor
 * runs its backing derivation once and caches the result: the whole tree is parsed
 * a handful of times per audit rather than once per check.
 */
export type AuditContext = {
  targetPath: string;
  files: TextFile[];
  exportedSymbols: ExportedSymbol[];
  components: string[];
  exportedComponentSymbols: ExportedSymbol[];
  publicPackage: PublicPackage | null;
  guidanceSections: GuidanceSection[];
  tokenSources: TokenSource[];
};

export function createAuditContext(files: TextFile[], targetPath: string): AuditContext {
  const exportedSymbols = memoize(() => getExportedSymbols(files));
  const components = memoize(() => getExportedComponents(files).components);
  const exportedComponentSymbols = memoize(() => getExportedComponentSymbols(files));
  const publicPackage = memoize(() => getPublicPackage(files));
  const tokenSources = memoize(() => getTokenSources(files));

  const context: AuditContext = {
    targetPath,
    files,
    get exportedSymbols() {
      return exportedSymbols();
    },
    get components() {
      return components();
    },
    get exportedComponentSymbols() {
      return exportedComponentSymbols();
    },
    get publicPackage() {
      return publicPackage();
    },
    get guidanceSections() {
      return guidanceSections();
    },
    get tokenSources() {
      return tokenSources();
    },
  };

  // Guidance sections depend on the component inventory; read it through the context
  // so both views share one memoized derivation.
  const guidanceSections = memoize(() => getGuidanceSections(files, context.components));

  return context;
}

function memoize<T>(compute: () => T): () => T {
  let computed = false;
  let value: T;
  return () => {
    if (!computed) {
      value = compute();
      computed = true;
    }
    return value;
  };
}
