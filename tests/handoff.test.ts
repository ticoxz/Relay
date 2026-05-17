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
    expect(fs.existsSync(out)).toBe(true);
    const content = fs.readFileSync(out, 'utf-8');
    expect(content).toContain('# AI Session Handoff');
    expect(content).toContain('Para el asistente');
    expect(content).toContain('handoff-1');
  });
});
