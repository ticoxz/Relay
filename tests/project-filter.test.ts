import path from 'path';
import {
  filterSessionsByProject,
  latestSessionForProject,
  resolveSessionRef,
  sessionMatchesProject,
} from '../src/sync/project-filter';
import { OpenCodeSession } from '../src/plugin/storage-reader';

const LB = '/Users/me/Desktop/LanguageBridge';
const TUPAC = '/Users/me/Desktop/tupac';

function sess(id: string, project: string, createdAt: number): OpenCodeSession {
  return { id, project, createdAt, messages: [{ role: 'user', content: 'hi', timestamp: createdAt }] };
}

describe('project-filter', () => {
  const all = [
    sess('a', LB, 1000),
    sess('b', TUPAC, 2000),
    sess('c', LB, 3000),
  ];

  it('sessionMatchesProject matches exact root', () => {
    expect(sessionMatchesProject(sess('x', LB, 0), LB)).toBe(true);
    expect(sessionMatchesProject(sess('x', TUPAC, 0), LB)).toBe(false);
  });

  it('filterSessionsByProject keeps only matching project', () => {
    const lb = filterSessionsByProject(all, LB);
    expect(lb.map(s => s.id).sort()).toEqual(['a', 'c']);
  });

  it('latestSessionForProject returns newest in project', () => {
    const latest = latestSessionForProject(all, LB);
    expect(latest?.id).toBe('c');
  });

  it('resolveSessionRef picks by 1-based index', () => {
    const sorted = [sess('c', LB, 3000), sess('a', LB, 1000)];
    const r = resolveSessionRef(sorted, '2');
    expect(r.session?.id).toBe('a');
  });

  it('resolveSessionRef rejects out of range index', () => {
    const r = resolveSessionRef([sess('a', LB, 1)], '5');
    expect(r.session).toBeNull();
    expect(r.error).toMatch(/1–1/);
  });
});
