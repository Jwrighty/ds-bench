import { detectMcpCarriers } from "../agent-metadata-carriers.ts";
import type { AuditCheck, AuditContext, CheckResult } from "../types.ts";
import { formatNames } from "./support.ts";

export const agentMcpPresentCheck: AuditCheck = {
  id: "agent.mcp-present",
  category: "agent",
  severity: "info",
  signal: "on-demand context delivery",
  carriers: ["MCP server package", "MCP config"],
  measure: "MCP server package or config is detectable",
  fix: "Consider shipping an MCP server or checked-in MCP configuration for agent context.",
  naBehavior: "Never N/A; absence is reported as a delivery-layer gap.",
  receipt: "On-demand context delivery can outperform portable files for agent workflows.",
  run(context: AuditContext): CheckResult {
    const files = context.files;
    const detections = detectMcpCarriers(files);

    return {
      outcome: detections.length > 0 ? "pass" : "fail",
      score: detections.length > 0 ? 1 : 0,
      measure: {
        kind: "count",
        value: detections.length,
        detail: `${detections.length} MCP package/config carriers detected: ${formatNames(detections)}`,
      },
      evidence: detections.slice(0, 20),
    };
  },
};
