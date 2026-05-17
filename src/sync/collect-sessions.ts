import { readOpenCodeSessions, OpenCodeSession } from '../plugin/storage-reader';
import { AntigravityReader } from '../plugin/antigravity-reader';
import { CursorReader } from '../plugin/cursor-reader';
import { VSCodeReader } from '../plugin/vscode-reader';

export interface CollectSessionsOptions {
  /** Si true, importa todo el historial de cada editor. Por defecto: solo la más reciente por editor. */
  all?: boolean;
  projectPath?: string;
}

export interface CollectSessionsResult {
  sessions: OpenCodeSession[];
  stats: { opencode: number; antigravity: number; cursor: number; vscode: number };
}

export async function collectSessionsForSync(
  options: CollectSessionsOptions = {}
): Promise<CollectSessionsResult> {
  const projectPath = options.projectPath || process.cwd();
  const stats = { opencode: 0, antigravity: 0, cursor: 0, vscode: 0 };
  const sessions: OpenCodeSession[] = [];

  if (options.all) {
    const opencode = await readOpenCodeSessions();
    sessions.push(...opencode);
    stats.opencode = opencode.length;

    const agSessions: OpenCodeSession[] = [];
    for (const { id } of await AntigravityReader.listSessions()) {
      const s = await AntigravityReader.readSessionById(id);
      if (s) agSessions.push(s);
    }
    sessions.push(...agSessions);
    stats.antigravity = agSessions.length;

    const cursorSessions: OpenCodeSession[] = [];
    for (const { id } of await CursorReader.listSessions(projectPath)) {
      const s = await CursorReader.readSessionById(id, projectPath);
      if (s) cursorSessions.push(s);
    }
    sessions.push(...cursorSessions);
    stats.cursor = cursorSessions.length;

    const vscodeSessions: OpenCodeSession[] = [];
    for (const { id } of await VSCodeReader.listSessions(projectPath)) {
      const s = await VSCodeReader.readSessionById(id, projectPath);
      if (s) vscodeSessions.push(s);
    }
    sessions.push(...vscodeSessions);
    stats.vscode = vscodeSessions.length;
  } else {
    const opencode = await readOpenCodeSessions();
    if (opencode.length > 0) {
      sessions.push(opencode[opencode.length - 1]);
      stats.opencode = 1;
    }

    const ag = await AntigravityReader.readLatestSession();
    if (ag) {
      sessions.push(ag);
      stats.antigravity = 1;
    }

    const cursor = await CursorReader.readLatestSession(projectPath);
    if (cursor) {
      sessions.push(cursor);
      stats.cursor = 1;
    }

    const vscode = await VSCodeReader.readLatestSession(projectPath);
    if (vscode) {
      sessions.push(vscode);
      stats.vscode = 1;
    }
  }

  return { sessions, stats };
}

/** Sesión preferida para HANDOFF.md: Cursor del proyecto > Antigravity > OpenCode. */
export function pickPrimarySession(sessions: OpenCodeSession[]): OpenCodeSession | null {
  if (sessions.length === 0) return null;

  const cursor = sessions.filter(s => s.id.startsWith('cursor-'));
  if (cursor.length > 0) {
    return cursor.sort((a, b) => b.createdAt - a.createdAt)[0];
  }

  const vscode = sessions.filter(s => s.id.startsWith('vscode-'));
  if (vscode.length > 0) {
    return vscode.sort((a, b) => b.createdAt - a.createdAt)[0];
  }

  const ag = sessions.filter(s => s.id.startsWith('antigravity-'));
  if (ag.length > 0) {
    return ag.sort((a, b) => b.createdAt - a.createdAt)[0];
  }

  return sessions.sort((a, b) => b.createdAt - a.createdAt)[0];
}
