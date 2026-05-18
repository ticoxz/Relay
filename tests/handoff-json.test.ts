import { buildHandoffDocument } from '../src/sync/handoff-build';
import { HANDOFF_JSON_VERSION } from '../src/sync/handoff-types';
import { SummarizedSession } from '../src/summarizer/types';

describe('buildHandoffDocument', () => {
  it('produces stable v1 shape with agent guardrails', () => {
    const summarized: SummarizedSession = {
      id: 'cursor-abc',
      originalCreatedAt: 1,
      summarizedAt: 2,
      project: '/tmp/proj',
      isSummary: true,
      content: {
        summary: 'Worked on Relay MCP',
        decisions: ['Use HANDOFF.json v1'],
        key_files: ['src/mcp/server.ts'],
        next_steps: ['Ship MCP server'],
      },
    };

    const doc = buildHandoffDocument(summarized, summarized, {
      memoryDir: '/tmp/proj/.ai-memory',
      generatedAt: '2026-01-01T00:00:00.000Z',
    });

    expect(doc.version).toBe(HANDOFF_JSON_VERSION);
    expect(doc.agent_instructions.do_not_execute).toBe(true);
    expect(doc.do_not_run.length).toBeGreaterThan(0);
    expect(doc.transcript.decrypt_command).toContain('relay decrypt');
  });
});
