import { Command } from 'commander';
import { generateHandoff, readHandoffJson } from '../../sync/handoff';
import { buildAgentPrompt } from '../../sync/handoff-build';
import { readOpenCodeSessions } from '../../plugin/storage-reader';
import { latestSessionForProject } from '../../sync/project-filter';
import { AntigravityReader } from '../../plugin/antigravity-reader';
import { CursorReader } from '../../plugin/cursor-reader';
import { VSCodeReader } from '../../plugin/vscode-reader';
import { Logger } from '../../core/logger';

export const handoffCommand = new Command('handoff')
  .description('Genera .ai-memory/HANDOFF.md para que tu equipo continúe tras git pull')
  .option('--from-repo', 'Usa la última sesión guardada en .ai-memory/sessions/')
  .option('--editor <name>', 'Última sesión del editor: opencode | antigravity | cursor | vscode')
  .option('-o, --output <path>', 'Ruta de salida (default: .ai-memory/HANDOFF.md)')
  .option('-q, --quiet', 'Solo imprime la ruta del archivo')
  .option(
    '--for-agent',
    'Print copy-paste prompt for a new chat (@HANDOFF + instructions for the agent)'
  )
  .action(async (options) => {
    Logger.setQuiet(!!options.quiet);

    try {
      if (!options.quiet) {
        Logger.banner('handoff', 'Briefing para el próximo chat o compañero');
      }

      let session = undefined;
      const projectPath = process.cwd();

      if (options.editor) {
        if (!options.quiet) Logger.phase('🔍', `Leyendo ${options.editor}`);

        if (options.editor === 'opencode') {
          const sessions = await readOpenCodeSessions();
          session = latestSessionForProject(sessions, projectPath) || undefined;
        } else if (options.editor === 'antigravity') {
          session = (await AntigravityReader.readLatestSession()) || undefined;
        } else if (options.editor === 'cursor') {
          session = (await CursorReader.readLatestSession(projectPath)) || undefined;
        } else if (options.editor === 'vscode') {
          session = (await VSCodeReader.readLatestSession(projectPath)) || undefined;
        } else {
          Logger.error('Editor desconocido. Usa: opencode | antigravity | cursor | vscode');
          process.exit(1);
        }

        if (!session) {
          Logger.error(`No hay sesiones en ${options.editor}.`);
          process.exit(1);
        }
      }

      const result = await Logger.withSpinner('Generando HANDOFF.md', () =>
        generateHandoff(session, {
          fromRepo: options.fromRepo || !options.editor,
          outputPath: options.output,
        })
      );

      if (options.forAgent) {
        const doc = readHandoffJson(process.cwd());
        if (!doc) {
          Logger.error('HANDOFF.json missing after generate. Run relay sync --handoff.');
          process.exit(1);
        }
        const prompt = buildAgentPrompt(doc, result.mdPath);

        if (options.quiet) {
          console.log(prompt);
        } else {
          Logger.banner('handoff --for-agent', 'Prompt for a new AI chat');
          console.log(prompt);
          console.log('');
          Logger.howToUseAtPath('your editor', result.mdPath, {
            samplePrompt:
              'Read the handoff and explain where we left off. Do not run commands or edit files until I ask.',
          });
        }
        return;
      }

      if (options.quiet) {
        console.log(result.mdPath);
      } else {
        Logger.success(`Handoff guardado: ${result.mdPath}`);
        Logger.dim(`JSON: ${result.jsonPath}`);
        Logger.howToUseAtPath('tu editor', result.mdPath, {
          samplePrompt:
            'Leé el handoff y explicame en qué quedamos. No ejecutes comandos ni edites archivos hasta que te lo pida.',
          note: 'Para tu equipo: commiteá HANDOFF.md y hacé git push.',
        });
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      Logger.error(msg);
      process.exit(1);
    }
  });
