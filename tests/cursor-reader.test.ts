import path from 'path';
import { CursorReader } from '../src/plugin/cursor-reader';

describe('CursorReader', () => {
  it('parses jsonl fixture into OpenCodeSession', () => {
    const fixture = path.join(__dirname, 'fixtures', 'cursor-transcript.jsonl');
    const session = CursorReader.parseJsonlFile(fixture, 'test-session-id', '/test/project');

    expect(session).not.toBeNull();
    expect(session!.id).toBe('cursor-test-session-id');
    expect(session!.messages).toHaveLength(2);
    expect(session!.messages[0].role).toBe('user');
    expect(session!.messages[1].content).toContain('validator.ts');
  });

  it('encodes project paths like Cursor does', () => {
    expect(CursorReader.encodeProjectPath('/Users/dev/my-app')).toBe(
      'Users-dev-my-app'
    );
  });
});
