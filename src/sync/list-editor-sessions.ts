import { readOpenCodeSessions, OpenCodeSession } from '../plugin/storage-reader';
import { CursorReader } from '../plugin/cursor-reader';
import { VSCodeReader } from '../plugin/vscode-reader';
import { AntigravityReader } from '../plugin/antigravity-reader';
import { EditorKey } from '../core/logger';
import {
  filterSessionsByProject,
  sortSessionsNewestFirst,
} from './project-filter';

/** Sessions for current project, newest first — same order as `relay status --sessions`. */
export async function listSessionsForEditor(
  editor: EditorKey,
  projectPath: string = process.cwd()
): Promise<OpenCodeSession[]> {
  if (editor === 'opencode') {
    const all = await readOpenCodeSessions();
    return sortSessionsNewestFirst(filterSessionsByProject(all, projectPath));
  }

  if (editor === 'cursor') {
    const listed = await CursorReader.listSessions(projectPath);
    const sessions: OpenCodeSession[] = [];
    for (const { id } of listed) {
      const rawId = id.replace(/^cursor-/, '');
      const s = await CursorReader.readSessionById(rawId, projectPath);
      if (s) sessions.push(s);
    }
    return sortSessionsNewestFirst(sessions);
  }

  if (editor === 'vscode') {
    const listed = await VSCodeReader.listSessions(projectPath);
    const sessions: OpenCodeSession[] = [];
    for (const { id } of listed) {
      const rawId = id.replace(/^vscode-/, '');
      const s = await VSCodeReader.readSessionById(rawId, projectPath);
      if (s) sessions.push(s);
    }
    return sortSessionsNewestFirst(sessions);
  }

  if (editor === 'antigravity') {
    const sessions: OpenCodeSession[] = [];
    for (const { id } of await AntigravityReader.listSessions()) {
      const s = await AntigravityReader.readSessionById(id);
      if (s) sessions.push(s);
    }
    return sortSessionsNewestFirst(sessions);
  }

  return [];
}
