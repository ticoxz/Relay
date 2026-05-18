import path from 'path';
import { OpenCodeSession } from '../plugin/storage-reader';

/** Normalize paths for stable project matching (OpenCode stores absolute directory). */
export function normalizeProjectPath(projectPath: string): string {
  return path.resolve(projectPath).replace(/\/$/, '');
}

/** True if session belongs to the given repo root (exact match or subpath). */
export function sessionMatchesProject(
  session: OpenCodeSession,
  projectPath: string
): boolean {
  if (!session.project) return false;
  const root = normalizeProjectPath(projectPath);
  const sessionRoot = normalizeProjectPath(session.project);
  return sessionRoot === root || sessionRoot.startsWith(root + path.sep);
}

export function filterSessionsByProject(
  sessions: OpenCodeSession[],
  projectPath: string
): OpenCodeSession[] {
  return sessions.filter(s => sessionMatchesProject(s, projectPath));
}

export function sortSessionsNewestFirst(sessions: OpenCodeSession[]): OpenCodeSession[] {
  return [...sessions].sort((a, b) => b.createdAt - a.createdAt);
}

export function latestSessionForProject(
  sessions: OpenCodeSession[],
  projectPath: string = process.cwd()
): OpenCodeSession | null {
  const filtered = filterSessionsByProject(sessions, projectPath);
  return sortSessionsNewestFirst(filtered)[0] ?? null;
}

export function findSessionById(
  sessions: OpenCodeSession[],
  sessionId: string,
  projectPath: string = process.cwd()
): OpenCodeSession | null {
  const filtered = filterSessionsByProject(sessions, projectPath);
  return filtered.find(s => s.id === sessionId) ?? null;
}
