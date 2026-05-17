import { OpenAI } from 'openai';
import { OpenCodeSession } from '../plugin/storage-reader';
import { ProcessedSession, SummarizedSession } from './types';
import dotenv from 'dotenv';

dotenv.config();

// Threshold: Resumir si hay más de 10 mensajes o el JSON supera los 100KB aprox
const MESSAGE_THRESHOLD = 10;
const SIZE_THRESHOLD_BYTES = 100 * 1024;

export class SummarizerEngine {
  private openai: OpenAI | null = null;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
    }
  }

  private shouldSummarize(session: OpenCodeSession): boolean {
    if (session.messages.length > MESSAGE_THRESHOLD) return true;
    
    const size = Buffer.byteLength(JSON.stringify(session), 'utf8');
    if (size > SIZE_THRESHOLD_BYTES) return true;

    return false;
  }

  async process(session: OpenCodeSession): Promise<ProcessedSession> {
    if (!this.shouldSummarize(session)) {
      return session; // Retorna original si no pasa el threshold
    }

    if (!this.openai) {
      console.warn(`⚠️  La sesión ${session.id} es muy larga, pero no hay OPENAI_API_KEY. Se guardará completa.`);
      return session;
    }

    console.log(`🤖 La sesión ${session.id} ha superado los límites. Generando resumen con IA...`);

    try {
      const prompt = `
Eres un experto desarrollador de software. Analiza el siguiente historial de chat entre un programador y una IA.
Extrae la información clave para que otro desarrollador pueda continuar el trabajo mañana sin leer todo el chat.
Devuelve un JSON estrictamente con este formato:
{
  "summary": "Resumen ejecutivo de 3 líneas sobre qué se intentaba lograr y qué se logró.",
  "decisions": ["Decisión arquitectónica 1", "Por qué no usamos X"],
  "key_files": ["src/archivo1.ts", "components/Boton.tsx"],
  "next_steps": ["Falta implementar validación de email", "Revisar tests de auth"]
}

Historial de chat a resumir:
${JSON.stringify(session.messages.map((m: any) => ({ role: m.role, content: m.content })))}
      `;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' }
      });

      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error('No se recibió respuesta del LLM');

      const parsedContent = JSON.parse(content);

      const summarized: SummarizedSession = {
        id: session.id,
        originalCreatedAt: session.createdAt,
        summarizedAt: Date.now(),
        project: session.project,
        isSummary: true,
        content: parsedContent
      };

      return summarized;
    } catch (error: any) {
      console.error(`❌ Falló la summarización de la sesión ${session.id}:`, error.message);
      console.log('Guardando versión completa como fallback.');
      return session;
    }
  }
}
