import type { CategoryId } from "./types.ts";

export const CATEGORY_ORDER: CategoryId[] = [
  "docs",
  "api",
  "guidance",
  "tokens",
  "deprecation",
  "agent",
];

export const CATEGORY_LABELS: Record<CategoryId, string> = {
  docs: "Docs & examples",
  api: "API clarity",
  guidance: "Usage guidance",
  tokens: "Token hygiene",
  deprecation: "Deprecation signalling",
  agent: "Agent metadata",
};

export const DEFAULT_WEIGHTS: Record<CategoryId, number> = {
  docs: 25,
  api: 20,
  guidance: 15,
  tokens: 15,
  deprecation: 15,
  agent: 10,
};
