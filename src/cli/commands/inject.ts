import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { readOpenCodeSessions, OpenCodeSession } from '../../plugin/storage-reader';
import { AntigravityReader } from '../../plugin/antigravity-reader';
import { AntigravityInjector } from '../../plugin/antigravity-injector';
import { OpenCodeInjector } from '../../plugin/opencode-injector';
import { CursorReader } from '../../plugin/cursor-reader';
import { AgeEncryption } from '../../encryption/age';

const SUPPORTED_EDITORS = ['opencode', 'antigravity', 'cursor'];

export const injectCommand = new Command('inject')
  .description('Inyecta sesiones entre editores (OpenCode ↔ Antigravity ↔ Cursor)')
  .argument('<source>', 'Editor origen: opencode | antigravity | cursor')
  .argument('<target>', 'Editor destino: opencode | antigravity | cursor')
  .option('-s, --session <id>', 'ID de sesión específica a migrar (opcional)')
  .action(async (source: string, target: string, options) => {
    if (!SUPPORTED_EDITORS.includes(source) || !SUPPORTED_EDITORS.includes(target)) {
      console.error(`❌ Editores válidos: ${SUPPORTED_EDITORS.join(', ')}`);
      return;
    }

    if (source === target) {
      console.error('❌ El origen y destino deben ser editores diferentes.');
      return;
    }

    if (options.session) {
      await injectSpecificSession(source, target, options.session);
    } else {
      await injectLatestSession(source, target);
    }
  });

async function resolveSession(source: string, sessionId?: string): Promise<OpenCodeSession | null> {
  if (source === 'opencode') {
    const sessions = await readOpenCodeSessions();
    if (sessionId) {
      return sessions.find(s => s.id === sessionId) || null;
    }
    return sessions.length > 0 ? sessions[sessions.length - 1] : null;
  }

  if (source === 'antigravity') {
    if (sessionId) {
      return AntigravityReader.readSessionById(sessionId);
    }
    return AntigravityReader.readLatestSession();
  }

  if (source === 'cursor') {
    if (sessionId) {
      return CursorReader.readSessionById(sessionId);
    }
    return CursorReader.readLatestSession();
  }

  return null;
}

async function injectLatestSession(source: string, target: string) {
  console.log(`🔄 Buscando sesión más reciente en ${source}...`);
  const session = await resolveSession(source);

  if (!session) {
    console.log(`❌ No se encontraron sesiones en ${source}.`);
    return;
  }

  console.log('📦 Sesión encontrada:', session.id);
  await performInjection(session, target);
}

async function injectSpecificSession(source: string, target: string, sessionId: string) {
  console.log(`🔄 Buscando sesión: ${sessionId} en ${source}...`);
  const session = await resolveSession(source, sessionId);

  if (!session) {
    console.log(`❌ Sesión ${sessionId} no encontrada en ${source}.`);
    return;
  }

  await performInjection(session, target);
}

function writeCursorImportMarkdown(session: OpenCodeSession): string {
  const importDir = path.join(process.cwd(), '.ai-memory', 'cursor-import');
  fs.mkdirSync(importDir, { recursive: true });

  const fileName = `session-${session.id}.md`;
  const filePath = path.join(importDir, fileName);

  const lines = session.messages.map(m => {
    const header = m.role === 'user' ? '## Usuario' : '## Asistente';
    return `${header}\n\n${m.content}\n`;
  });

  const markdown = `# Sesión importada (${session.id})

${lines.join('\n---\n\n')}
`;

  fs.writeFileSync(filePath, markdown, 'utf-8');
  return filePath;
}

async function performInjection(session: OpenCodeSession, target: string) {
  console.log(`💉 Inyectando en ${target}...`);

  if (target === 'antigravity') {
    const conversationId = await AntigravityInjector.inject(session);
    const sessionPath = path.join(os.homedir(), '.gemini', 'antigravity', 'brain', conversationId, 'session.md');
    console.log('✅ Sesión inyectada en Antigravity (filesystem).');
    console.log('');
    console.log('📋 Flujo oficial — usa @path en el chat de Antigravity:');
    console.log(`   @${sessionPath}`);
    console.log('');
    console.log('⚠️  La sesión no aparecerá en el panel lateral (limitación de Antigravity).');
    console.log(`📁 Conversation ID: ${conversationId}`);
    return;
  }

  if (target === 'opencode') {
    const conversationId = OpenCodeInjector.injectSession(session);
    console.log('✅ Sesión inyectada en OpenCode.');
    console.log(`   Session ID: ${conversationId}`);
    console.log('   contextvc status --editor opencode');
    return;
  }

  if (target === 'cursor') {
    const sessionPath = writeCursorImportMarkdown(session);
    console.log('✅ Sesión exportada para Cursor.');
    console.log('');
    console.log('📋 En el chat de Cursor, referencia el archivo:');
    console.log(`   @${sessionPath}`);
    console.log('');
    console.log('⚠️  Cursor no expone API pública para importar al historial nativo.');
  }
}

export const pullCommand = new Command('pull')
  .description('Descarga la última sesión del editor al repo (.ai-memory/sessions/)')
  .argument('[editor]', 'Editor: opencode | antigravity | cursor (default: todos)')
  .action(async (editor?: string) => {
    console.log('🔄 Descargando sesiones...');

    const editors = editor ? [editor] : ['opencode', 'antigravity', 'cursor'];
    const memoryDir = path.join(process.cwd(), '.ai-memory', 'sessions');

    if (!fs.existsSync(memoryDir)) {
      console.error('❌ .ai-memory/sessions no existe. Ejecuta "contextvc init" primero.');
      return;
    }

    for (const ed of editors) {
      if (!SUPPORTED_EDITORS.includes(ed)) {
        console.error(`❌ Editor desconocido: ${ed}`);
        continue;
      }

      const session = await resolveSession(ed);

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

        console.log(`✅ ${ed}: ${session.id} → ${fileName}`);
      } else {
        console.log(`ℹ️ ${ed}: sin sesiones.`);
      }
    }

    console.log('✅ Pull completado.');
  });

export const pushCommand = new Command('push')
  .description('Guía para enviar sesiones locales a un editor')
  .argument('[editor]', 'Editor destino: opencode | antigravity | cursor')
  .option('--dry-run', 'Solo muestra qué se enviaría')
  .action(async (editor?: string) => {
    const editors = editor ? [editor] : SUPPORTED_EDITORS;
    const memoryDir = path.join(process.cwd(), '.ai-memory', 'sessions');

    if (!fs.existsSync(memoryDir)) {
      console.error('❌ .ai-memory/sessions no existe. Ejecuta "contextvc init" primero.');
      return;
    }

    const files = fs.readdirSync(memoryDir).filter(f => f.endsWith('.age') || f.endsWith('.json'));
    if (files.length === 0) {
      console.log('ℹ️ No hay sesiones guardadas.');
      return;
    }

    console.log(`🔼 ${files.length} sesión(es) locales. Usa inject para cada destino:\n`);

    for (const ed of editors) {
      if (ed === 'antigravity') {
        console.log('  contextvc inject opencode antigravity  # luego @path en Antigravity');
      } else if (ed === 'opencode') {
        console.log('  contextvc inject antigravity opencode');
      } else if (ed === 'cursor') {
        console.log('  contextvc inject opencode cursor  # luego @.ai-memory/cursor-import/...');
      }
    }
  });
