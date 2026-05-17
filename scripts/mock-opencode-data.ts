import fs from 'fs';
import path from 'path';
import os from 'os';

function generateMockData() {
  const homeDir = os.homedir();
  const baseDir = path.join(homeDir, '.local', 'share', 'opencode', 'storage', 'session');

  // Crear la ruta si no existe
  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
    console.log(`Creado directorio base: ${baseDir}`);
  }

  const mockSession = {
    id: 'long-session-456',
    createdAt: Date.now(),
    project: '/Users/marcelomiranda/Desktop/tupac',
    messages: [
      { role: 'user', content: 'Necesito implementar un sistema de roles', timestamp: Date.now() - 3600000 },
      { role: 'assistant', content: 'Podemos usar RBAC. ¿Cuántos roles hay?', timestamp: Date.now() - 3590000 },
      { role: 'user', content: 'Tres: admin, editor, viewer', timestamp: Date.now() - 3580000 },
      { role: 'assistant', content: 'Bien. Crearé un middleware de auth', timestamp: Date.now() - 3570000 },
      { role: 'user', content: 'Que el admin pueda hacer todo', timestamp: Date.now() - 3560000 },
      { role: 'assistant', content: 'Configurado. Editor puede editar', timestamp: Date.now() - 3550000 },
      { role: 'user', content: 'Viewer solo leer', timestamp: Date.now() - 3540000 },
      { role: 'assistant', content: 'Hecho. Modifiqué src/middleware/roles.ts', timestamp: Date.now() - 3530000 },
      { role: 'user', content: 'Añade también un superadmin', timestamp: Date.now() - 3520000 },
      { role: 'assistant', content: 'Añadido superadmin. Tiene override a true', timestamp: Date.now() - 3510000 },
      { role: 'user', content: 'Perfecto, commitea eso', timestamp: Date.now() - 3500000 },
      { role: 'assistant', content: 'Commit realizado con mensaje feat: add rbac roles', timestamp: Date.now() - 3490000 }
    ]
  };

  const filePath = path.join(baseDir, `session-${mockSession.id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(mockSession, null, 2), 'utf-8');
  
  console.log('✅ Datos simulados de OpenCode generados con éxito.');
  console.log(`Archivo creado en: ${filePath}`);
}

generateMockData();
