import { OpenCodeSession } from '../plugin/storage-reader';
import { SummarizedSession } from './types';
import { Logger } from '../core/logger';

// Thresholds por defecto
const MESSAGE_THRESHOLD = 10;
const SIZE_THRESHOLD_BYTES = 100 * 1024;

interface SummarizerConfig {
  provider: 'openai' | 'local' | 'none';
  openaiApiKey?: string;
  model?: string;
}

export class ModularSummarizer {
  private config: SummarizerConfig;

  constructor(config: SummarizerConfig) {
    this.config = config;
  }

  /** Always returns a SummarizedSession (runs local summarizer if thresholds not met). */
  async toSummary(session: OpenCodeSession): Promise<SummarizedSession> {
    const processed = await this.process(session);
    if ('isSummary' in processed && processed.isSummary) {
      return processed;
    }
    return this.summarizeLocally(session);
  }

  async process(session: OpenCodeSession): Promise<OpenCodeSession | SummarizedSession> {
    if (!this.shouldSummarize(session)) {
      Logger.dim(`Sesión ${session.id} — sin resumen necesario`);
      return session;
    }

    Logger.dim(`Resumiendo ${session.id} (${this.config.provider})…`);

    switch (this.config.provider) {
      case 'openai':
        return this.summarizeWithOpenAI(session);
      case 'local':
        return this.summarizeLocally(session);
      case 'none':
      default:
        Logger.dim('Resumen desactivado — sesión completa');
        return session;
    }
  }

  private shouldSummarize(session: OpenCodeSession): boolean {
    if (session.messages.length > MESSAGE_THRESHOLD) return true;
    const size = Buffer.byteLength(JSON.stringify(session), 'utf8');
    if (size > SIZE_THRESHOLD_BYTES) return true;
    return false;
  }

  private async summarizeWithOpenAI(session: OpenCodeSession): Promise<OpenCodeSession | SummarizedSession> {
    try {
      const { OpenAI } = await import('openai');
      const apiKey = this.config.openaiApiKey || process.env.OPENAI_API_KEY;
      
      if (!apiKey) {
        Logger.warn('No hay API key de OpenAI. Usando resumen local como fallback.');
        return this.summarizeLocally(session);
      }

      const openai = new OpenAI({ apiKey });

      const prompt = `Eres un experto desarrollador... [mismo prompt del engine original]`;

      const response = await openai.chat.completions.create({
        model: this.config.model || 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error('No se recibió respuesta del LLM');

      const parsedContent = JSON.parse(content);

      return {
        id: session.id,
        originalCreatedAt: session.createdAt,
        summarizedAt: Date.now(),
        project: session.project,
        isSummary: true,
        content: parsedContent,
      } as SummarizedSession;
    } catch (error: any) {
      Logger.error(`Falló OpenAI: ${error.message}. Usando resumen local.`);
      return this.summarizeLocally(session);
    }
  }

  private summarizeLocally(session: OpenCodeSession): SummarizedSession {
    const messages = session.messages;
    const userMessages = messages.filter(m => m.role === 'user');

    const fileMentions = new Set<string>();
    const allText = messages.map(m => m.content).join('\n');
    const filePattern = /\b([\w./-]+\.(?:ts|tsx|js|jsx|py|go|rs|java|md|json))\b/g;
    let match;
    while ((match = filePattern.exec(allText)) !== null) {
      const f = match[1];
      if (!f.includes('node_modules')) fileMentions.add(f);
    }

    const stripNoise = (text: string) =>
      text
        .replace(/<user_query>[\s\S]*?<\/user_query>/g, (m) => m.replace(/<\/?user_query>/g, '').trim())
        .replace(/REDACTED/g, '')
        .replace(/▣\s*Build[^\n]*/g, '')
        .trim();

    const userSnippets = userMessages
      .map(m => stripNoise(m.content))
      .filter(t => t.length > 15)
      .slice(-4);

    const decisions: string[] = [];
    const decisionLine = /^[-*]\s+|^\d+\.\s+/;
    const looksLikeRoadmap = (line: string) =>
      /^\d+\.\s+\*\*/.test(line) ||
      /v1\.\d|roadmap|fase \d|won'?t fix|fuera de scope/i.test(line);

    for (const msg of userMessages.slice(-8)) {
      const lines = msg.content.split('\n').filter(l => decisionLine.test(l.trim()));
      lines.slice(0, 4).forEach(l => {
        const clean = stripNoise(l).substring(0, 120);
        if (clean.length > 20 && !looksLikeRoadmap(clean)) decisions.push(clean);
      });
    }
    if (decisions.length === 0) {
      decisions.push('Proyecto Relay: sync cifrado, HANDOFF.md y puente entre editores (Cursor/OpenCode/Antigravity).');
    }

    const editor =
      session.id.startsWith('cursor-') ? 'Cursor' :
      session.id.startsWith('vscode-') ? 'VS Code' :
      session.id.startsWith('antigravity-') ? 'Antigravity' : 'OpenCode';

    const titleClean = session.title
      ? stripNoise(session.title).replace(/<user_query>|<\/user_query>/gi, '').trim()
      : '';

    const summaryParts = [
      `Sesión anterior en **${editor}** (${messages.length} mensajes).`,
      titleClean && titleClean.length < 80 ? `Último tema del usuario: «${titleClean}».` : '',
      userSnippets.length
        ? `Hilo reciente: ${userSnippets.map(s => s.substring(0, 72).replace(/\s+/g, ' ')).join(' → ')}`
        : '',
    ].filter(Boolean);

    const next_steps: string[] = [];
    const lastUser = stripNoise(userMessages[userMessages.length - 1]?.content || '');
    if (lastUser.length > 10 && lastUser.length < 200) {
      next_steps.push(`Última petición del usuario: «${lastUser}»`);
    }
    next_steps.push('Confirmar con el usuario el siguiente paso (no asumir tareas del handoff).');
    next_steps.push(`Transcript completo si hace falta: session-${session.id}`);

    return {
      id: session.id,
      originalCreatedAt: session.createdAt,
      summarizedAt: Date.now(),
      project: session.project,
      isSummary: true,
      content: {
        summary: summaryParts.join(' '),
        decisions: [...new Set(decisions)].slice(0, 8),
        key_files: Array.from(fileMentions).slice(0, 12),
        next_steps,
      },
    };
  }
}
