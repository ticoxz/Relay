import path from 'path';
import { VSCodeReader } from '../src/plugin/vscode-reader';

const fixturesDir = path.join(__dirname, 'fixtures', 'vscode');

describe('VSCodeReader', () => {
  it('parses flat JSON Copilot session', async () => {
    const sessions = await VSCodeReader.readFromChatSessionsDir(
      fixturesDir,
      '/tmp/relay-vscode-test'
    );
    const flat = sessions.find(s => s.id === 'vscode-aaaa-bbbb-cccc-dddd');
    expect(flat).toBeDefined();
    expect(flat!.messages.length).toBe(4);
    expect(flat!.messages[0].content).toContain('sync AI sessions');
    expect(flat!.title).toBe('Relay VS Code test');
  });

  it('parses JSONL Copilot session', async () => {
    const sessions = await VSCodeReader.readFromChatSessionsDir(
      fixturesDir,
      '/tmp/relay-vscode-test'
    );
    const jsonl = sessions.find(s => s.id === 'vscode-eeee-ffff-0000-1111');
    expect(jsonl).toBeDefined();
    expect(jsonl!.messages.some(m => m.content.includes('Hello from jsonl'))).toBe(true);
  });

  it('lists session files from fixtures dir', () => {
    const files = VSCodeReader.listSessionFiles(fixturesDir);
    expect(files.length).toBeGreaterThanOrEqual(2);
  });

  it('maps file URI to path', () => {
    const p = VSCodeReader.fileUriToPath('file:///Users/dev/project');
    expect(p).toBe(path.resolve('/Users/dev/project'));
  });
});
