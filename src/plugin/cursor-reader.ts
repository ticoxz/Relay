import fs from 'fs';
import path from 'path';
import os from 'os';
import { OpenCodeSession, OpenCodeMessage } from './storage-reader';

interface CursorJsonlEntry {
  role?: string;
  message?: {
    content?: Array<{ type?: string; text?: string }>;
  };
}

export class CursorReader {
  private static getProjectsRoot(): string {
    return path.join(os.homedir(), '.cursor', 'projects');
  }

  /** Maps a filesystem path to Cursor's encoded project folder name. */
  static encodeProjectPath(projectPath: string): string {
    const resolved = path.resolve(projectPath);
    return resolved.replace(/^\//, '').replace(/\//g, '-');
  }

  private static getTranscriptsDirForProject(projectPath?: string): string | null {
    const cwd = projectPath || process.cwd();
    const encoded = this.encodeProjectPath(cwd);
    const transcriptsDir = path.join(this.getProjectsRoot(), encoded, 'agent-transcripts');

    if (fs.existsSync(transcriptsDir)) {
      return transcriptsDir;
    }

    // Fallback: search any project folder containing transcripts
    const projectsRoot = this.getProjectsRoot();
    if (!fs.existsSync(projectsRoot)) return null;

    const candidates = fs.readdirSync(projectsRoot)
      .map(name => path.join(projectsRoot, name, 'agent-transcripts'))
      .filter(dir => fs.existsSync(dir));

    if (candidates.length === 0) return null;

    // Prefer folder matching cwd suffix
    const match = candidates.find(dir => dir.includes(encoded.split('-').slice(-2).join('-')));
    return match || candidates[0];
  }

  private static listTranscriptFiles(transcriptsDir: string): Array<{ id: string; filePath: string; mtime: number }> {
    const results: Array<{ id: string; filePath: string; mtime: number }> = [];

    if (!fs.existsSync(transcriptsDir)) return results;

    const sessionDirs = fs.readdirSync(transcriptsDir, { withFileTypes: true })
      .filter(d => d.isDirectory());

    for (const dir of sessionDirs) {
      const sessionId = dir.name;
      const jsonlPath = path.join(transcriptsDir, sessionId, `${sessionId}.jsonl`);
      if (fs.existsSync(jsonlPath)) {
        results.push({
          id: sessionId,
          filePath: jsonlPath,
          mtime: fs.statSync(jsonlPath).mtimeMs,
        });
      }
    }

    return results.sort((a, b) => b.mtime - a.mtime);
  }

  static parseJsonlFile(filePath: string, sessionId: string, project: string): OpenCodeSession | null {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim());
    const messages: OpenCodeMessage[] = [];
    let lineIndex = 0;

    for (const line of lines) {
      try {
        const entry = JSON.parse(line) as CursorJsonlEntry;
        const role = entry.role === 'assistant' ? 'assistant' : entry.role === 'user' ? 'user' : null;
        if (!role) continue;

        const textParts = (entry.message?.content || [])
          .filter(p => p.type === 'text' && p.text)
          .map(p => p.text as string);

        const text = textParts.join('\n').trim();
        if (!text) continue;

        messages.push({
          role,
          content: text,
          timestamp: Date.now() + lineIndex,
        });
        lineIndex++;
      } catch {
        // skip invalid lines
      }
    }

    if (messages.length === 0) return null;

    return {
      id: `cursor-${sessionId}`,
      createdAt: messages[0].timestamp,
      project,
      title: messages.find(m => m.role === 'user')?.content.substring(0, 80),
      messages,
    };
  }

  static async readLatestSession(projectPath?: string): Promise<OpenCodeSession | null> {
    const transcriptsDir = this.getTranscriptsDirForProject(projectPath);
    if (!transcriptsDir) return null;

    const files = this.listTranscriptFiles(transcriptsDir);
    if (files.length === 0) return null;

    const project = projectPath || process.cwd();
    return this.parseJsonlFile(files[0].filePath, files[0].id, project);
  }

  static async readSessionById(sessionId: string, projectPath?: string): Promise<OpenCodeSession | null> {
    const normalizedId = sessionId.replace(/^cursor-/, '');
    const transcriptsDir = this.getTranscriptsDirForProject(projectPath);
    if (!transcriptsDir) return null;

    const jsonlPath = path.join(transcriptsDir, normalizedId, `${normalizedId}.jsonl`);
    if (!fs.existsSync(jsonlPath)) return null;

    return this.parseJsonlFile(jsonlPath, normalizedId, projectPath || process.cwd());
  }

  static async listSessions(projectPath?: string): Promise<Array<{ id: string; mtime: number }>> {
    const transcriptsDir = this.getTranscriptsDirForProject(projectPath);
    if (!transcriptsDir) return [];
    return this.listTranscriptFiles(transcriptsDir).map(f => ({ id: `cursor-${f.id}`, mtime: f.mtime }));
  }
}
