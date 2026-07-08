#!/usr/bin/env node
import { audit } from "./audit/audit.ts";
import { loadAuditConfig } from "./audit/config.ts";
import { renderAuditReport, type RenderMode } from "./render/terminal.ts";
import type { AuditConfig } from "./audit/types.ts";

type CliOptions = {
  exclude: string[];
  json: boolean;
  renderMode: RenderMode;
  targetPath: string | null;
  configPath: string | null;
};

async function main(argv: string[]): Promise<number> {
  const [command, ...rest] = argv;

  if (command !== "audit") {
    printUsage();
    return 1;
  }

  const options = parseAuditArgs(rest);
  if (!options.targetPath) {
    printUsage();
    return 1;
  }

  let config: AuditConfig = {};
  if (options.configPath) {
    config = loadAuditConfig(options.configPath);
  }
  if (options.exclude.length > 0) {
    config = { ...config, exclude: [...(config.exclude ?? []), ...options.exclude] };
  }

  const report = await audit(options.targetPath, config);
  if (options.json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    process.stdout.write(renderAuditReport(report, { mode: options.renderMode }));
  }

  return 0;
}

function parseAuditArgs(args: string[]): CliOptions {
  const exclude: string[] = [];
  let json = false;
  let renderMode: RenderMode = "normal";
  let targetPath: string | null = null;
  let configPath: string | null = null;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--json") {
      json = true;
    } else if (arg === "--compact") {
      renderMode = "compact";
    } else if (arg === "--verbose") {
      renderMode = "verbose";
    } else if (arg === "--config") {
      configPath = args[index + 1] ?? null;
      index += 1;
    } else if (arg.startsWith("--config=")) {
      configPath = arg.slice("--config=".length);
    } else if (arg === "--exclude") {
      const pattern = args[index + 1];
      if (pattern) {
        exclude.push(pattern);
      }
      index += 1;
    } else if (arg.startsWith("--exclude=")) {
      exclude.push(arg.slice("--exclude=".length));
    } else if (!targetPath) {
      targetPath = arg;
    }
  }

  return { exclude, json, renderMode, targetPath, configPath };
}

function printUsage(): void {
  process.stderr.write("Usage: ds-bench audit <path> [--compact] [--verbose] [--json] [--config <path>] [--exclude <glob>]\n");
}

const exitCode = await main(process.argv.slice(2));
process.exitCode = exitCode;
