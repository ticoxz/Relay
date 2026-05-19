import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { OpenCodeSession } from '../../plugin/storage-reader';
import { resolveEditorSession } from '../../sync/resolve-editor-session';
import { AntigravityInjector } from '../../plugin/antigravity-injector';
import { OpenCodeInjector } from '../../plugin/opencode-injector';
import { AgeEncryption } from '../../encryption/age';
import { EDITOR_META, EditorKey, Logger } from '../../core/logger';

const SUPPORTED_EDITORS: EditorKey[] = ['opencode', 'antigravity', 'cursor', 'vscode'];

function editorLabel(key: string): string {
  return EDITOR_META[key as EditorKey]?.label || key;
}

export const injectCommand = new Command('inject')
  .description('Inyecta sesiones entre editores (OpenCode ↔ Antigravity ↔ Cursor ↔ VS Code)')
  .argument('<source>', 'Editor origen: opencode | antigravity | cursor | vscode')
  .argument('<target>', 'Editor destino: opencode | antigravity | cursor | vscode')
  .option(
    '-s, --session <ref>',
    'Número 1–N (como relay status --sessions) o id de sesión'
  )
  .action(async (source: string, target: string, options) => {
    if (!SUPPORTED_EDITORS.includes(source as EditorKey) || !SUPPORTED_EDITORS.includes(target as EditorKey)) {
      Logger.error(`Editores válidos: ${SUPPORTED_EDITORS.join(', ')}`);
      return;
    }

    if (source === target) {
      Logger.error('El origen y destino deben ser editores diferentes.');
      return;
    }

    Logger.banner(
      'inject',
      `${EDITOR_META[source as EditorKey].icon} ${editorLabel(source)} → ${EDITOR_META[target as EditorKey].icon} ${editorLabel(target)}`
    );

    if (options.session) {
      await injectSpecificSession(source, target, options.session);
    } else {
      await injectLatestSession(source, target);
    }
  });

async function injectLatestSession(source: string, target: string) {
  Logger.phase('🔍', `Buscando última sesión en ${editorLabel(source)}`);

  const result = await Logger.withSpinner('Leyendo sesión', () =>
    resolveEditorSession(source as EditorKey, undefined, process.cwd())
  );

  if (result.error) {
    Logger.error(result.error);
    return;
  }
  if (!result.session) {
    Logger.warn(`No hay sesiones en ${editorLabel(source)} para este proyecto.`);
    return;
  }

  Logger.success(`Sesión encontrada: ${result.session.id}`);
  Logger.dim(`${result.session.messages.length} mensajes`);
  await performInjection(result.session, target);
}

async function injectSpecificSession(source: string, target: string, sessionRef: string) {
  const label = /^\d+$/.test(sessionRef.trim())
    ? `#${sessionRef.trim()} en ${editorLabel(source)}`
    : sessionRef;
  Logger.phase('🔍', `Buscando ${label}`);

  const result = await Logger.withSpinner('Leyendo sesión', () =>
    resolveEditorSession(source as EditorKey, sessionRef, process.cwd())
  );

  if (result.error) {
    Logger.error(result.error);
    return;
  }
  if (!result.session) {
    Logger.error(`Sesión no encontrada en ${editorLabel(source)}.`);
    return;
  }

  if (/^\d+$/.test(sessionRef.trim())) {
    Logger.dim(`→ ${result.session.id} (${result.session.messages.length} msgs)`);
  }

  await performInjection(result.session, target);
}

function writeEditorImportMarkdown(session: OpenCodeSession, subdir: string): string {
  const importDir = path.join(process.cwd(), '.ai-memory', subdir);
  fs.mkdirSync(importDir, { recursive: true });

  const fileName = `session-${session.id}.md`;
  const filePath = path.join(importDir, fileName);

  const lines = session.messages.map(m => {
    const header = m.role === 'user' ? '## Usuario' : '## Asistente';
    return `${header}\n\n${m.content}\n`;
  });

  const markdown = `# Sesión importada (${session.id})\n\n${lines.join('\n---\n\n')}\n`;
  fs.writeFileSync(filePath, markdown, 'utf-8');
  return filePath;
}

async function performInjection(session: OpenCodeSession, target: string) {
  Logger.phase('💉', `Inyectando en ${editorLabel(target)}`);

  if (target === 'antigravity') {
    const conversationId = await Logger.withSpinner('Escribiendo en Antigravity', () =>
      AntigravityInjector.inject(session)
    );
    const sessionPath = path.join(
      os.homedir(),
      '.gemini',
      'antigravity',
      'brain',
      conversationId,
      'session.md'
    );
    Logger.success('Sesión escrita en disco de Antigravity');
    Logger.howToUseAtPath('Antigravity', sessionPath, {
      samplePrompt:
        'Leé esta sesión importada con Relay y explicame en qué quedamos. No ejecutes nada hasta que te lo pida.',
      note: 'No vas a verla en el panel lateral — solo funciona con @path en el chat.',
    });
    Logger.dim(`Conversation ID: ${conversationId}`);
    return;
  }

  if (target === 'opencode') {
    const conversationId = await Logger.withSpinner('Escribiendo en OpenCode', async () =>
      OpenCodeInjector.injectSession(session)
    );
    Logger.success('Sesión agregada al historial de OpenCode');
    Logger.dim(`Debería aparecer en el panel de sesiones de OpenCode.`);
    Logger.dim(`Session ID: ${conversationId}`);
    Logger.nextSteps([
      'Abrí OpenCode y buscá la sesión en el historial',
      'relay status --editor opencode --sessions',
    ]);
    return;
  }

  if (target === 'cursor') {
    const sessionPath = writeEditorImportMarkdown(session, 'cursor-import');
    Logger.success('Markdown exportado para Cursor');
    Logger.howToUseAtPath('Cursor', sessionPath, {
      samplePrompt:
        'Leé este archivo importado con Relay y contame en qué quedamos. No corras comandos ni edites archivos hasta que te lo pida.',
    });
    return;
  }

  if (target === 'vscode') {
    const sessionPath = writeEditorImportMarkdown(session, 'vscode-import');
    Logger.success('Markdown exportado para VS Code');
    Logger.howToUseAtPath('VS Code (Copilot Chat)', sessionPath, {
      samplePrompt:
        'Read this Relay import and summarize where we left off. Do not run tools until I ask.',
    });
  }
}

export const pullCommand = new Command('pull')
  .description('Descarga la última sesión del editor al repo (.ai-memory/sessions/)')
  .argument('[editor]', 'Editor: opencode | antigravity | cursor | vscode (default: todos)')
  .action(async (editor?: string) => {
    Logger.banner('pull', editor ? editorLabel(editor) : 'todos los editores');
    Logger.phase('📥', 'Descargando al repositorio');

    const editors = editor ? [editor] : SUPPORTED_EDITORS;
    const memoryDir = path.join(process.cwd(), '.ai-memory', 'sessions');

    if (!fs.existsSync(memoryDir)) {
      Logger.error('.ai-memory/sessions no existe. Ejecutá relay init primero.');
      return;
    }

    let saved = 0;
    for (const ed of editors) {
      if (!SUPPORTED_EDITORS.includes(ed as EditorKey)) {
        Logger.error(`Editor desconocido: ${ed}`);
        continue;
      }

      const { session } = await resolveEditorSession(ed as EditorKey, undefined, process.cwd());
      if (session) {
        const recipients = AgeEncryption.getRecipients();
        const useEncryption = recipients.length > 0;
        const fileName = `session-${session.id}${useEncryption ? '.json.age' : '.json'}`;
        const filePath = path.join(memoryDir, fileName);
        const content = JSON.stringify(session, null, 2);

        if (useEncryption) {
          AgeEncryption.encrypt(content, filePath);
        } else {
          fs.writeFileSync(filePath, content, 'utf-8');
        }

        Logger.editorLine(ed as EditorKey, 'ok', fileName);
        saved++;
      } else {
        Logger.editorLine(ed as EditorKey, 'skip', 'sin sesiones');
      }
    }

    Logger.summaryBox('Pull', [['Guardadas', String(saved)]]);
    Logger.success('Pull completado.');
  });

export const pushCommand = new Command('push')
  .description('Guía para enviar sesiones locales a un editor')
  .argument('[editor]', 'Editor destino: opencode | antigravity | cursor | vscode')
  .option('--dry-run', 'Solo muestra qué se enviaría')
  .action(async (editor?: string) => {
    const editors = editor ? [editor] : SUPPORTED_EDITORS;
    const memoryDir = path.join(process.cwd(), '.ai-memory', 'sessions');

    if (!fs.existsSync(memoryDir)) {
      Logger.error('.ai-memory/sessions no existe. Ejecutá relay init primero.');
      return;
    }

    const files = fs.readdirSync(memoryDir).filter(f => f.endsWith('.age') || f.endsWith('.json'));
    if (files.length === 0) {
      Logger.warn('No hay sesiones guardadas.');
      return;
    }

    Logger.banner('push', `${files.length} sesión(es) en el repo`);
    Logger.nextSteps(
      editors.map(ed => {
        if (ed === 'antigravity') return 'relay inject opencode antigravity';
        if (ed === 'opencode') return 'relay inject cursor opencode';
        if (ed === 'cursor') return 'relay inject cursor antigravity';
        return 'relay inject cursor vscode';
      })
    );
  });
