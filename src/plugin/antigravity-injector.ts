import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { OpenCodeSession } from './storage-reader';

export class AntigravityInjector {
  static async inject(session: OpenCodeSession): Promise<string> {
    const brainDir = path.join(os.homedir(), '.gemini', 'antigravity', 'brain');

    const conversationId = crypto.randomUUID();
    const convDir = path.join(brainDir, conversationId);
    const logDir = path.join(convDir, '.system_generated', 'logs');

    fs.mkdirSync(logDir, { recursive: true });
    fs.mkdirSync(path.join(convDir, '.system_generated', 'messages'), { recursive: true });

    const messages = session.messages.map((msg, index) => {
      const source = msg.role === 'user' ? 'USER_EXPLICIT' : 'MODEL';
      const type = msg.role === 'user' ? 'USER_INPUT' : 'PLANNER_RESPONSE';

      let content = msg.content;
      if (msg.role === 'user') {
        // Antigravity requiere el bloque <ADDITIONAL_METADATA> para parsear correctamente
        content = `<USER_REQUEST>\n${msg.content}\n</USER_REQUEST>\n<ADDITIONAL_METADATA>\nThe current local time is: ${new Date(msg.timestamp).toISOString()}.\n\nThe user's current state is as follows:\nNo browser pages are currently open.\n</ADDITIONAL_METADATA>`;
      } else if (index === 1 && session.messages[0].role === 'user') {
        // Insertamos el aviso de importación en la primera respuesta del modelo
        const notice = `⚠️ **Sesión Importada desde OpenCode**\nID Original: ${session.id}\nProyecto: ${session.project || 'Desconocido'}\n\n---\n\n`;
        content = notice + content;
      }

      const entry = {
        step_index: index * 5, // Empezamos en 0
        source,
        type,
        status: 'DONE',
        created_at: new Date(msg.timestamp).toISOString(),
        content: content
      };

      return JSON.stringify(entry);
    });

    const logContent = messages.join('\n');
    fs.writeFileSync(path.join(logDir, 'overview.txt'), logContent);

    this.createMarkdownFiles(session, convDir);
    this.createAnnotationFile(conversationId);
    // NOTE: No creamos .pb stub - Antigravity valida que existan y tienen formato encriptado
    // El archivo .pb real es de ~6MB encriptado, no podemos generarlo
    await this.registerInSqlite(conversationId, session);
    await this.updateTrajectorySummaries(conversationId, session);

    return conversationId;
  }

  private static createMarkdownFiles(session: OpenCodeSession, convDir: string): void {
    const messages = session.messages;
    const title = session.messages[0]?.content?.substring(0, 60) || 'Sesión importada';

    const sessionContent = [
      `# ${title}`,
      ``,
      `> Importado automáticamente desde OpenCode`,
      ``,
      `**Fecha:** ${new Date(session.createdAt).toLocaleString()}`,
      `**Mensajes:** ${messages.length}`,
      ``,
      `---`,
      ``,
      ...messages.map((msg, i) => {
        const role = msg.role === 'user' ? '## Usuario' : '## Asistente';
        const timestamp = new Date(msg.timestamp).toLocaleString();
        const content = msg.content.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return `${role} (${timestamp})\n\n${content}\n`;
      })
    ].join('\n');

    fs.writeFileSync(path.join(convDir, 'session.md'), sessionContent);

    const summaryContent = [
      `# Resumen: ${title}`,
      ``,
      `Esta sesión fue importada automáticamente desde OpenCode.`,
      ``,
      `**Total de mensajes:** ${messages.length}`,
      `**Iniciada:** ${new Date(session.createdAt).toLocaleString()}`,
      ``,
      messages.length > 0
        ? `## Primer mensaje del usuario\n\n${messages[0].content.substring(0, 200)}...\n`
        : '',
    ].join('\n');

    fs.writeFileSync(path.join(convDir, 'session_summary.md'), summaryContent);
  }

  private static createAnnotationFile(conversationId: string): void {
    const annotationsDir = path.join(os.homedir(), '.gemini', 'antigravity', 'annotations');
    if (!fs.existsSync(annotationsDir)) {
      fs.mkdirSync(annotationsDir, { recursive: true });
    }

    const annotationPath = path.join(annotationsDir, `${conversationId}.pbtxt`);
    const currentTime = Math.floor(Date.now() / 1000);
    const annotationContent = `last_user_view_time:{seconds:${currentTime}  nanos:0}`;

    fs.writeFileSync(annotationPath, annotationContent);
  }

  private static async registerInSqlite(conversationId: string, session: OpenCodeSession): Promise<void> {
    const homeDir = os.homedir();
    const globalDbPath = path.join(
      homeDir,
      'Library',
      'Application Support',
      'Antigravity',
      'User',
      'globalStorage',
      'state.vscdb'
    );

    const workspaceStorageDir = path.join(
      homeDir,
      'Library',
      'Application Support',
      'Antigravity',
      'User',
      'workspaceStorage'
    );

    // Intentar encontrar la DB del workspace específico
    let workspaceDbPath: string | null = null;
    if (fs.existsSync(workspaceStorageDir)) {
      const dirs = fs.readdirSync(workspaceStorageDir);
      for (const dir of dirs) {
        const wsJsonPath = path.join(workspaceStorageDir, dir, 'workspace.json');
        if (fs.existsSync(wsJsonPath)) {
          try {
            const wsJson = JSON.parse(fs.readFileSync(wsJsonPath, 'utf-8'));
            const projectUri = `file://${session.project}`;
            if (wsJson.folder === projectUri || wsJson.workspace === projectUri) {
              workspaceDbPath = path.join(workspaceStorageDir, dir, 'state.vscdb');
              break;
            }
          } catch (e) {}
        }
      }
    }

    const dbsToUpdate = [globalDbPath];
    if (workspaceDbPath && fs.existsSync(workspaceDbPath)) {
      dbsToUpdate.push(workspaceDbPath);
      console.log(`📂 Workspace DB detectada: ${workspaceDbPath}`);
    }

    const sqlite3 = require('sqlite3');

    for (const dbPath of dbsToUpdate) {
      if (!fs.existsSync(dbPath)) continue;

      const db = new sqlite3.Database(dbPath);
      const getQuery = (sql: string) => new Promise((resolve, reject) => {
        db.get(sql, [], (err: any, row: any) => err ? reject(err) : resolve(row));
      });
      const runQuery = (sql: string, params: any[]) => new Promise((resolve, reject) => {
        db.run(sql, params, (err: any) => err ? reject(err) : resolve(null));
      });

      try {
        console.log(`💾 Actualizando: ${path.basename(path.dirname(dbPath)) || 'globalStorage'}`);
        
        // 1. Actualizar Índice de Chats
        const row: any = await getQuery("SELECT value FROM ItemTable WHERE key = 'chat.ChatSessionStore.index'");
        let currentIndex = { version: 1, entries: {} as any };

        if (row && row.value) {
          try {
            currentIndex = JSON.parse(row.value);
          } catch (e) {}
        }

        currentIndex.entries[conversationId] = {
          id: conversationId,
          title: session.title || session.messages[0]?.content?.substring(0, 50) || 'Sesión importada',
          timestamp: Date.now(),
          preview: session.messages[1]?.content?.substring(0, 100) || ''
        };

        await runQuery(
          "INSERT OR REPLACE INTO ItemTable (key, value) VALUES ('chat.ChatSessionStore.index', ?)",
          [JSON.stringify(currentIndex)]
        );

        // 2. Historial (solo en Global DB)
        if (dbPath === globalDbPath) {
          const historyRow: any = await getQuery("SELECT value FROM ItemTable WHERE key = 'history.recentlyOpenedPathsList'");
          if (historyRow && historyRow.value) {
            const history = JSON.parse(historyRow.value);
            const newEntry = {
              fileUri: `file://${os.homedir()}/.gemini/antigravity/brain/${conversationId}/session.md`,
              label: `OpenCode: ${session.messages[0]?.content?.substring(0, 50) || 'Sesión importada'}`
            };
            if (!history.entries) history.entries = [];
            history.entries.unshift(newEntry);
            if (history.entries.length > 20) history.entries = history.entries.slice(0, 20);
            await runQuery("UPDATE ItemTable SET value = ? WHERE key = 'history.recentlyOpenedPathsList'", [JSON.stringify(history)]);
          }
        }

        await new Promise((resolve) => db.close(resolve));
        console.log(`✅ DB actualizada exitosamente`);
      } catch (error: any) {
        console.error(`❌ Error actualizando ${dbPath}:`, error.message);
        db.close();
      }
    }
  }

  private static async updateTrajectorySummaries(conversationId: string, session: OpenCodeSession): Promise<void> {
    const homeDir = os.homedir();
    const globalDbPath = path.join(
      homeDir,
      'Library',
      'Application Support',
      'Antigravity',
      'User',
      'globalStorage',
      'state.vscdb'
    );

    if (!fs.existsSync(globalDbPath)) {
      console.log(`⚠️ No se encontró state.vscdb en ${globalDbPath}`);
      return;
    }

    const sqlite3 = require('sqlite3');
    const db = new sqlite3.Database(globalDbPath);

    const getQuery = (sql: string) => new Promise<any>((resolve, reject) => {
      db.get(sql, [], (err: any, row: any) => err ? reject(err) : resolve(row));
    });

    const runQuery = (sql: string, params: any[]) => new Promise((resolve, reject) => {
      db.run(sql, params, (err: any) => err ? reject(err) : resolve(null));
    });

    try {
      console.log(`🔄 Actualizando trajectorySummaries...`);

      const row: any = await getQuery("SELECT value FROM ItemTable WHERE key = 'antigravityUnifiedStateSync.trajectorySummaries'");
      if (!row || !row.value) {
        console.log(`⚠️ No se encontró trajectorySummaries en la DB`);
        await new Promise((resolve) => db.close(resolve));
        return;
      }

      const decoded = Buffer.from(row.value, 'base64');

      // Crear la nueva entrada para trajectorySummaries
      const newEntry = this.createTrajectoryEntry(
        conversationId,
        session.messages[1]?.content?.substring(0, 150) || 'Sesión importada desde OpenCode'
      );

      // Append al final del protobuf
      const newDecoded = Buffer.concat([decoded, newEntry]);
      const newB64 = newDecoded.toString('base64');

      await runQuery(
        "UPDATE ItemTable SET value = ? WHERE key = 'antigravityUnifiedStateSync.trajectorySummaries'",
        [newB64]
      );

      await new Promise((resolve) => db.close(resolve));
      console.log(`✅ trajectorySummaries actualizado`);
    } catch (error: any) {
      console.error(`❌ Error actualizando trajectorySummaries:`, error.message);
      db.close();
    }
  }

  private static createTrajectoryEntry(uuid: string, summaryText: string): Buffer {
    // Helper para escribir varint
    const writeVarint = (value: number): Buffer => {
      const result: number[] = [];
      while (value > 0x7F) {
        result.push((value & 0x7F) | 0x80);
        value >>= 7;
      }
      result.push(value & 0x7F);
      return Buffer.from(result);
    };

    // Crear el protobuf interno con el summary
    // Estructura: field1 (tag 0x0a) = summary text
    const summaryBytes = Buffer.from(summaryText, 'utf-8');
    const innerProtobuf = Buffer.concat([
      Buffer.from([0x0a]),
      writeVarint(summaryBytes.length),
      summaryBytes
    ]);

    // Base64 encode del inner protobuf
    const b64Encoded = innerProtobuf.toString('base64');
    const b64Bytes = Buffer.from(b64Encoded, 'ascii');

    // Outer structure: field1 (tag 0x0a) = base64 string
    const outerProtobuf = Buffer.concat([
      Buffer.from([0x0a]),
      writeVarint(b64Bytes.length),
      b64Bytes
    ]);

    // Entry completa: field1 (UUID) + field2 (summary protobuf)
    const uuidBytes = Buffer.from(uuid, 'utf-8');
    const field1 = Buffer.concat([
      Buffer.from([0x0a]),
      writeVarint(uuidBytes.length),
      uuidBytes
    ]);

    const field2 = Buffer.concat([
      Buffer.from([0x12]),
      writeVarint(outerProtobuf.length),
      outerProtobuf
    ]);

    return Buffer.concat([field1, field2]);
  }
}
