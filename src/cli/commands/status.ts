import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { ConfigManager } from '../../core/config';
import { Logger } from '../../core/logger';
import { AgeEncryption } from '../../encryption/age';
import { readOpenCodeSessions } from '../../plugin/storage-reader';
import { AntigravityReader } from '../../plugin/antigravity-reader';
import { CursorReader } from '../../plugin/cursor-reader';

export const statusCommand = new Command('status')
  .description('Muestra el estado actual de las sesiones sincronizadas')
  .option('--json', 'Muestra el resultado en formato JSON')
  .option('--editor <name>', 'Editor: opencode | antigravity | cursor')
  .option('--sessions', 'Lista las sesiones de cada editor')
  .action(async (options) => {
    try {
      const config = ConfigManager.load();
      const memoryDir = path.join(process.cwd(), '.ai-memory');
      const sessionsDir = path.join(memoryDir, 'sessions');

      if (options.editor) {
        await showEditorStatus(options.editor, options.sessions);
        return;
      }

      if (options.json) {
        console.log(JSON.stringify({
          project: path.basename(process.cwd()),
          config,
          sessions: {
            total: fs.existsSync(sessionsDir) ? fs.readdirSync(sessionsDir).filter(f => f.endsWith('.age') || f.endsWith('.json')).length : 0,
          }
        }, null, 2));
        return;
      }

      Logger.header('📊 Estado de ContextVC');

      console.log(`\n${'Configuración:'}`);
      console.log(`  Proyecto: ${path.basename(process.cwd())}`);
      console.log(`  Encriptación: ${config?.encryption?.enabled ? '✅ Activada' : '❌ Desactivada'}`);
      console.log(`  Resumidor: ${config?.summarizer?.provider || 'local'}`);

      if (fs.existsSync(sessionsDir)) {
        const files = fs.readdirSync(sessionsDir).filter(f => f.endsWith('.age') || f.endsWith('.json'));
        const totalSize = files.reduce((acc, f) => acc + fs.statSync(path.join(sessionsDir, f)).size, 0);
        const encryptedCount = files.filter(f => f.endsWith('.age')).length;

        console.log(`\n${'Sesiones guardadas:'}`);
        console.log(`  Total: ${files.length}`);
        console.log(`  Encriptadas: ${encryptedCount}`);
        console.log(`  Tamaño total: ${Math.round(totalSize / 1024)} KB`);
      }

      const handoffPath = path.join(memoryDir, 'HANDOFF.md');
      if (fs.existsSync(handoffPath)) {
        const stat = fs.statSync(handoffPath);
        console.log(`\n${'Handoff:'}`);
        console.log(`  HANDOFF.md: ${Math.round(stat.size / 1024)} KB (${stat.mtime.toLocaleString()})`);
      }

      console.log(`\n${'Editores:'} opencode | antigravity | cursor`);
      console.log(`  contextvc status --editor <nombre> --sessions`);

      const recipients = AgeEncryption.getRecipients();
      if (recipients.length > 0) {
        console.log(`\n${'Equipo:'}`);
        console.log(`  Destinatarios: ${recipients.length}`);
      }

      Logger.divider();
    } catch (error: any) {
      Logger.error('Error al obtener estado: ' + error.message);
      process.exit(1);
    }
  });

async function showEditorStatus(editor: string, showSessions: boolean) {
  const homedir = os.homedir();

  if (editor === 'opencode') {
    Logger.header('📊 OpenCode Sessions');
    const sessions = await readOpenCodeSessions();
    console.log(`\n  Sesiones encontradas: ${sessions.length}`);
    console.log(`  Ubicación: ~/.local/share/opencode/opencode.db`);

    if (showSessions && sessions.length > 0) {
      console.log(`\n${'Sesiones recientes:'}`);
      sessions.slice(-5).forEach((s: any, i: number) => {
        const date = new Date(s.createdAt).toLocaleString();
        const msgs = s.messages?.length || 0;
        console.log(`  ${i + 1}. [${date}] ${s.title?.substring(0, 50) || s.messages?.[0]?.content?.substring(0, 40) || 'Sin título'}... (${msgs} msgs)`);
      });

      console.log(`\n  Para inyectar a Antigravity:`);
      console.log(`  contextvc inject opencode antigravity`);
    }
  } else if (editor === 'antigravity') {
    Logger.header('📊 Antigravity Sessions');
    const brainDir = path.join(homedir, '.gemini', 'antigravity', 'brain');
    const conversationsDir = path.join(homedir, '.gemini', 'antigravity', 'conversations');

    const brainSessions = fs.existsSync(brainDir) ? fs.readdirSync(brainDir).filter(f => fs.statSync(path.join(brainDir, f)).isDirectory()) : [];
    const pbFiles = fs.existsSync(conversationsDir) ? fs.readdirSync(conversationsDir).filter(f => f.endsWith('.pb')) : [];

    console.log(`\n  Directórios brain/: ${brainSessions.length}`);
    console.log(`  Archivos .pb: ${pbFiles.length}`);
    console.log(`  Ubicación: ~/.gemini/antigravity/`);

    if (showSessions && brainSessions.length > 0) {
      console.log(`\n${'Sesiones recientes:'}`);
      const sorted = brainSessions.sort((a, b) => {
        const statA = fs.statSync(path.join(brainDir, a));
        const statB = fs.statSync(path.join(brainDir, b));
        return statB.mtimeMs - statA.mtimeMs;
      }).slice(-5);

      sorted.forEach((id: string, i: number) => {
        const sessionPath = path.join(brainDir, id, 'session.md');
        const exists = fs.existsSync(sessionPath);
        const stat = exists ? fs.statSync(sessionPath) : null;
        const size = stat ? Math.round(stat.size / 1024) : 0;
        console.log(`  ${i + 1}. ${id.substring(0, 8)}... (${size} KB)`);
      });

      console.log(`\n  Inyectar: contextvc inject opencode antigravity`);
      console.log(`  Usar en Antigravity: @~/.gemini/antigravity/brain/<ID>/session.md`);
    }
  } else if (editor === 'cursor') {
    Logger.header('📊 Cursor Sessions');
    const sessions = await CursorReader.listSessions();
    console.log(`\n  Transcripts (agent): ${sessions.length}`);
    console.log(`  Ubicación: ~/.cursor/projects/<proyecto>/agent-transcripts/`);

    if (showSessions && sessions.length > 0) {
      console.log(`\n${'Sesiones recientes:'}`);
      sessions.slice(0, 5).forEach((s, i) => {
        const date = new Date(s.mtime).toLocaleString();
        console.log(`  ${i + 1}. ${s.id} (${date})`);
      });
      console.log(`\n  Sincronizar: contextvc pull cursor`);
      console.log(`  Inyectar a otro editor: contextvc inject cursor antigravity`);
    }
  } else {
    Logger.error(`Editor desconocido: ${editor}. Usa: opencode | antigravity | cursor`);
    process.exit(1);
  }
}
