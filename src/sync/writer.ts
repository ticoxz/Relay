import fs from 'fs';
import path from 'path';
import { OpenCodeSession } from '../plugin/storage-reader';
import { AgeEncryption } from '../encryption/age';
import { ModularSummarizer } from '../summarizer/modular-summarizer';
import { ConfigManager } from '../core/config';
import { Logger } from '../core/logger';
import { BackupManager } from '../core/backup';

export interface WriteSessionsResult {
  written: number;
  skipped: number;
}

function findExistingSessionFile(memoryDir: string, sessionId: string): string | null {
  const files = fs.readdirSync(memoryDir);
  const match = files.find(f => f.startsWith(`session-${sessionId}.`));
  return match ? path.join(memoryDir, match) : null;
}

function readExistingContent(filePath: string, useEncryption: boolean): string | null {
  try {
    if (useEncryption && filePath.endsWith('.age')) {
      return AgeEncryption.decrypt(filePath);
    }
    if (!useEncryption && filePath.endsWith('.json')) {
      return fs.readFileSync(filePath, 'utf-8');
    }
    if (filePath.endsWith('.age')) {
      return AgeEncryption.decrypt(filePath);
    }
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

export async function writeSessionsToRepo(
  sessions: OpenCodeSession[],
  isQuiet: boolean = false
): Promise<WriteSessionsResult> {
  const cwd = process.cwd();
  const memoryDir = path.join(cwd, '.ai-memory', 'sessions');

  if (!fs.existsSync(memoryDir)) {
    throw new Error('El directorio .ai-memory/sessions no existe. Asegúrate de correr "contextvc init" primero.');
  }

  const config = ConfigManager.load();
  const recipients = AgeEncryption.getRecipients();
  const useEncryption = (config?.encryption?.enabled ?? true) && recipients.length > 0;

  const summarizerConfig = config?.summarizer || { provider: 'local' };
  const summarizer = new ModularSummarizer(summarizerConfig);

  let written = 0;
  let skipped = 0;

  for (const session of sessions) {
    const processedSession = await summarizer.process(session);

    const baseExt = ('isSummary' in processedSession) ? '.summary.json' : '.json';
    const finalExt = useEncryption ? `${baseExt}.age` : baseExt;
    const fileName = `session-${processedSession.id}${finalExt}`;
    const filePath = path.join(memoryDir, fileName);

    const content = JSON.stringify(processedSession, null, 2);

    const existingPath = findExistingSessionFile(memoryDir, processedSession.id);
    if (existingPath) {
      const existingContent = readExistingContent(existingPath, useEncryption);
      if (existingContent === content) {
        skipped++;
        if (!isQuiet) {
          Logger.info(`  -> Sin cambios (omitida): ${path.basename(existingPath)}`);
        }
        continue;
      }
    }

    const tempPath = `${filePath}.tmp`;
    try {
      if (useEncryption) {
        AgeEncryption.encrypt(content, tempPath);
      } else {
        fs.writeFileSync(tempPath, content, 'utf-8');
      }

      if (fs.existsSync(filePath)) {
        BackupManager.createBackup(filePath);
        fs.unlinkSync(filePath);
      }
      // Remove alternate extension if session type changed (full vs summary)
      if (existingPath && existingPath !== filePath && fs.existsSync(existingPath)) {
        BackupManager.createBackup(existingPath);
        fs.unlinkSync(existingPath);
      }

      fs.renameSync(tempPath, filePath);
      written++;
    } catch (error) {
      if (fs.existsSync(tempPath)) {
        try { fs.unlinkSync(tempPath); } catch { /* ignore */ }
      }
      throw error;
    }

    if (!isQuiet) {
      const action = useEncryption ? 'ENCRIPTADA' : 'PLANO';
      Logger.info(`  -> Guardada (${action}): ${fileName}`);
    }
  }

  return { written, skipped };
}
