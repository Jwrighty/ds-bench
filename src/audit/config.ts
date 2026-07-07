import { readFileSync } from "node:fs";
import { CATEGORY_ORDER } from "./categories.ts";
import { isRecord } from "./file-system.ts";
import type { AuditConfig, CategoryId } from "./types.ts";

const CATEGORY_IDS = new Set<CategoryId>(CATEGORY_ORDER);

export function loadAuditConfig(configPath: string): AuditConfig {
  const parsed = JSON.parse(readFileSync(configPath, "utf8")) as unknown;
  if (!isRecord(parsed)) {
    throw new Error("Audit config must be a JSON object.");
  }

  const config: AuditConfig = {};

  if (parsed.weights !== undefined) {
    if (!isRecord(parsed.weights)) {
      throw new Error("Audit config weights must be an object.");
    }

    config.weights = {};
    for (const [key, value] of Object.entries(parsed.weights)) {
      if (!CATEGORY_IDS.has(key as CategoryId)) {
        throw new Error(`Unknown audit weight category: ${key}`);
      }
      if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
        throw new Error(`Audit weight for ${key} must be a non-negative number.`);
      }
      config.weights[key as CategoryId] = value;
    }
  }

  if (parsed.exclude !== undefined) {
    if (!Array.isArray(parsed.exclude) || !parsed.exclude.every((value) => typeof value === "string")) {
      throw new Error("Audit config exclude must be an array of glob strings.");
    }

    config.exclude = parsed.exclude;
  }

  return config;
}
