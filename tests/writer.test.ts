import fs from 'fs';
import path from 'path';
import os from 'os';
import { writeSessionsToRepo } from '../src/sync/writer';
import { OpenCodeSession } from '../src/plugin/storage-reader';

jest.mock('../src/encryption/age', () => ({
  AgeEncryption: {
    getRecipients: () => [],
    encrypt: (content: string, filePath: string) => {
      fs.writeFileSync(filePath, content, 'utf-8');
    },
    decrypt: (filePath: string) => fs.readFileSync(filePath, 'utf-8'),
  },
}));

jest.mock('../src/core/config', () => ({
  ConfigManager: {
    load: () => ({
      encryption: { enabled: false },
      summarizer: { provider: 'none' },
    }),
  },
}));

describe('writeSessionsToRepo', () => {
  const testDir = path.join(os.tmpdir(), 'contextvc-writer-test');
  const sessionsDir = path.join(testDir, '.ai-memory', 'sessions');
  const originalCwd = process.cwd();

  const sampleSession: OpenCodeSession = {
    id: 'writer-test-1',
    createdAt: Date.now(),
    project: testDir,
    messages: [{ role: 'user', content: 'test', timestamp: Date.now() }],
  };

  beforeEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
    fs.mkdirSync(sessionsDir, { recursive: true });
    process.chdir(testDir);
  });

  afterAll(() => {
    process.chdir(originalCwd);
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('writes a new session file', async () => {
    const result = await writeSessionsToRepo([sampleSession], true);
    expect(result.written).toBe(1);
    expect(result.skipped).toBe(0);
    expect(fs.existsSync(path.join(sessionsDir, 'session-writer-test-1.json'))).toBe(true);
  });

  it('skips unchanged session on second sync', async () => {
    await writeSessionsToRepo([sampleSession], true);
    const result = await writeSessionsToRepo([sampleSession], true);
    expect(result.written).toBe(0);
    expect(result.skipped).toBe(1);
  });
});
