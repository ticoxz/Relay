import { Command } from 'commander';
import { readOpenCodeSessions } from '../../plugin/storage-reader';
import { AntigravityReader } from '../../plugin/antigravity-reader';
import { CursorReader } from '../../plugin/cursor-reader';
import { writeSessionsToRepo } from '../../sync/writer';
import { generateHandoff } from '../../sync/handoff';

export const syncCommand = new Command('sync')
  .description('Lee sesiones de los editores y las guarda en .ai-memory/sessions/')
  .option('-q, --quiet', 'Silencia la salida de la consola (ideal para hooks)')
  .option('--handoff', 'Regenera .ai-memory/HANDOFF.md después de sincronizar')
  .action(async (options) => {
    const isQuiet = options.quiet;

    if (!isQuiet) console.log('🔄 Sincronizando contexto de la IA...');

    try {
      const sessions = await readOpenCodeSessions();

      const agSession = await AntigravityReader.readLatestSession();
      if (agSession) {
        sessions.push(agSession);
        if (!isQuiet) console.log('🧠 Sesión de Antigravity detectada.');
      }

      const cursorSession = await CursorReader.readLatestSession();
      if (cursorSession) {
        sessions.push(cursorSession);
        if (!isQuiet) console.log('🖱️  Sesión de Cursor detectada.');
      }

      if (sessions.length === 0) {
        if (!isQuiet) console.log('No se encontraron sesiones nuevas o activas para sincronizar.');
        return;
      }

      if (!isQuiet) console.log(`Encontradas ${sessions.length} sesión(es). Guardando...`);

      const result = await writeSessionsToRepo(sessions, isQuiet);

      if (!isQuiet) {
        console.log(`✅ Sincronización completada (${result.written} nuevas/actualizadas, ${result.skipped} sin cambios).`);
      }

      if (options.handoff) {
        const handoffPath = await generateHandoff(undefined, { fromRepo: true });
        if (!isQuiet) console.log(`📄 Handoff: ${handoffPath}`);
      }
    } catch (error: any) {
      console.error('❌ Error durante la sincronización:', error.message);
      process.exit(1);
    }
  });
