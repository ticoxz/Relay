import { Command } from 'commander';
import path from 'path';
import { writeSessionsToRepo } from '../../sync/writer';
import { generateHandoff } from '../../sync/handoff';
import { collectSessionsForSync, pickPrimarySession } from '../../sync/collect-sessions';
import { EDITOR_META, EditorKey, Logger } from '../../core/logger';

export const syncCommand = new Command('sync')
  .description('Guarda sesiones de editores en .ai-memory/sessions/ (por defecto: la más reciente de cada uno)')
  .option('-q, --quiet', 'Silencia la salida (ideal para hooks)')
  .option('--handoff', 'Regenera .ai-memory/HANDOFF.md desde la sesión principal')
  .option('--all', 'Sincronizar todo el historial de OpenCode/Cursor/Antigravity/VS Code (puede ser lento)')
  .action(async (options) => {
    Logger.setQuiet(!!options.quiet);

    if (Logger.shouldLog()) {
      Logger.banner(
        'sync',
        options.all
          ? 'Modo completo: todo el historial por editor'
          : 'Modo rápido: última sesión por editor'
      );
    }

    try {
      if (Logger.shouldLog()) {
        Logger.phase('🔍', 'Buscando sesiones en tus editores');
      }

      const { sessions, stats } = await collectSessionsForSync({
        all: options.all,
        onEditor: (editor, status, detail) => {
          if (!Logger.shouldLog()) return;
          Logger.editorLine(
            editor,
            status === 'active' ? 'active' : status === 'ok' ? 'ok' : 'skip',
            detail
          );
        },
      });

      if (sessions.length === 0) {
        if (Logger.shouldLog()) {
          Logger.warn('No se encontraron sesiones para sincronizar.');
          Logger.dim('Abrí el proyecto en Cursor, VS Code, OpenCode o Antigravity y chateá con la IA.');
        }
        return;
      }

      if (Logger.shouldLog()) {
        Logger.blank();
        Logger.phase('🔐', 'Guardando y encriptando en .ai-memory/sessions/');
      }

      const result = await writeSessionsToRepo(sessions, options.quiet);

      if (Logger.shouldLog()) {
        Logger.summaryBox('Resumen', [
          ['Sesiones', String(sessions.length)],
          ['Nuevas/actualizadas', String(result.written)],
          ['Sin cambios', String(result.skipped)],
          ['OpenCode', String(stats.opencode)],
          ['Antigravity', String(stats.antigravity)],
          ['Cursor', String(stats.cursor)],
          ['VS Code', String(stats.vscode)],
        ]);
      }

      if (options.handoff) {
        if (Logger.shouldLog()) {
          Logger.phase('📝', 'Generando HANDOFF.md');
        }

        const primary = pickPrimarySession(sessions);
        const handoff = await Logger.withSpinner(
          'Escribiendo handoff',
          () =>
            generateHandoff(primary || undefined, {
              fromRepo: !primary,
            })
        );

        if (Logger.shouldLog()) {
          Logger.success(`Handoff listo: ${handoff.mdPath}`);
          Logger.dim(`JSON: ${handoff.jsonPath}`);
          if (primary) {
            const pe: EditorKey = primary.id.startsWith('cursor-')
              ? 'cursor'
              : primary.id.startsWith('vscode-')
                ? 'vscode'
                : primary.id.startsWith('antigravity-')
                  ? 'antigravity'
                  : 'opencode';
            Logger.dim(`Basado en ${EDITOR_META[pe].label}: ${primary.id}`);
          }
          Logger.howToUseAtPath('tu editor (Cursor, VS Code, etc.)', handoff.mdPath, {
            samplePrompt:
              'Leé el handoff y explicame en qué quedamos con este proyecto. No ejecutes nada hasta que te lo pida.',
          });
          Logger.nextSteps([
            'git add .ai-memory/HANDOFF.md .ai-memory/config.json && git commit',
            'Otro editor con el chat completo: relay inject cursor antigravity',
          ]);
        }
      } else if (Logger.shouldLog()) {
        Logger.success('Sincronización completada.');
        Logger.dim('Tip: añade --handoff para generar .ai-memory/HANDOFF.md');
      }
    } catch (error: any) {
      Logger.error('Error durante la sincronización: ' + error.message);
      process.exit(1);
    }
  });
