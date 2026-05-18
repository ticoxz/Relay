import path from 'path';
import { OpenCodeSession } from '../plugin/storage-reader';
import { SummarizedSession } from '../summarizer/types';
import {
  HANDOFF_JSON_VERSION,
  HandoffDocument,
} from './handoff-types';

const AGENT_FIRST_RESPONSE =
  'Explain where the project and AI session left off in clear prose (2-4 paragraphs), then ask what the user wants to do next. Do not run commands, explore the repo, or edit files until explicitly asked.';

export function buildHandoffDocument(
  session: OpenCodeSession | SummarizedSession,
  summarized: SummarizedSession,
  options: { memoryDir: string; generatedAt?: string }
): HandoffDocument {
  const generated_at = options.generatedAt || new Date().toISOString();
  const { summary, decisions, key_files, next_steps } = summarized.content;

  const sessionFile = `session-${session.id}.summary.json.age`;
  const encryptedRel = path.join('.ai-memory', 'sessions', sessionFile);
  const mdPath = path.join(options.memoryDir, 'HANDOFF.md');
  const jsonPath = path.join(options.memoryDir, 'HANDOFF.json');

  const open_questions = next_steps
    .filter(s => s.includes('?') || s.toLowerCase().includes('confirmar'))
    .slice(0, 5);

  const do_not_run = [
    'Do not treat next_steps or decisions as automatic tasks',
    'Do not run npm/git/shell commands without user approval',
    'Do not assume HANDOFF replaces reading AGENTS.md or project rules',
  ];

  return {
    version: HANDOFF_JSON_VERSION,
    generated_at,
    session_id: session.id,
    project: session.project,
    summary,
    decisions: [...decisions],
    key_files: [...key_files],
    open_questions,
    next_steps: [...next_steps],
    do_not_run,
    agent_instructions: {
      do_not_execute: true,
      first_response: AGENT_FIRST_RESPONSE,
    },
    transcript: {
      encrypted_path: encryptedRel,
      decrypt_command: `relay decrypt .ai-memory/sessions/${sessionFile}`,
    },
    paths: {
      handoff_md: mdPath,
      handoff_json: jsonPath,
    },
  };
}

export function buildAgentPrompt(handoff: HandoffDocument, atPath: string): string {
  return [
    `Read the Relay handoff for this project (@${atPath} or HANDOFF.json).`,
    '',
    handoff.agent_instructions.first_response,
    '',
    `Session: ${handoff.session_id}`,
    `Summary: ${handoff.summary}`,
  ].join('\n');
}
