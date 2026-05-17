import { Command } from 'commander';
import { generateHandoff } from '../../sync/handoff';
import { readOpenCodeSessions } from '../../plugin/storage-reader';
import { AntigravityReader } from '../../plugin/antigravity-reader';
import { CursorReader } from '../../plugin/cursor-reader';
import { Logger } from '../../core/logger';

export const handoffCommand = new Command('handoff')
  .description('Genera .ai-memory/HANDOFF.md para que tu equipo continúe tras git pull')
  .option('--from-repo', 'Usa la última sesión guardada en .ai-memory/sessions/')
  .option('--editor <name>', 'Toma la última sesión del editor: opencode | antigravity | cursor')
  .option('-o, --output <path>', 'Ruta de salida (default: .ai-memory/HANDOFF.md)')
  .option('-q, --quiet', 'Solo imprime la ruta del archivo')
  .action(async (options) => {
    try {
      let session = undefined;

      if (options.editor) {
        if (options.editor === 'opencode') {
          const sessions = await readOpenCodeSessions();
          session = sessions[sessions.length - 1];
        } else if (options.editor === 'antigravity') {
          session = await AntigravityReader.readLatestSession() || undefined;
        } else if (options.editor === 'cursor') {
          session = await CursorReader.readLatestSession() || undefined;
        } else {
          Logger.error('Editor desconocido. Usa: opencode | antigravity | cursor');
          process.exit(1);
        }

        if (!session) {
          Logger.error(`No se encontraron sesiones en ${options.editor}.`);
          process.exit(1);
        }
      }

      const outputPath = await generateHandoff(session, {
        fromRepo: options.fromRepo || !options.editor,
        outputPath: options.output,
      });

      if (options.quiet) {
        console.log(outputPath);
      } else {
        Logger.success(`Handoff generado: ${outputPath}`);
        Logger.info('Commitea este archivo junto con las sesiones para tu equipo.');
      }
    } catch (error: any) {
      Logger.error(error.message);
      process.exit(1);
    }
  });
