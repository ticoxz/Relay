import { pickPrimarySession } from '../src/sync/collect-sessions';
import { OpenCodeSession } from '../src/plugin/storage-reader';

describe('pickPrimarySession', () => {
  it('prefers cursor over opencode', () => {
    const sessions: OpenCodeSession[] = [
      { id: 'ses_abc', createdAt: 3000, project: '/p', messages: [] },
      { id: 'cursor-111', createdAt: 1000, project: '/p', messages: [] },
    ];
    expect(pickPrimarySession(sessions)?.id).toBe('cursor-111');
  });

  it('prefers antigravity when no cursor', () => {
    const sessions: OpenCodeSession[] = [
      { id: 'ses_abc', createdAt: 3000, project: '/p', messages: [] },
      { id: 'antigravity-222', createdAt: 2000, project: '/p', messages: [] },
    ];
    expect(pickPrimarySession(sessions)?.id).toBe('antigravity-222');
  });
});
