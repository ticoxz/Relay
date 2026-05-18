/** Stable v1 contract for HANDOFF.json — breaking changes require version: 2 */
export const HANDOFF_JSON_VERSION = 1;

export interface HandoffAgentInstructions {
  do_not_execute: boolean;
  first_response: string;
}

export interface HandoffDocument {
  version: typeof HANDOFF_JSON_VERSION;
  generated_at: string;
  session_id: string;
  project: string;
  summary: string;
  decisions: string[];
  key_files: string[];
  open_questions: string[];
  next_steps: string[];
  do_not_run: string[];
  agent_instructions: HandoffAgentInstructions;
  transcript: {
    encrypted_path: string;
    decrypt_command: string;
  };
  paths: {
    handoff_md: string;
    handoff_json: string;
  };
}

export interface HandoffGenerateResult {
  mdPath: string;
  jsonPath: string;
}
