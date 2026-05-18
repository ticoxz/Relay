import fs from 'fs';
import path from 'path';
import os from 'os';
import { generateHandoff } from '../src/sync/handoff';
import { OpenCodeSession } from '../src/plugin/storage-reader';

jest.mock('../src/core/config', () => ({
  ConfigManager: {
    load: () => ({ summarizer: { provider: 'none' } }),
  },
}));

describe('generateHandoff', () => {
  const testDir = path.join(os.tmpdir(), 'contextvc-handoff-test');
  const originalCwd = process.cwd();

  beforeEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
    fs.mkdirSync(path.join(testDir, '.ai-memory'), { recursive: true });
    process.chdir(testDir);
  });

  afterAll(() => {
    process.chdir(originalCwd);
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('writes HANDOFF.md from a session', async () => {
    const session: OpenCodeSession = {
      id: 'handoff-1',
      createdAt: Date.now(),
      project: testDir,
      messages: [
        { role: 'user', content: 'Implement feature X', timestamp: 1 },
        { role: 'assistant', content: 'Done in src/feature.ts', timestamp: 2 },
      ],
    };

    const out = await generateHandoff(session);
    expect(fs.existsSync(out.mdPath)).toBe(true);
    expect(fs.existsSync(out.jsonPath)).toBe(true);
    const content = fs.readFileSync(out.mdPath, 'utf-8');
    expect(content).toContain('# AI Session Handoff');
    expect(content).toContain('For the assistant');
    expect(content).toContain('handoff-1');
    const json = JSON.parse(fs.readFileSync(out.jsonPath, 'utf-8'));
    expect(json.version).toBe(1);
    expect(json.agent_instructions.do_not_execute).toBe(true);
    expect(json.session_id).toBe('handoff-1');
  });
});
