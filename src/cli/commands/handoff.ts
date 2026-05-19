import { Command } from 'commander';
import { generateHandoff, readHandoffJson } from '../../sync/handoff';
import { buildAgentPrompt } from '../../sync/handoff-build';
import { resolveEditorSession } from '../../sync/resolve-editor-session';
import { EditorKey, EDITOR_META, Logger } from '../../core/logger';

export const handoffCommand = new Command('handoff')
  .description('Genera .ai-memory/HANDOFF.md para que tu equipo continúe tras git pull')
  .option('--from-repo', 'Usa la última sesión guardada en .ai-memory/sessions/')
  .option('--editor <name>', 'Última sesión del editor: opencode | antigravity | cursor | vscode')
  .option(
    '-s, --session <ref>',
    'Número 1–N (relay status --editor … --sessions) o id de sesión; requiere --editor'
  )
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
      const editors: EditorKey[] = ['opencode', 'antigravity', 'cursor', 'vscode'];

      if (options.session && !options.editor) {
        Logger.error('--session requiere --editor. Ej: relay handoff --editor opencode --session 3');
        process.exit(1);
      }

      if (options.editor) {
        if (!editors.includes(options.editor as EditorKey)) {
          Logger.error('Editor desconocido. Usa: opencode | antigravity | cursor | vscode');
          process.exit(1);
        }

        const editor = options.editor as EditorKey;
        const label = options.session
          ? /^\d+$/.test(String(options.session).trim())
            ? `#${options.session} · ${EDITOR_META[editor].label}`
            : `${options.session} · ${EDITOR_META[editor].label}`
          : EDITOR_META[editor].label;

        if (!options.quiet) Logger.phase('🔍', `Leyendo ${label}`);

        const resolved = await resolveEditorSession(
          editor,
          options.session ? String(options.session) : undefined,
          projectPath
        );

        if (resolved.error) {
          Logger.error(resolved.error);
          if (/^\d+$/.test(String(options.session).trim())) {
            Logger.dim(`Listá sesiones: relay status --editor ${editor} --sessions`);
          }
          process.exit(1);
        }

        session = resolved.session || undefined;
        if (!session) {
          Logger.error(`No hay sesiones en ${options.editor}.`);
          process.exit(1);
        }

        if (!options.quiet && options.session) {
          Logger.dim(`Sesión: ${session.id} · ${session.messages?.length ?? 0} mensajes`);
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
