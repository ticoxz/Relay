import fs from 'fs';
import path from 'path';
import { AgeEncryption } from '../src/encryption/age';

const memoryDir = path.join(process.cwd(), '.ai-memory', 'sessions');
if (!fs.existsSync(memoryDir)) fs.mkdirSync(memoryDir, { recursive: true });

const baseTime = Date.now() - 100000;

// Versión Nuestra (Añadimos un mensaje)
const oursSession = {
  id: 'conflict-test',
  createdAt: baseTime,
  project: '/Users/marcelomiranda/Desktop/tupac',
  messages: [
    { role: 'user', content: '¿Cómo hacemos el setup de Docker?', timestamp: baseTime },
    { role: 'assistant', content: 'Crearé un docker-compose.yml', timestamp: baseTime + 1000 },
    { role: 'user', content: '[OURS] Asegúrate de exponer el puerto 8080', timestamp: baseTime + 2000 }
  ]
};

// Versión de Ellos (Añadieron otro mensaje concurrentemente)
const theirsSession = {
  id: 'conflict-test',
  createdAt: baseTime,
  project: '/Users/marcelomiranda/Desktop/tupac',
  messages: [
    { role: 'user', content: '¿Cómo hacemos el setup de Docker?', timestamp: baseTime },
    { role: 'assistant', content: 'Crearé un docker-compose.yml', timestamp: baseTime + 1000 },
    { role: 'user', content: '[THEIRS] Usa la imagen de node:18-alpine', timestamp: baseTime + 1500 }
  ]
};

const oursPath = path.join(memoryDir, 'ours.age');
const theirsPath = path.join(memoryDir, 'theirs.age');

console.log('Generando archivos de conflicto encriptados...');
AgeEncryption.encrypt(JSON.stringify(oursSession), oursPath);
AgeEncryption.encrypt(JSON.stringify(theirsSession), theirsPath);

console.log('Archivos generados:');
console.log(`- ${oursPath}`);
console.log(`- ${theirsPath}`);
console.log('\nPrueba la resolución de conflictos con:');
console.log('node dist/cli/index.js merge .ai-memory/sessions/ours.age .ai-memory/sessions/theirs.age .ai-memory/sessions/resolved.age');
