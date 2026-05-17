import fs from 'fs';
import path from 'path';
import { OpenCodeSession } from '../plugin/storage-reader';
import { SummarizedSession } from '../summarizer/types';
import { ModularSummarizer } from '../summarizer/modular-summarizer';
import { ConfigManager } from '../core/config';
import { AgeEncryption } from '../encryption/age';

function loadSessionFromRepo(sessionsDir: string): OpenCodeSession | SummarizedSession | null {
  if (!fs.existsSync(sessionsDir)) return null;

  const files = fs.readdirSync(sessionsDir)
    .filter(f => f.endsWith('.json') || f.endsWith('.age'))
    .map(f => ({ name: f, mtime: fs.statSync(path.join(sessionsDir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);

  if (files.length === 0) return null;

  const latest = files[0].name;
  const filePath = path.join(sessionsDir, latest);

  let raw: string;
  if (latest.endsWith('.age')) {
    raw = AgeEncryption.decrypt(filePath);
  } else {
    raw = fs.readFileSync(filePath, 'utf-8');
  }

  return JSON.parse(raw);
}

function formatHandoffMarkdown(
  session: OpenCodeSession | SummarizedSession,
  summarized: SummarizedSession
): string {
  const date = new Date().toISOString();
  const { summary, decisions, key_files, next_steps } = summarized.content;

  const sessionFile = `session-${session.id}.summary.json.age`;

  return `# AI Session Handoff

> Generado por Relay el ${date}
> Sesión: \`${session.id}\` | Proyecto: \`${session.project}\`

## Para el asistente (leer primero)

Este archivo es **memoria de una sesión anterior**, no un plan de ejecución automático.

1. **Explicá** al usuario en lenguaje claro (2–4 párrafos): qué se hizo, qué quedó pendiente y dónde está el proyecto.
2. **No** ejecutes comandos, no explores el repo ni edites archivos hasta que el usuario lo pida explícitamente.
3. **Preguntá** al final qué quiere hacer ahora (ej. publicar npm, seguir una feature, revisar un archivo).

Si el usuario solo adjuntó este archivo sin más texto, tu primera respuesta debe ser esa explicación + pregunta — no empezar a implementar.

---

## Resumen

${summary}

## Decisiones tomadas

${decisions.length ? decisions.map(d => `- ${d}`).join('\n') : '- (ninguna detectada)'}

## Archivos relevantes

${key_files.length ? key_files.map(f => `- \`${f}\``).join('\n') : '- (ninguno detectado)'}

## Pendientes (orientativos, no ejecutar solos)

${next_steps.length ? next_steps.map(s => `- ${s}`).join('\n') : '- El usuario indicará el siguiente paso en este chat.'}

---

*Complementa \`context.md\` / \`CLAUDE.md\` (manual del proyecto). Este archivo = estado de la última sesión de IA.*

Transcript cifrado: \`relay decrypt .ai-memory/sessions/${sessionFile}\`
`;
}

export async function generateHandoff(
  session?: OpenCodeSession | SummarizedSession,
  options: { fromRepo?: boolean; outputPath?: string } = {}
): Promise<string> {
  const cwd = process.cwd();
  const memoryDir = path.join(cwd, '.ai-memory');
  const sessionsDir = path.join(memoryDir, 'sessions');
  const outputPath = options.outputPath || path.join(memoryDir, 'HANDOFF.md');

  let targetSession = session;

  if (!targetSession && options.fromRepo) {
    targetSession = loadSessionFromRepo(sessionsDir) || undefined;
  }

  if (!targetSession) {
    throw new Error('No hay sesión disponible. Ejecuta `relay sync` o pasa una sesión.');
  }

  const config = ConfigManager.load();
  const summarizer = new ModularSummarizer(config?.summarizer || { provider: 'local' });

  let summarized: SummarizedSession;
  if ('isSummary' in targetSession && targetSession.isSummary) {
    summarized = targetSession;
  } else {
    summarized = await summarizer.toSummary(targetSession as OpenCodeSession);
  }

  const markdown = formatHandoffMarkdown(targetSession, summarized);

  if (!fs.existsSync(memoryDir)) {
    fs.mkdirSync(memoryDir, { recursive: true });
  }

  fs.writeFileSync(outputPath, markdown, 'utf-8');
  return outputPath;
}
