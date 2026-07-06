#!/usr/bin/env node
import { audit } from "./audit/audit.ts";
import { renderAuditReport } from "./render/terminal.ts";

type CliOptions = {
  json: boolean;
  targetPath: string | null;
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

  const report = await audit(options.targetPath);
  if (options.json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    process.stdout.write(renderAuditReport(report));
  }

  return 0;
}

function parseAuditArgs(args: string[]): CliOptions {
  let json = false;
  let targetPath: string | null = null;

  for (const arg of args) {
    if (arg === "--json") {
      json = true;
    } else if (!targetPath) {
      targetPath = arg;
    }
  }

  return { json, targetPath };
}

function printUsage(): void {
  process.stderr.write("Usage: ds-bench audit <path> [--json]\n");
}

const exitCode = await main(process.argv.slice(2));
process.exitCode = exitCode;
