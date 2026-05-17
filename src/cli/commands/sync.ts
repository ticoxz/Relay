import { Command } from 'commander';
import { writeSessionsToRepo } from '../../sync/writer';
import { generateHandoff } from '../../sync/handoff';
import { collectSessionsForSync, pickPrimarySession } from '../../sync/collect-sessions';

export const syncCommand = new Command('sync')
  .description('Guarda sesiones de editores en .ai-memory/sessions/ (por defecto: la más reciente de cada uno)')
  .option('-q, --quiet', 'Silencia la salida (ideal para hooks)')
  .option('--handoff', 'Regenera .ai-memory/HANDOFF.md desde la sesión principal')
  .option('--all', 'Sincronizar todo el historial de OpenCode/Cursor/Antigravity (puede ser lento)')
  .action(async (options) => {
    const isQuiet = options.quiet;

    if (!isQuiet) {
      console.log('🔄 Sincronizando contexto de la IA...');
      if (!options.all) {
        console.log('   Modo: última sesión por editor (usa --all para importar todo el historial).');
      }
    }

    try {
      const { sessions, stats } = await collectSessionsForSync({ all: options.all });

      if (sessions.length === 0) {
        if (!isQuiet) console.log('No se encontraron sesiones para sincronizar.');
        return;
      }

      if (!isQuiet) {
        const parts: string[] = [];
        if (stats.opencode) parts.push(`OpenCode: ${stats.opencode}`);
        if (stats.antigravity) parts.push(`Antigravity: ${stats.antigravity}`);
        if (stats.cursor) parts.push(`Cursor: ${stats.cursor}`);
        console.log(`Encontradas ${sessions.length} sesión(es) (${parts.join(', ')}). Guardando...`);
      }

      const result = await writeSessionsToRepo(sessions, isQuiet);

      if (!isQuiet) {
        console.log(`✅ Listo (${result.written} nuevas/actualizadas, ${result.skipped} sin cambios).`);
      }

      if (options.handoff) {
        const primary = pickPrimarySession(sessions);
        const handoffPath = await generateHandoff(primary || undefined, {
          fromRepo: !primary,
        });
        if (!isQuiet) {
          console.log(`📄 Handoff: ${handoffPath}`);
          if (primary) console.log(`   Basado en sesión: ${primary.id}`);
        }
      }
    } catch (error: any) {
      console.error('❌ Error durante la sincronización:', error.message);
      process.exit(1);
    }
  });
