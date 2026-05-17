import fs from 'fs';
import path from 'path';
import os from 'os';
import { OpenCodeSession } from './storage-reader';

export class AntigravityReader {
  private static brainDir(): string {
    return path.join(os.homedir(), '.gemini', 'antigravity', 'brain');
  }

  static async listSessions(): Promise<Array<{ id: string; mtime: number }>> {
    const brainDir = this.brainDir();
    if (!fs.existsSync(brainDir)) return [];

    return fs
      .readdirSync(brainDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => {
        const fullPath = path.join(brainDir, dirent.name);
        const logPath = path.join(fullPath, '.system_generated', 'logs', 'overview.txt');
        let mtime = 0;
        if (fs.existsSync(logPath)) {
          mtime = fs.statSync(logPath).mtime.getTime();
        } else {
          mtime = fs.statSync(fullPath).mtime.getTime();
        }
        return { id: `antigravity-${dirent.name}`, mtime };
      })
      .sort((a, b) => b.mtime - a.mtime);
  }

  /**
   * Encuentra el ID de la conversación de Antigravity más recientemente modificada.
   */
  private static getLatestConversationId(): string | null {
    const brainDir = this.brainDir();
    if (!fs.existsSync(brainDir)) return null;

    const directories = fs
      .readdirSync(brainDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => {
        const fullPath = path.join(brainDir, dirent.name);
        const logPath = path.join(fullPath, '.system_generated', 'logs', 'overview.txt');
        let mtime = 0;
        if (fs.existsSync(logPath)) {
          mtime = fs.statSync(logPath).mtime.getTime();
        } else {
          mtime = fs.statSync(fullPath).mtime.getTime();
        }
        return { name: dirent.name, mtime };
      })
      .sort((a, b) => b.mtime - a.mtime);

    if (directories.length === 0) return null;
    return directories[0].name;
  }

  private static parseOverviewLog(logPath: string, conversationId: string): OpenCodeSession | null {
    if (!fs.existsSync(logPath)) return null;

    const content = fs.readFileSync(logPath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim() !== '');

    const messages: any[] = [];

    for (const line of lines) {
      try {
        const entry = JSON.parse(line);

        if (entry.source === 'USER_EXPLICIT' && entry.type === 'USER_INPUT' && entry.content) {
          let cleanContent = entry.content;
          const match = cleanContent.match(/<USER_REQUEST>([\s\S]*?)<\/USER_REQUEST>/);
          if (match && match[1]) {
            cleanContent = match[1].trim();
          }

          if (cleanContent) {
            messages.push({
              role: 'user',
              content: cleanContent,
              timestamp: new Date(entry.created_at || Date.now()).getTime(),
            });
          }
        }

        if (entry.source === 'MODEL' && entry.type === 'PLANNER_RESPONSE' && entry.content) {
          let cleanContent = entry.content.replace(/<thought>[\s\S]*?<\/thought>/g, '').trim();
          if (cleanContent) {
            messages.push({
              role: 'assistant',
              content: cleanContent,
              timestamp: new Date(entry.created_at || Date.now()).getTime(),
            });
          }
        }
      } catch {
        // ignore invalid lines
      }
    }

    if (messages.length === 0) return null;

    return {
      id: `antigravity-${conversationId}`,
      createdAt: messages[0].timestamp || Date.now(),
      project: process.cwd(),
      messages,
    };
  }

  static async readSessionById(sessionId: string): Promise<OpenCodeSession | null> {
    const normalizedId = sessionId.replace(/^antigravity-/, '');
    const logPath = path.join(
      os.homedir(),
      '.gemini',
      'antigravity',
      'brain',
      normalizedId,
      '.system_generated',
      'logs',
      'overview.txt'
    );
    return this.parseOverviewLog(logPath, normalizedId);
  }

  /**
   * Lee la conversación activa de Antigravity y la convierte al estándar OpenCodeSession.
   */
  static async readLatestSession(): Promise<OpenCodeSession | null> {
    const conversationId = this.getLatestConversationId();
    if (!conversationId) return null;

    const logPath = path.join(
      os.homedir(),
      '.gemini',
      'antigravity',
      'brain',
      conversationId,
      '.system_generated',
      'logs',
      'overview.txt'
    );

    return this.parseOverviewLog(logPath, conversationId);
  }
}
