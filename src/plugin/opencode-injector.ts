import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import { OpenCodeSession } from './storage-reader';

const generateOpenCodeId = (prefix: string, timeMs?: number) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = prefix + '_';
  
  if (timeMs) {
    // Para asegurar el ordenamiento cronológico (K-sortable) en el UI de OpenCode
    // Usamos el timestamp en hexadecimal con padding (11 chars) + '001' + 12 chars aleatorios = 26 chars
    const timeHex = timeMs.toString(16).padStart(11, '0');
    result += timeHex + '001';
    for (let i = 0; i < 12; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  } else {
    for (let i = 0; i < 26; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  }
  
  return result;
};

export class OpenCodeInjector {
  static injectSession(session: OpenCodeSession): string {
    const sessionId = generateOpenCodeId('ses', session.createdAt);
    const msgIds = session.messages.map(() => generateOpenCodeId('msg'));

    const nativeFormat = {
      info: {
        id: sessionId,
        slug: "injected-session",
        projectID: "global",
        directory: session.project || process.cwd(),
        title: "Sincronizado desde " + (session.id.includes('antigravity') ? 'Antigravity' : 'ContextVC'),
        version: "1.0.0",
        summary: { additions: 0, deletions: 0, files: 0 },
        cost: 0,
        tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
        time: { created: session.createdAt, updated: Date.now() }
      },
      messages: (() => {
        let lastUserMsgId: string | undefined = undefined;
        let baseTime = session.createdAt - (session.messages.length * 1000); // Empezamos un poco antes para mantener todo en el pasado
        return session.messages.map((msg, index) => {
          baseTime += 1000; // Incremento estricto de 1 segundo por mensaje
          const msgId = generateOpenCodeId('msg', baseTime);
          
          if (msg.role === 'user') {
            lastUserMsgId = msgId;
          }
          const parentId = msg.role === 'assistant' ? lastUserMsgId : undefined;
          
          let infoData: any = {
            id: msgId,
            role: msg.role,
            time: { created: baseTime },
            agent: "build",
            sessionID: sessionId
          };
          
          if (msg.role === 'assistant') {
            infoData.time.completed = baseTime + 500;
          }
          
          if (parentId) {
            infoData.parentID = parentId;
          }

        if (msg.role === 'user') {
          infoData.model = { providerID: "minimax", modelID: "MiniMax-M2.7" };
          infoData.summary = { diffs: [] };
        } else {
          infoData.providerID = "minimax";
          infoData.modelID = "MiniMax-M2.7";
          infoData.mode = "build";
          infoData.finish = "stop";
          infoData.path = { cwd: process.cwd(), root: "/" };
          infoData.cost = 0;
          infoData.tokens = { total: 0, input: 0, output: 0, reasoning: 0, cache: { write: 0, read: 0 } };
        }

        let parts: any[] = [];
        
        if (msg.role === 'user') {
          parts = [
            {
              type: "text",
              text: msg.content,
              id: generateOpenCodeId('prt', baseTime),
              sessionID: infoData.sessionID,
              messageID: msgId
            }
          ];
        } else {
          const partTime = { start: infoData.time.created, end: infoData.time.completed };
          parts = [
            {
              type: "step-start",
              id: generateOpenCodeId('prt', baseTime),
              sessionID: infoData.sessionID,
              messageID: msgId
            },
            {
              type: "text",
              text: msg.content,
              time: partTime,
              id: generateOpenCodeId('prt', baseTime),
              sessionID: infoData.sessionID,
              messageID: msgId
            },
            {
              reason: "stop",
              type: "step-finish",
              tokens: infoData.tokens,
              cost: infoData.cost,
              id: generateOpenCodeId('prt', baseTime),
              sessionID: infoData.sessionID,
              messageID: msgId
            }
          ];
        }

        return {
          info: infoData,
          parts: parts
        };
        });
      })()
    };

    const tempDir = os.tmpdir();
    const filePath = path.join(tempDir, `import-${nativeFormat.info.id}.json`);
    
    fs.writeFileSync(filePath, JSON.stringify(nativeFormat, null, 2), 'utf-8');

    execSync(`opencode import "${filePath}"`, { stdio: 'inherit' });

    return filePath;
  }
}


