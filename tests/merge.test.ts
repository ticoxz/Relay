import { MergeEngine } from '../src/sync/merge';
import { OpenCodeSession } from '../src/plugin/storage-reader';

describe('MergeEngine', () => {
  const base: OpenCodeSession = {
    id: 'session-1',
    createdAt: 1000,
    project: '/proj',
    messages: [
      { role: 'user', content: 'hello', timestamp: 1000 },
      { role: 'assistant', content: 'hi', timestamp: 2000 },
    ],
  };

  it('merges messages chronologically without duplicates', () => {
    const other: OpenCodeSession = {
      ...base,
      messages: [
        { role: 'user', content: 'hello', timestamp: 1000 },
        { role: 'assistant', content: 'follow up', timestamp: 3000 },
      ],
    };

    const merged = MergeEngine.mergeSessions(base, other);
    expect(merged.messages).toHaveLength(3);
    expect(merged.messages[2].content).toBe('follow up');
  });

  it('throws when session ids differ', () => {
    const other = { ...base, id: 'session-2' };
    expect(() => MergeEngine.mergeSessions(base, other)).toThrow();
  });
});
