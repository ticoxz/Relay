import { readOpenCodeSessions, OpenCodeSession } from '../plugin/storage-reader';
import { AntigravityReader } from '../plugin/antigravity-reader';
import { CursorReader } from '../plugin/cursor-reader';
import { VSCodeReader } from '../plugin/vscode-reader';
import { EditorKey } from '../core/logger';
import { latestSessionForProject, resolveSessionRef } from './project-filter';
import { listSessionsForEditor } from './list-editor-sessions';

/** Same order as `relay status --editor <name> --sessions`. */
export async function resolveEditorSession(
  editor: EditorKey,
  sessionRef?: string,
  projectPath: string = process.cwd()
): Promise<{ session: OpenCodeSession | null; error?: string }> {
  if (sessionRef) {
    const listed = await listSessionsForEditor(editor, projectPath);
    return resolveSessionRef(listed, sessionRef);
  }

  if (editor === 'opencode') {
    const sessions = await readOpenCodeSessions();
    return { session: latestSessionForProject(sessions, projectPath) };
  }
  if (editor === 'antigravity') {
    return { session: (await AntigravityReader.readLatestSession()) ?? null };
  }
  if (editor === 'cursor') {
    return { session: (await CursorReader.readLatestSession(projectPath)) ?? null };
  }
  if (editor === 'vscode') {
    return { session: (await VSCodeReader.readLatestSession(projectPath)) ?? null };
  }

  return { session: null };
}
