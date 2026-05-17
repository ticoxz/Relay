import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { OpenCodeSession, OpenCodeMessage } from './storage-reader';

/** VS Code / Copilot Chat session on disk (flat JSON after JSONL replay). */
interface VSCodeChatSession {
  sessionId?: string;
  creationDate?: number;
  customTitle?: string;
  requests?: VSCodeChatRequest[];
}

interface VSCodeChatRequest {
  requestId?: string;
  message?: { text?: string; parts?: Array<{ text?: string }> };
  response?: Array<Record<string, unknown>>;
}

interface VSCodeUserDataRoot {
  label: string;
  userDir: string;
}

interface JsonlLine {
  kind?: number;
  inputState?: VSCodeChatSession;
  path?: Array<string | number>;
  value?: unknown;
}

export class VSCodeReader {
  static getUserDataRoots(): VSCodeUserDataRoot[] {
    const home = os.homedir();
    const platform = process.platform;

    const candidates: Array<{ label: string; relative: string }> = [
      { label: 'Code', relative: 'Code' },
      { label: 'Code Insiders', relative: 'Code - Insiders' },
      { label: 'VSCodium', relative: 'VSCodium' },
    ];

    const roots: VSCodeUserDataRoot[] = [];

    for (const c of candidates) {
      let userDir: string;
      if (platform === 'darwin') {
        userDir = path.join(home, 'Library', 'Application Support', c.relative, 'User');
      } else if (platform === 'win32') {
        const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
        userDir = path.join(appData, c.relative, 'User');
      } else {
        userDir = path.join(home, '.config', c.relative, 'User');
      }
      if (fs.existsSync(userDir)) {
        roots.push({ label: c.label, userDir });
      }
    }

    return roots;
  }

  static fileUriToPath(uri: string): string | null {
    try {
      if (uri.startsWith('file://')) {
        return fileURLToPath(uri);
      }
      return path.resolve(uri);
    } catch {
      return null;
    }
  }

  static pathsMatch(a: string, b: string): boolean {
    return path.resolve(a) === path.resolve(b);
  }

  /** Resolves workspaceStorage hash for an opened folder. */
  static findWorkspaceHash(userDir: string, projectPath: string): string | null {
    const storageRoot = path.join(userDir, 'workspaceStorage');
    if (!fs.existsSync(storageRoot)) return null;

    const target = path.resolve(projectPath);

    for (const hash of fs.readdirSync(storageRoot)) {
      const manifestPath = path.join(storageRoot, hash, 'workspace.json');
      if (!fs.existsSync(manifestPath)) continue;

      try {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as {
          folder?: string;
          configuration?: { folder?: string };
        };
        const folderUri = manifest.folder || manifest.configuration?.folder;
        if (!folderUri) continue;
        const folderPath = this.fileUriToPath(folderUri);
        if (folderPath && this.pathsMatch(folderPath, target)) {
          return hash;
        }
      } catch {
        // skip invalid manifest
      }
    }

    return null;
  }

  static getChatSessionsDir(userDir: string, projectPath?: string): string | null {
    if (projectPath) {
      const hash = this.findWorkspaceHash(userDir, projectPath);
      if (hash) {
        const dir = path.join(userDir, 'workspaceStorage', hash, 'chatSessions');
        if (fs.existsSync(dir)) return dir;
      }
    }

    const globalDir = path.join(userDir, 'globalStorage', 'emptyWindowChatSessions');
    if (fs.existsSync(globalDir)) return globalDir;

    return null;
  }

  /** All chatSessions dirs that might belong to this project (workspace + fallbacks). */
  static discoverChatSessionDirs(projectPath?: string): Array<{ dir: string; root: VSCodeUserDataRoot }> {
    const cwd = projectPath || process.cwd();
    const found: Array<{ dir: string; root: VSCodeUserDataRoot }> = [];
    const seen = new Set<string>();

    for (const root of this.getUserDataRoots()) {
      const dir = this.getChatSessionsDir(root.userDir, cwd);
      if (dir && !seen.has(dir)) {
        seen.add(dir);
        found.push({ dir, root });
      }
    }

    return found;
  }

  static listSessionFiles(chatSessionsDir: string): Array<{ sessionId: string; filePath: string; mtime: number }> {
    if (!fs.existsSync(chatSessionsDir)) return [];

    const byId = new Map<string, { sessionId: string; filePath: string; mtime: number }>();

    for (const name of fs.readdirSync(chatSessionsDir)) {
      if (!name.endsWith('.json') && !name.endsWith('.jsonl')) continue;
      const sessionId = name.replace(/\.(jsonl|json)$/, '');
      const filePath = path.join(chatSessionsDir, name);
      const mtime = fs.statSync(filePath).mtimeMs;
      const existing = byId.get(sessionId);
      const isJsonl = name.endsWith('.jsonl');

      if (!existing || isJsonl || (!existing.filePath.endsWith('.jsonl') && mtime > existing.mtime)) {
        if (existing && existing.filePath.endsWith('.jsonl') && !isJsonl) continue;
        byId.set(sessionId, { sessionId, filePath, mtime });
      }
    }

    return Array.from(byId.values()).sort((a, b) => b.mtime - a.mtime);
  }

  static extractTextFromResponseItem(item: Record<string, unknown>): string {
    const content = item.content as { value?: string } | undefined;
    if (content?.value) return content.value.trim();

    const text = item.text;
    if (typeof text === 'string') return text.trim();

    const message = item.message as { text?: string } | undefined;
    if (message?.text) return message.text.trim();

    const invocation = item.invocationMessage as { value?: string } | { toString?: () => string } | string | undefined;
    if (typeof invocation === 'string') return invocation.trim();
    if (invocation && typeof invocation === 'object' && 'value' in invocation && typeof invocation.value === 'string') {
      return invocation.value.trim();
    }

    return '';
  }

  static extractMessagesFromSession(data: VSCodeChatSession): OpenCodeMessage[] {
    const messages: OpenCodeMessage[] = [];
    let ts = data.creationDate || Date.now();

    for (const req of data.requests || []) {
      const userText =
        req.message?.text?.trim() ||
        (req.message?.parts || []).map(p => p.text || '').join('\n').trim();

      if (userText) {
        messages.push({ role: 'user', content: userText, timestamp: ts++ });
      }

      const responseParts: string[] = [];
      for (const item of req.response || []) {
        const text = this.extractTextFromResponseItem(item);
        if (text) responseParts.push(text);
      }

      if (responseParts.length > 0) {
        messages.push({
          role: 'assistant',
          content: responseParts.join('\n\n'),
          timestamp: ts++,
        });
      }
    }

    return messages;
  }

  static replayJsonl(content: string): VSCodeChatSession | null {
    const lines = content.split('\n').filter(l => l.trim());
    let state: VSCodeChatSession | null = null;

    for (const line of lines) {
      try {
        const op = JSON.parse(line) as JsonlLine;
        if (op.kind === 0 && op.inputState) {
          state = op.inputState;
          continue;
        }
        if (!state) continue;

        if (op.kind === 2 && op.path && op.value !== undefined) {
          this.applyJsonlPush(state, op.path, op.value);
        }
      } catch {
        // skip bad line
      }
    }

    return state;
  }

  private static applyJsonlPush(
    state: VSCodeChatSession,
    keyPath: Array<string | number>,
    value: unknown
  ): void {
    if (keyPath[0] === 'requests' && keyPath.length === 2 && typeof keyPath[1] === 'number') {
      if (!state.requests) state.requests = [];
      const idx = keyPath[1];
      while (state.requests.length <= idx) {
        state.requests.push({ message: { text: '' }, response: [] });
      }
      state.requests[idx] = value as VSCodeChatRequest;
    }
  }

  static parseSessionFile(filePath: string, fallbackSessionId: string): VSCodeChatSession | null {
    const content = fs.readFileSync(filePath, 'utf-8').replace(/^\uFEFF/, '');

    if (filePath.endsWith('.jsonl')) {
      return this.replayJsonl(content);
    }

    try {
      return JSON.parse(content) as VSCodeChatSession;
    } catch {
      return null;
    }
  }

  static parseToOpenCodeSession(
    data: VSCodeChatSession,
    sessionId: string,
    project: string
  ): OpenCodeSession | null {
    const messages = this.extractMessagesFromSession(data);
    if (messages.length === 0) return null;

    const id = sessionId.startsWith('vscode-') ? sessionId : `vscode-${sessionId}`;

    return {
      id,
      createdAt: data.creationDate || messages[0].timestamp,
      project,
      title: data.customTitle || messages.find(m => m.role === 'user')?.content.substring(0, 80),
      messages,
    };
  }

  static async readSessionFromFile(
    filePath: string,
    projectPath: string
  ): Promise<OpenCodeSession | null> {
    const sessionId = path.basename(filePath).replace(/\.(jsonl|json)$/, '');
    const data = this.parseSessionFile(filePath, sessionId);
    if (!data) return null;
    return this.parseToOpenCodeSession(data, sessionId, projectPath);
  }

  static async listSessions(projectPath?: string): Promise<Array<{ id: string; mtime: number }>> {
    const results: Array<{ id: string; mtime: number }> = [];

    for (const { dir } of this.discoverChatSessionDirs(projectPath)) {
      for (const f of this.listSessionFiles(dir)) {
        results.push({ id: `vscode-${f.sessionId}`, mtime: f.mtime });
      }
    }

    return results.sort((a, b) => b.mtime - a.mtime);
  }

  static async readLatestSession(projectPath?: string): Promise<OpenCodeSession | null> {
    const project = projectPath || process.cwd();
    const sessions = await this.listSessions(project);
    if (sessions.length === 0) return null;

    const latestId = sessions[0].id.replace(/^vscode-/, '');
    return this.readSessionById(latestId, project);
  }

  static async readSessionById(sessionId: string, projectPath?: string): Promise<OpenCodeSession | null> {
    const normalizedId = sessionId.replace(/^vscode-/, '');
    const project = projectPath || process.cwd();

    for (const { dir } of this.discoverChatSessionDirs(project)) {
      const jsonl = path.join(dir, `${normalizedId}.jsonl`);
      const json = path.join(dir, `${normalizedId}.json`);
      const filePath = fs.existsSync(jsonl) ? jsonl : fs.existsSync(json) ? json : null;
      if (filePath) {
        return this.readSessionFromFile(filePath, project);
      }
    }

    return null;
  }

  /** For tests: parse sessions from a custom chatSessions directory. */
  static async readFromChatSessionsDir(
    chatSessionsDir: string,
    projectPath: string
  ): Promise<OpenCodeSession[]> {
    const sessions: OpenCodeSession[] = [];
    for (const f of this.listSessionFiles(chatSessionsDir)) {
      const s = await this.readSessionFromFile(f.filePath, projectPath);
      if (s) sessions.push(s);
    }
    return sessions;
  }
}
