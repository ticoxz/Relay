import fs from 'fs';
import path from 'path';
import os from 'os';

export interface OpenCodeMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  id?: string;
  parentID?: string;
  parts?: any[]; // Para guardar el formato nativo si existe
}

export interface OpenCodeSession {
  id: string;
  createdAt: number;
  project: string;
  messages: OpenCodeMessage[];
  title?: string;
  nativeData?: any; // Para guardar el blob original si es necesario
}

/**
 * Lee los archivos JSON del directorio de storage local de OpenCode.
 * Simulamos que el editor guarda sus cosas en ~/.local/share/opencode/storage/session/
 */
export async function readOpenCodeSessions(): Promise<OpenCodeSession[]> {
  const homeDir = os.homedir();
  const storageDir = path.join(homeDir, '.local', 'share', 'opencode', 'storage', 'session');
  const fsSessions: OpenCodeSession[] = [];

  if (fs.existsSync(storageDir)) {
    const files = fs.readdirSync(storageDir).filter(f => f.endsWith('.json'));
    for (const file of files) {
      const filePath = path.join(storageDir, file);
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const raw = JSON.parse(content);
        
        let session: OpenCodeSession;
        
        // Detectar formato nativo (anidado) o plano
        if (raw.info && raw.messages && raw.messages[0]?.parts) {
          // Transformar de nativo a plano
          session = {
            id: raw.info.id,
            createdAt: raw.info.time.created,
            project: raw.info.directory || process.cwd(),
            title: raw.info.title,
            messages: raw.messages.map((m: any) => ({
              role: m.info.role,
              content: m.parts.map((p: any) => p.text || '').join('\n').trim(),
              timestamp: m.info.time.created,
              id: m.info.id,
              parentID: m.info.parentID,
              parts: m.parts
            }))
          };
        } else {
          // Formato plano (nuestro mock inicial o sesiones ya procesadas)
          session = raw as OpenCodeSession;
        }
        
        fsSessions.push(session);
      } catch (error) {
        console.warn(`Advertencia: No se pudo leer o parsear la sesión ${file}`);
      }
    }
  }

  // Leer también de la base de datos opencode.db si existe
  const dbSessions = await readSessionsFromOpencodeDb();

  // Combinar y eliminar duplicados basándonos en session.id
  const allSessionsMap = new Map<string, OpenCodeSession>();
  for (const s of fsSessions) {
    allSessionsMap.set(s.id, s);
  }
  for (const s of dbSessions) {
    allSessionsMap.set(s.id, s);
  }

  const sessions = Array.from(allSessionsMap.values());
  
  // Ordenar cronológicamente para que la sesión más reciente sea la última
  sessions.sort((a, b) => a.createdAt - b.createdAt);

  return sessions;
}

async function readSessionsFromOpencodeDb(): Promise<OpenCodeSession[]> {
  const homeDir = os.homedir();
  const dbPath = path.join(homeDir, '.local', 'share', 'opencode', 'opencode.db');

  if (!fs.existsSync(dbPath)) {
    return [];
  }

  try {
    const sqlite3 = require('sqlite3');
    const db = new sqlite3.Database(dbPath);

    const getQuery = (sql: string, params: any[] = []): Promise<any[]> => new Promise((resolve, reject) => {
      db.all(sql, params, (err: Error | null, rows: any[]) => err ? reject(err) : resolve(rows));
    });

    const sessionsRows = await getQuery("SELECT id, title, directory, time_created FROM session;");
    const sessions: OpenCodeSession[] = [];

    for (const sRow of sessionsRows) {
      const messageRows = await getQuery(
        "SELECT id, time_created, data FROM message WHERE session_id = ? ORDER BY time_created ASC;",
        [sRow.id]
      );

      const partRows = await getQuery(
        "SELECT id, message_id, time_created, data FROM part WHERE session_id = ? ORDER BY time_created ASC;",
        [sRow.id]
      );

      // Group parts by message_id
      const partsByMessageId = new Map<string, any[]>();
      for (const pRow of partRows) {
        let pData: any = {};
        try {
          pData = JSON.parse(pRow.data);
        } catch (e) {}

        if (!partsByMessageId.has(pRow.message_id)) {
          partsByMessageId.set(pRow.message_id, []);
        }
        partsByMessageId.get(pRow.message_id)!.push({
          id: pRow.id,
          type: pData.type,
          text: pData.text,
          raw: pData
        });
      }

      // Reconstruct messages
      const messages: OpenCodeMessage[] = [];
      for (const mRow of messageRows) {
        let mData: any = {};
        try {
          mData = JSON.parse(mRow.data);
        } catch (e) {}

        const msgParts = partsByMessageId.get(mRow.id) || [];
        const content = msgParts
          .filter(p => p.text !== undefined)
          .map(p => p.text)
          .join('\n')
          .trim();

        messages.push({
          role: mData.role || 'user',
          content: content,
          timestamp: mRow.time_created,
          id: mRow.id,
          parentID: mData.parentID,
          parts: msgParts.map(p => p.raw)
        });
      }

      sessions.push({
        id: sRow.id,
        createdAt: sRow.time_created,
        project: sRow.directory || process.cwd(),
        title: sRow.title || 'Sesión de OpenCode',
        messages: messages
      });
    }

    await new Promise((resolve) => db.close(resolve));
    return sessions;
  } catch (error) {
    console.warn('Advertencia: No se pudo leer las sesiones de opencode.db:', error);
    return [];
  }
}
