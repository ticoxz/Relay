import path from 'path';
import { Server } from '@modelcontextprotocol/sdk/server/index';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types';
import {
  readHandoffJson,
  readHandoffMarkdown,
  listSessionFilesMeta,
} from '../sync/handoff';
import { AgeEncryption } from '../encryption/age';
import fs from 'fs';

function projectRoot(): string {
  return process.env.RELAY_PROJECT_ROOT || process.cwd();
}

function textResult(text: string) {
  return { content: [{ type: 'text' as const, text }] };
}

export function createRelayMcpServer(): Server {
  const server = new Server(
    { name: 'relay', version: '1.3.3' },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'get_handoff',
        description:
          'Read HANDOFF.md from the Relay project (.ai-memory/). Returns agent instructions first — explain context, do not execute tools until user asks.',
        inputSchema: {
          type: 'object',
          properties: {
            project_root: {
              type: 'string',
              description: 'Optional absolute path to git repo root (default: cwd or RELAY_PROJECT_ROOT)',
            },
          },
        },
      },
      {
        name: 'get_handoff_json',
        description:
          'Read machine-readable HANDOFF.json (schema v1) with summary, decisions, guardrails, and transcript path.',
        inputSchema: {
          type: 'object',
          properties: {
            project_root: { type: 'string' },
          },
        },
      },
      {
        name: 'list_sessions',
        description:
          'List encrypted/plain session files in .ai-memory/sessions/ (metadata only, no decrypt).',
        inputSchema: {
          type: 'object',
          properties: {
            project_root: { type: 'string' },
          },
        },
      },
      {
        name: 'decrypt_session',
        description:
          'Decrypt a session file from .ai-memory/sessions/ using local age + SSH recipients. Requires filename only.',
        inputSchema: {
          type: 'object',
          properties: {
            file_name: {
              type: 'string',
              description: 'e.g. session-cursor-abc.summary.json.age',
            },
            project_root: { type: 'string' },
          },
          required: ['file_name'],
        },
      },
      {
        name: 'sync_status',
        description:
          'Quick Relay status: whether HANDOFF files exist and how many sessions are stored.',
        inputSchema: {
          type: 'object',
          properties: {
            project_root: { type: 'string' },
          },
        },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const root =
      typeof request.params.arguments?.project_root === 'string'
        ? request.params.arguments.project_root
        : projectRoot();

    try {
      switch (request.params.name) {
        case 'get_handoff': {
          const doc = readHandoffJson(root);
          const md = readHandoffMarkdown(root);
          if (!md && !doc) {
            return textResult(
              'No HANDOFF found. Run `relay init` and `relay sync --handoff` in the project first.'
            );
          }
          const parts: string[] = [];
          if (doc?.agent_instructions) {
            parts.push('=== AGENT INSTRUCTIONS (follow first) ===');
            parts.push(`do_not_execute: ${doc.agent_instructions.do_not_execute}`);
            parts.push(doc.agent_instructions.first_response);
            parts.push('');
          }
          if (md) parts.push(md);
          return textResult(parts.join('\n'));
        }

        case 'get_handoff_json': {
          const doc = readHandoffJson(root);
          if (!doc) {
            return textResult('No HANDOFF.json found. Run `relay sync --handoff`.');
          }
          return textResult(JSON.stringify(doc, null, 2));
        }

        case 'list_sessions': {
          const files = listSessionFilesMeta(root);
          if (files.length === 0) {
            return textResult('No sessions in .ai-memory/sessions/');
          }
          return textResult(JSON.stringify(files, null, 2));
        }

        case 'decrypt_session': {
          const fileName = request.params.arguments?.file_name as string;
          if (!fileName || fileName.includes('..') || fileName.includes('/')) {
            return textResult('Invalid file_name. Use basename only.');
          }
          const filePath = path.join(root, '.ai-memory', 'sessions', fileName);
          if (!fs.existsSync(filePath)) {
            return textResult(`File not found: ${filePath}`);
          }
          if (!filePath.endsWith('.age')) {
            return textResult(fs.readFileSync(filePath, 'utf-8'));
          }
          const decrypted = AgeEncryption.decrypt(filePath);
          return textResult(decrypted);
        }

        case 'sync_status': {
          const memoryDir = path.join(root, '.ai-memory');
          const hasMd = fs.existsSync(path.join(memoryDir, 'HANDOFF.md'));
          const hasJson = fs.existsSync(path.join(memoryDir, 'HANDOFF.json'));
          const sessions = listSessionFilesMeta(root);
          return textResult(
            JSON.stringify(
              {
                project_root: root,
                handoff_md: hasMd,
                handoff_json: hasJson,
                session_count: sessions.length,
                latest_session: sessions[0]?.fileName || null,
              },
              null,
              2
            )
          );
        }

        default:
          throw new Error(`Unknown tool: ${request.params.name}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return textResult(`Error: ${msg}`);
    }
  });

  return server;
}

export async function runRelayMcpServer(): Promise<void> {
  const server = createRelayMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
