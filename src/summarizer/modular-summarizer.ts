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
    // Implementación de resumen local (sin LLM)
    const messages = session.messages;
    const userMessages = messages.filter(m => m.role === 'user');
    const assistantMessages = messages.filter(m => m.role === 'assistant');

    // Extraer archivos mencionados (heurística simple)
    const fileMentions = new Set<string>();
    const allText = messages.map(m => m.content).join(' ');
    const filePattern = /\b([\w\/]+\.(?:ts|js|tsx|jsx|py|go|rs|java|md))\b/g;
    let match;
    while ((match = filePattern.exec(allText)) !== null) {
      fileMentions.add(match[1]);
    }

    // Primeros mensajes como resumen
    const firstUser = userMessages[0]?.content.substring(0, 200) || '';
    const lastAssistant = assistantMessages[assistantMessages.length - 1]?.content.substring(0, 200) || '';

    return {
      id: session.id,
      originalCreatedAt: session.createdAt,
      summarizedAt: Date.now(),
      project: session.project,
      isSummary: true,
      content: {
        summary: `Sesión de ${messages.length} mensajes. ${firstUser}...`,
        decisions: ['Resumen generado localmente (sin LLM)'],
        key_files: Array.from(fileMentions).slice(0, 10),
        next_steps: lastAssistant ? [`Última respuesta: ${lastAssistant}...`] : ['Ver sesión completa'],
      },
    };
  }
}
