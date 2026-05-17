"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
function generateMockData() {
    const homeDir = os_1.default.homedir();
    const baseDir = path_1.default.join(homeDir, '.local', 'share', 'opencode', 'storage', 'session');
    // Crear la ruta si no existe
    if (!fs_1.default.existsSync(baseDir)) {
        fs_1.default.mkdirSync(baseDir, { recursive: true });
        console.log(`Creado directorio base: ${baseDir}`);
    }
    const mockSession = {
        id: 'abc-123-def',
        createdAt: Date.now(),
        project: '/Users/marcelomiranda/Desktop/tupac',
        messages: [
            {
                role: 'user',
                content: 'Necesito refactorizar la autenticación para incluir 2FA',
                timestamp: Date.now() - 3600000
            },
            {
                role: 'assistant',
                content: 'Entendido. Para implementar 2FA en esta arquitectura, usaremos TOTP. Modificaremos src/auth/login.ts',
                timestamp: Date.now() - 3590000,
                toolCalls: [
                    { name: 'view_file', args: { path: 'src/auth/login.ts' } }
                ]
            }
        ]
    };
    const filePath = path_1.default.join(baseDir, `session-${mockSession.id}.json`);
    fs_1.default.writeFileSync(filePath, JSON.stringify(mockSession, null, 2), 'utf-8');
    console.log('✅ Datos simulados de OpenCode generados con éxito.');
    console.log(`Archivo creado en: ${filePath}`);
}
generateMockData();
