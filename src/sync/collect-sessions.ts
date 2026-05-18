import { readOpenCodeSessions, OpenCodeSession } from '../plugin/storage-reader';
import { AntigravityReader } from '../plugin/antigravity-reader';
import { CursorReader } from '../plugin/cursor-reader';
import { VSCodeReader } from '../plugin/vscode-reader';
import { EditorKey, Logger } from '../core/logger';

export interface CollectSessionsOptions {
  /** Si true, importa todo el historial de cada editor. Por defecto: solo la más reciente por editor. */
  all?: boolean;
  projectPath?: string;
  onEditor?: (editor: EditorKey, status: 'active' | 'ok' | 'skip', detail?: string) => void;
}

export interface CollectSessionsResult {
  sessions: OpenCodeSession[];
  stats: { opencode: number; antigravity: number; cursor: number; vscode: number };
}

async function collectOpenCode(all: boolean, onEditor?: CollectSessionsOptions['onEditor']): Promise<{ sessions: OpenCodeSession[]; count: number }> {
  onEditor?.('opencode', 'active');
  const opencode = await readOpenCodeSessions();
  if (all) {
    onEditor?.('opencode', opencode.length ? 'ok' : 'skip', opencode.length ? `${opencode.length} sesión(es)` : 'sin sesiones');
    return { sessions: opencode, count: opencode.length };
  }
  if (opencode.length > 0) {
    onEditor?.('opencode', 'ok', 'última sesión');
    return { sessions: [opencode[opencode.length - 1]], count: 1 };
  }
  onEditor?.('opencode', 'skip', 'sin sesiones');
  return { sessions: [], count: 0 };
}

async function collectAntigravity(all: boolean, onEditor?: CollectSessionsOptions['onEditor']): Promise<{ sessions: OpenCodeSession[]; count: number }> {
  onEditor?.('antigravity', 'active');
  if (all) {
    const agSessions: OpenCodeSession[] = [];
    for (const { id } of await AntigravityReader.listSessions()) {
      const s = await AntigravityReader.readSessionById(id);
      if (s) agSessions.push(s);
    }
    onEditor?.('antigravity', agSessions.length ? 'ok' : 'skip', agSessions.length ? `${agSessions.length} sesión(es)` : 'sin sesiones');
    return { sessions: agSessions, count: agSessions.length };
  }
  const ag = await AntigravityReader.readLatestSession();
  if (ag) {
    onEditor?.('antigravity', 'ok', 'última sesión');
    return { sessions: [ag], count: 1 };
  }
  onEditor?.('antigravity', 'skip', 'sin sesiones');
  return { sessions: [], count: 0 };
}

async function collectCursor(
  all: boolean,
  projectPath: string,
  onEditor?: CollectSessionsOptions['onEditor']
): Promise<{ sessions: OpenCodeSession[]; count: number }> {
  onEditor?.('cursor', 'active');
  if (all) {
    const cursorSessions: OpenCodeSession[] = [];
    for (const { id } of await CursorReader.listSessions(projectPath)) {
      const s = await CursorReader.readSessionById(id, projectPath);
      if (s) cursorSessions.push(s);
    }
    onEditor?.('cursor', cursorSessions.length ? 'ok' : 'skip', cursorSessions.length ? `${cursorSessions.length} sesión(es)` : 'sin sesiones');
    return { sessions: cursorSessions, count: cursorSessions.length };
  }
  const cursor = await CursorReader.readLatestSession(projectPath);
  if (cursor) {
    onEditor?.('cursor', 'ok', 'última sesión');
    return { sessions: [cursor], count: 1 };
  }
  onEditor?.('cursor', 'skip', 'sin sesiones');
  return { sessions: [], count: 0 };
}

async function collectVSCode(
  all: boolean,
  projectPath: string,
  onEditor?: CollectSessionsOptions['onEditor']
): Promise<{ sessions: OpenCodeSession[]; count: number }> {
  onEditor?.('vscode', 'active');
  if (all) {
    const vscodeSessions: OpenCodeSession[] = [];
    for (const { id } of await VSCodeReader.listSessions(projectPath)) {
      const s = await VSCodeReader.readSessionById(id, projectPath);
      if (s) vscodeSessions.push(s);
    }
    onEditor?.('vscode', vscodeSessions.length ? 'ok' : 'skip', vscodeSessions.length ? `${vscodeSessions.length} sesión(es)` : 'sin sesiones');
    return { sessions: vscodeSessions, count: vscodeSessions.length };
  }
  const vscode = await VSCodeReader.readLatestSession(projectPath);
  if (vscode) {
    onEditor?.('vscode', 'ok', 'última sesión');
    return { sessions: [vscode], count: 1 };
  }
  onEditor?.('vscode', 'skip', 'sin sesiones');
  return { sessions: [], count: 0 };
}

export async function collectSessionsForSync(
  options: CollectSessionsOptions = {}
): Promise<CollectSessionsResult> {
  const projectPath = options.projectPath || process.cwd();
  const stats = { opencode: 0, antigravity: 0, cursor: 0, vscode: 0 };
  const sessions: OpenCodeSession[] = [];
  const all = !!options.all;

  const oc = await collectOpenCode(all, options.onEditor);
  sessions.push(...oc.sessions);
  stats.opencode = oc.count;

  const ag = await collectAntigravity(all, options.onEditor);
  sessions.push(...ag.sessions);
  stats.antigravity = ag.count;

  const cu = await collectCursor(all, projectPath, options.onEditor);
  sessions.push(...cu.sessions);
  stats.cursor = cu.count;

  const vs = await collectVSCode(all, projectPath, options.onEditor);
  sessions.push(...vs.sessions);
  stats.vscode = vs.count;

  return { sessions, stats };
}

/** Sesión preferida para HANDOFF.md: Cursor del proyecto > VS Code > Antigravity > OpenCode. */
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

/** Show all editors as pending before scan */
export function showEditorsPending(): void {
  if (!Logger.shouldLog()) return;
  (['opencode', 'antigravity', 'cursor', 'vscode'] as EditorKey[]).forEach(e => {
    Logger.editorLine(e, 'pending');
  });
}
