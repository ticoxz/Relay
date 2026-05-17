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
      Logger.info(`Sesión ${session.id} no necesita resumen.`);
      return session;
    }

    Logger.info(`Procesando sesión ${session.id} (método: ${this.config.provider})...`);

    switch (this.config.provider) {
      case 'openai':
        return this.summarizeWithOpenAI(session);
      case 'local':
        return this.summarizeLocally(session);
      case 'none':
      default:
        Logger.info('Resumen desactivado, guardando sesión completa.');
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
    const assistantMessages = messages.filter(m => m.role === 'assistant');

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

    const lastAssistant = stripNoise(
      assistantMessages[assistantMessages.length - 1]?.content || ''
    ).substring(0, 500);

    const decisions: string[] = [];
    const decisionPatterns = [
      /(?:decidimos|vamos a|prioridad|won'?t fix|fuera de scope|rebrand|npm|@ticoxz)/gi,
    ];
    for (const msg of messages) {
      const lines = msg.content.split('\n').filter(l => l.match(/^[-*]\s+|^\d+\./));
      lines.slice(0, 5).forEach(l => {
        const clean = stripNoise(l).substring(0, 120);
        if (clean.length > 20) decisions.push(clean);
      });
    }
    if (decisions.length === 0) {
      decisions.push('Relay: sync cifrado + HANDOFF.md + puente entre editores (Cursor/OpenCode/Antigravity).');
    }

    const editor =
      session.id.startsWith('cursor-') ? 'Cursor' :
      session.id.startsWith('antigravity-') ? 'Antigravity' : 'OpenCode';

    const summaryParts = [
      `Sesión **${editor}** con ${messages.length} mensajes.`,
      session.title ? `Título: ${session.title}.` : '',
      userSnippets.length ? `Temas recientes: ${userSnippets.map(s => s.substring(0, 80)).join(' → ')}` : '',
    ].filter(Boolean);

    const next_steps: string[] = [];
    if (lastAssistant) {
      next_steps.push(lastAssistant.substring(0, 300) + (lastAssistant.length > 300 ? '…' : ''));
    }
    next_steps.push(`Transcript completo: \`relay decrypt .ai-memory/sessions/session-${session.id}.summary.json.age\``);

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
