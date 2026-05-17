import { OpenCodeSession } from '../plugin/storage-reader';
import { SummarizedSession } from '../summarizer/types';

export class MergeEngine {
  /**
   * Toma dos sesiones, fusiona sus mensajes de forma cronológica eliminando duplicados.
   * Si una de las dos es un resumen, se priorizan los mensajes nuevos por encima de los viejos,
   * pero para simplificar, asumiremos que resolvemos conflictos a nivel de OpenCodeSession completo.
   */
  static mergeSessions(sessionA: OpenCodeSession, sessionB: OpenCodeSession): OpenCodeSession {
    if (sessionA.id !== sessionB.id) {
      throw new Error('No se pueden fusionar sesiones con distintos IDs');
    }

    const allMessages = [...sessionA.messages, ...sessionB.messages];

    // Eliminar duplicados usando JSON.stringify o el timestamp como llave única
    const uniqueMessagesMap = new Map();
    for (const msg of allMessages) {
      // Usamos el timestamp como identificador único para los mensajes en esta PoC
      // En producción, cada mensaje debería tener un ID UUID real.
      const key = msg.timestamp ? msg.timestamp.toString() : JSON.stringify(msg);
      if (!uniqueMessagesMap.has(key)) {
        uniqueMessagesMap.set(key, msg);
      }
    }

    // Convertir de nuevo a array y ordenar cronológicamente
    const mergedMessages = Array.from(uniqueMessagesMap.values()).sort((a, b) => {
      const timeA = a.timestamp || 0;
      const timeB = b.timestamp || 0;
      return timeA - timeB;
    });

    return {
      id: sessionA.id,
      createdAt: Math.min(sessionA.createdAt, sessionB.createdAt),
      project: sessionA.project || sessionB.project,
      messages: mergedMessages
    };
  }
}
