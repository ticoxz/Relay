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

/**
 * Resolve --session 3 (1-based index from `relay status --sessions`) or full id.
 * Same order as status: newest first, this project only.
 */
export function resolveSessionRef(
  sessions: OpenCodeSession[],
  sessionRef: string
): { session: OpenCodeSession | null; error?: string } {
  const trimmed = sessionRef.trim();

  if (/^\d+$/.test(trimmed)) {
    const n = parseInt(trimmed, 10);
    if (n < 1 || n > sessions.length) {
      return {
        session: null,
        error: `Índice ${n} inválido. Usa 1–${sessions.length} (relay status --editor … --sessions).`,
      };
    }
    return { session: sessions[n - 1] };
  }

  const exact = sessions.find(s => s.id === trimmed);
  if (exact) return { session: exact };

  const partial = sessions.filter(
    s => s.id.includes(trimmed) || trimmed.includes(s.id)
  );
  if (partial.length === 1) return { session: partial[0] };
  if (partial.length > 1) {
    return {
      session: null,
      error: `Varias sesiones coinciden con "${trimmed}". Usa el número (1–${sessions.length}) o el id completo.`,
    };
  }

  return {
    session: null,
    error: `Sesión "${trimmed}" no encontrada en este proyecto.`,
  };
}
