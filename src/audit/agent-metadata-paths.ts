export const AGENT_CONTEXT_FILE_PATTERN = /(^|\/)(?:AGENTS\.md|CLAUDE\.md|\.cursorrules)$/;
export const AGENT_INSTRUCTION_FILE_PATTERN = /(^|\/)(?:AGENTS\.md|CLAUDE\.md|DESIGN\.md|\.cursorrules)$/;
export const LLMS_TXT_FILE_PATTERN = /(^|\/)llms\.txt$/i;

export function isAgentMetadataFile(relativePath: string): boolean {
  return AGENT_INSTRUCTION_FILE_PATTERN.test(relativePath);
}

export function isLlmsTxtFile(relativePath: string): boolean {
  return LLMS_TXT_FILE_PATTERN.test(relativePath);
}
