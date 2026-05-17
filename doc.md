# Context Version Control — Documentación Técnica Completa

> **Tagline:** *GitHub sincroniza tu código; nosotros sincronizamos el razonamiento de la IA que lo escribió.*

---

## 1. El Problema que Resolvemos

Cuando codeas con un asistente de IA (OpenCode, Cursor, Antigravity, Copilot), construyes un contexto valioso a lo largo de horas de conversación: decisiones arquitectónicas, el "por qué" de cada elección, trade-offs discutidos, archivos editados y el estado mental del problema.

**El problema:** Ese contexto vive en archivos locales ocultos del editor. Si cambias de máquina, cerrás el editor, o le pasás el ticket a un compañero, todo eso se pierde. Tu compañero no sabe en qué estabas, qué se decidió, ni por dónde seguir.

**La solución:** `contextvc` extrae ese historial, lo comprime (summarizer local u OpenAI), lo encripta con las SSH keys del equipo, y lo sincroniza a través de Git. Tu compañero hace `git pull`, lee `.ai-memory/HANDOFF.md` y puede continuar exactamente donde vos dejaste.

**No es lo mismo que `context.md`:** ese archivo define el proyecto; Tupac preserva la *sesión* de IA (decisiones del chat, no solo convenciones estáticas).

---

## 2. Arquitectura General

```
┌─────────────────────────────────────────────────────────────────────┐
│                         EDITOR DE IA                                │
│              (OpenCode, Antigravity, Cursor, etc.)                  │
│                                                                      │
│   El usuario codea con el asistente. Sesiones guardadas en:          │
│   ~/.local/share/opencode/storage/  (OpenCode)                     │
│   ~/.gemini/antigravity/brain/      (Antigravity)                   │
└────────────────────────────┬───────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      PLUGIN / READER                                │
│                                                                      │
│   Detecta cambios en el storage del editor.                         │
│   Convierte sesiones al formato estándar de contextvc:               │
│   { id, timestamp, messages[], metadata }                           │
│                                                                      │
│   Implementaciones existentes:                                       │
│   ├── opencode-injector.ts    (OpenCode)                           │
│   ├── antigravity-reader.ts   (Antigravity) ← Reader completo      │
│   └── storage-reader.ts       (base abstract)                      │
└────────────────────────────┬───────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    SUMARIZADOR INTELIGENTE                           │
│                                                                      │
│   Detecta sesiones > 10 mensajes o muy pesadas                        │
│   Envía el contenido a OpenAI para resumir                           │
│                                                                      │
│   Output: { summary, decisions[], key_files[], next_steps }          │
│   Sesiones de 2MB → resúmenes de ~5KB                              │
│                                                                      │
│   Archivo: src/summarizer/engine.ts                                 │
└────────────────────────────┬───────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    CAPA DE ENCRYPTION                               │
│                                                                      │
│   Usa `age` con SSH keys existentes del equipo                     │
│   Flujo: archivo.json → age -r "ssh-key" → archivo.json.age       │
│                                                                      │
│   Cada miembro del equipo puede desencriptar con su propia SSH key │
│  Nadie sin accesso al repo + SSH key puede leer los chats         │
│                                                                      │
│   Archivo: src/encryption/age.ts                                    │
└────────────────────────────┬───────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      GIT HOOKS AUTOMÁTICOS                           │
│                                                                      │
│   Hook pre-commit instalado en .git/hooks/                          │
│   Se ejecuta automáticamente en cada `git commit`                   │
│                                                                      │
 │   Flujo silencioso:                                                │
 │   1. Detecta evento pre-commit                                     │
 │   2. Corre `contextvc sync` en modo automático                    │
 │   3. Extrae sesiones, resume, encripta                             │
 │   4. Hace `git add` de los archivos .age                          │
 │   5. Continúa con el commit normal                                │
│                                                                      │
│   El desarrollador NO nota que existe. Git hace su trabajo.        │
│                                                                      │
│   Archivo: src/hooks/installer.ts                                  │
└────────────────────────────┬───────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       GITHUB REPO                                    │
│                                                                      │
│   Estructura en el repo:                                            │
│   ├── .ai-memory/                                                  │
│   │   ├── sessions/           ← chats encriptados (.json.age)      │
│   │   ├── summaries/          ← versiones resumidas                 │
│   │   │   └── session-xyz.summary.json.age                         │
│   │   └── recipients.txt       ← llaves SSH autorizadas            │
│   ├── .git/hooks/                                                    │
│   └── .gitattributes           ← filters de encryption             │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Sistema de Migración entre Editores (Puerto Rico)

El feature de portabilidad permite migrate sesiones de un editor a otro.

### Formato Estándar de Sesión

```json
{
  "id": "session-abc-123",
  "source": "opencode",
  "timestamp": "2026-05-14T10:30:00Z",
  "messages": [
    { "role": "user", "content": "...", "timestamp": "..." },
    { "role": "assistant", "content": "...", "timestamp": "..." }
  ],
  "metadata": {
    "edited_files": ["src/auth/validator.ts"],
    "decisions": ["Usar strategy pattern para gateways"],
    "next_steps": ["Implementar PaymentGateway interface"]
  }
}
```

### Flujo de Migración

```
OpenCode ──► inject opencode antigravity ──► Antigravity
              │
              ├── Crea carpeta en ~/.gemini/antigravity/brain/<uuid>/
              ├── Crea .system_generated/logs/overview.txt (NDJSON)
              ├── Crea session.md (contenido completo en markdown)
              ├── Crea session_summary.md
              ├── Crea annotation file (.pbtxt)
              └── Registra en SQLite (state.vscdb)
```

---

## 4. Fases de Implementación Completadas

### Fase 1: Proof of Concept ✅
**Objetivo:** Crear el pipeline básico lectura → archivo → repo.

- CLI con comandos `init`, `sync`, `status`, `log`, `decrypt`
- Reader que detecta sesiones en `~/.local/share/opencode/storage/`
- Escritura de archivos a `.ai-memory/sessions/`

**Archivos creados:**
```
src/cli/index.ts
src/cli/commands/init.ts
src/cli/commands/sync.ts
src/cli/commands/decrypt.ts
scripts/mock-opencode-data.ts
```

### Fase 2: Encryption con Age ✅
**Objetivo:** Encriptar los archivos para que solo el equipo pueda leerlos.

- Instalación de `age` (via Homebrew)
- Generación de SSH key ED25519
- Encriptación con `age -r` y desencriptación con `age -d`
- Extensión `.json.age` para archivos encriptados

**Archivos creados:**
```
src/encryption/age.ts
src/cli/commands/team.ts
.ai-memory/recipients.txt
```

### Fase 3: Smart Pruning (Summarizer) ✅
**Objetivo:** Comprimir sesiones largas con LLMs para no inflar el repo.

- Integración con SDK de OpenAI
- `SummarizerEngine` que detecta sesiones > 10 mensajes
- Output: JSON de ~5KB en vez de MBs

**Archivos creados:**
```
src/summarizer/engine.ts
src/summarizer/types.ts
```

### Fase 4: Conflict Resolution ✅
**Objetivo:** Resolver choques cuando dos devs editan la misma sesión.

- `contextvc merge <ours.age> <theirs.age>` intelligent merge
- Desencripta ambas versiones, fusiona mensajes cronológicamente

**Archivos creados:**
```
src/sync/merge.ts
src/cli/commands/merge.ts
```

### Fase 5: Git Hooks Automatizados ✅
**Objetivo:** Fricción cero.

- Comando `contextvc install-hooks`
- Genera script `.git/hooks/pre-commit`
- Hook ejecuta `contextvc sync` automáticamente

**Archivos creados:**
```
src/hooks/installer.ts
src/cli/commands/install-hooks.ts
.git/hooks/pre-commit
```

### Fase 6: Migración OpenCode ↔ Antigravity ⚠️ PARCIAL
**Objetivo:** Llevar sesiones de un editor a otro.

- Comando `inject <source> <target>` implementado
- Crea estructura completa de archivos en Antigravity
- Crea annotation file
- Actualiza SQLite (chat index y history)

**AVISO:** Las sesiones injectadas se crean correctamente en el filesystem (brain folder, session.md, annotations) pero Antigravity no las muestra en su lista de conversaciones. Esto se debe a que Antigravity usa un formato protobuf encriptado propietario para su índice de conversaciones (`jetskiStateSync.agentManagerInitState`) que no pudimos decodificar completamente.

**Lo que SÍ funciona:**
- ✅ La carpeta en `~/.gemini/antigravity/brain/<uuid>/` se crea
- ✅ El archivo `session.md` con el contenido completo
- ✅ El archivo `session_summary.md`
- ✅ El archivo `.system_generated/logs/overview.txt`
- ✅ El annotation file en `~/.gemini/antigravity/annotations/`
- ✅ CLI de contextvc para migrate sesiones

**Lo que NO funciona:**
- ❌ La sesión no aparece en la lista de Antigravity
- ❌ El índice de conversaciones (`chat.ChatSessionStore.index`) no se actualiza correctamente
- ❌ El `jetskiStateSync` (formato protobuf encriptado) no se puede modificar

**Archivos creados:**
```
src/cli/commands/inject.ts
src/plugin/antigravity-injector.ts
src/plugin/antigravity-reader.ts
src/plugin/opencode-injector.ts
```

---

## 4.5. Mejoras de Experiencia de Usuario (Fase 7) ✅

**Objetivo:** Reducir fricción, hacerlo "idiot-proof", y robusta para equipos.

### Sistema de Configuración Automático ✅
- Archivo `.ai-memory/config.json` con todas las preferencias
- No más variables de entorno dispersas
- `ConfigManager` con init/load/update

### Wizard Interactivo en `init` ✅
- Pregunta si desea encriptar (recomendado)
- Pregunta si tiene OpenAI API Key (opcional)
- Selector de método de resumen: local (gratis) | openai | none
- Modo `--yes` para CI/CD

### Feedback Visual con Logger ✅
- Colores con chalk para cada tipo de mensaje
- Métodos: `success`, `error`, `warn`, `info`, `step`, `divider`
- Modo `quiet` para git hooks

### Summarizer Modular (multi-backend) ✅
- **`local`:** Resumen heurístico gratuito (sin LLM externo)
- **`openai`:** Resumen con GPT-4o-mini (costo por uso)
- **`none`:** Guardar sesiones completas sin resumir
- Fallback automático: si OpenAI falla, usa resumen local

### Backups Automáticos ✅
- `BackupManager.createBackup()` antes de tocar archivos críticos
- Backups en `.ai-memory/.backups/`
- Restauración ante fallos

### Escritura Transaccional ✅
- Archivos se escriben a `.tmp` primero
- `fs.renameSync()` atómico para evitar archivos corruptos
- Cleanup automático en caso de error

### Tests Unitarios ✅
- Jest configurado (`jest.config.js`)
- Tests para: `ConfigManager`, `Logger`, `BackupManager`
- 17 tests pasando

**Archivos creados:**
```
src/core/config.ts              # Gestor de configuración
src/core/logger.ts             # Logger con chalk
src/core/backup.ts             # Sistema de backups
src/summarizer/modular-summarizer.ts  # Summarizer multi-backend
src/cli/commands/status.ts     # Dashboard CLI
tests/config.test.ts
tests/logger.test.ts
tests/backup.test.ts
jest.config.js
```

---

## 5. Estructura Actual del Proyecto

```
tupac/
├── doc.md                          # Este documento
├── README.md                       # Documentación de uso
├── package.json                    # contextvc@1.0.0
├── tsconfig.json
├── jest.config.js                   # Configuración de tests
├── src/
│   ├── cli/
│   │   ├── index.ts                # Entry point CLI
│   │   └── commands/
│   │       ├── init.ts             # npx contextvc init (wizard interactivo)
│   │       ├── sync.ts             # npx contextvc sync
│   │       ├── decrypt.ts          # npx contextvc decrypt <file>
│   │       ├── merge.ts            # npx contextvc merge <a> <b> <r>
│   │       ├── team.ts             # npx contextvc team add/auto-add/list
│   │       ├── status.ts           # npx contextvc status
│   │       ├── install-hooks.ts    # npx contextvc install-hooks
│   │       └── inject.ts           # npx contextvc inject <source> <target>
│   ├── core/
│   │   ├── config.ts               # Gestor de configuración (config.json)
│   │   ├── logger.ts               # Logger con feedback visual (chalk)
│   │   └── backup.ts               # Sistema de backups automáticos
│   ├── summarizer/
│   │   ├── engine.ts               # OpenAI summarization
│   │   ├── modular-summarizer.ts   # Summarizer multi-backend (OpenAI/local/none)
│   │   └── types.ts
│   ├── encryption/
│   │   └── age.ts                  # age encrypt/decrypt wrappers + auto-detección SSH
│   ├── sync/
│   │   ├── merge.ts               # Intelligent merge de sesiones
│   │   └── writer.ts              # Escritura transaccional con atomic rename
│   ├── hooks/
│   │   └── installer.ts           # Instala pre-commit hook
│   └── plugin/
│       ├── opencode-injector.ts    # Reader para OpenCode
│       ├── antigravity-reader.ts   # Reader para Antigravity
│       ├── antigravity-injector.ts # Writer/injector para Antigravity
│       └── storage-reader.ts       # Base abstracta
├── scripts/
│   ├── mock-opencode-data.ts       # Simula sesiones de OpenCode
│   └── mock-conflict.ts            # Simula conflicto de merge
├── tests/                          # Suite de tests Jest
│   ├── config.test.ts
│   ├── logger.test.ts
│   └── backup.test.ts
└── .ai-memory/                     # Carpeta de datos (en repo)
    ├── config.json                  # Configuración del proyecto
    ├── sessions/
    │   ├── session-abc-123-def.json.age
    │   └── ...
    ├── summaries/
    │   └── ...
    ├── recipients.txt              # SSH keys autorizadas
    └── .backups/                  # Backups de archivos críticos
```

---

## 6. Comandos Disponibles (CLI)

```bash
# Inicializar el proyecto (wizard interactivo)
npx contextvc init
npx contextvc init --yes          # Modo automático con defaults

# Sincronizar sesiones locales → repo
npx contextvc sync

# Ver estado actual (dashboard CLI)
npx contextvc status
npx contextvc status --json       # Formato JSON

# Ver historial de sesiones
npx contextvc log

# Desencriptar y leer un archivo
npx contextvc decrypt .ai-memory/sessions/session-xyz.json.age

# Resolver conflicto de merge
npx contextvc merge .ai-memory/sessions/ours.age .ai-memory/sessions/theirs.age .ai-memory/sessions/resolved.age

# Gestión de equipo
npx contextvc team add "ssh-ed25519 AAAAC3...tu-llave@equipo"   # Añadir llave manual
npx contextvc team auto-add                                          # Detectar y añadir SSH keys automáticamente
npx contextvc team list                                              # Ver destinatarios autorizados

# Instalar Git hooks (auto-sync en cada commit)
npx contextvc install-hooks

# Migrar sesión de un editor a otro
npx contextvc inject opencode antigravity   # OpenCode → Antigravity
npx contextvc inject antigravity opencode   # Antigravity → OpenCode

# Pull sesiones de un editor específico
npx contextvc pull              # Ambos editores
npx contextvc pull antigravity   # Solo Antigravity
npx contextvc pull opencode      # Solo OpenCode
```

---

## 7. Variables de Entorno y Configuración

### Archivo `config.json`

El proyecto ahora usa un archivo de configuración guardado en `.ai-memory/config.json`:

```json
{
  "version": "1.0.0",
  "encryption": {
    "enabled": true,
    "recipientsFile": "./.ai-memory/recipients.txt"
  },
  "summarizer": {
    "provider": "local",       // "openai" | "local" | "none"
    "openaiApiKey": "sk-...",  // Opcional, solo si provider = "openai"
    "model": "gpt-4o-mini",
    "messageThreshold": 10,
    "sizeThresholdKb": 100
  },
  "editors": {
    "opencode": "...",
    "antigravity": "..."
  },
  "initializedAt": "2026-05-14T..."
}
```

### Variables de Entorno (legacy)

```bash
OPENAI_API_KEY=sk-...        # Opcional, solo si summarizer.provider = "openai"
AGE_RECIPIENTS_FILE=./.ai-memory/recipients.txt  # Auto-configurada
```

### Dependencias del Sistema

- **age:** Descargar de https://github.com/FiloSottile/age ( brew install age en macOS)
- **SSH keys:** Generadas con `ssh-keygen -t ed25519`

---

## 8. Roadmap: Próximos Pasos

### v1.0.1 — Ship (actual)

- `.gitignore`, empaquetado npm, README alineado
- `sync` con dedup por `session.id`
- `contextvc handoff` → `.ai-memory/HANDOFF.md`
- Hooks: `pre-commit`, `post-checkout`, `post-merge`
- Cursor reader (`agent-transcripts/*.jsonl`)
- `inject --session` corregido para Antigravity

### v1.1 — Team Relay

- Guía de onboarding equipo en README
- Tests de integración (writer, merge, cursor-reader)
- Mejoras en reader Antigravity (listar múltiples sesiones)

### Fuera de scope v1.x

| Item | Decisión |
|------|----------|
| Decodificar `jetskiStateSync` | **Won't fix** — usar `@path` en Antigravity |
| UI dashboard | v2.0+ o nunca |
| Servidor centralizado | Solo con demanda enterprise |
| Copilot / Windsurf | Después de Cursor estable |

### Futuro (v2.0+)

- File-watcher con debounce
- Más editores
- OpenCode plugin `onCheckout` (media prioridad; CLI inject ya existe)

---

## 9. Decisiones Técnicas Clave

| Decisión | Rationale |
|---|---|
| **TypeScript + Node.js** | Ecosistema más accesible para devs. NPM/npx distribución. |
| **age encryption** | Usa SSH keys existentes. No hay que gestionar keys nuevos. Team-ready por diseño. |
| **JSON estándar como formato pivot** | Permite adaptar cualquier editor. OpenCode, Antigravity, Cursor → todos se convierten al mismo formato. |
| **Git hooks bash-native (no Husky)** | No fuerza al proyecto a tener `package.json`. Funciona en repos Python, C++, Rust, etc. |
| **Smart pruning con OpenAI** | Resume sesiones de MBs a ~5KB. Mantiene el repo ligero. |
| **Summarizer modular (local/openai/none)** | Permite que funcione gratuito out-of-the-box, pero con opción de usar LLM. |
| **Escritura transaccional + backups** | Nunca perder contexto por fallos parciales. Crítico para datos valiosos. |
| **Wizard TUI con inquirer** | Reduce fricción a casi cero. Onboarding fluido para equipos. |
| **Open Source (MIT)** | Transparencia = confianza. |

---

## 10. Glosario

| Término | Definición |
|---|---|
| **contextvc** | Nombre del proyecto/CLI. "Context Version Control." |
| **Smart Pruning** | El proceso de usar un LLM (o heurística) para resumir sesiones largas. |
| **Modular Summarizer** | Componente que puede usar OpenAI, resumen local, o nada según la config. |
| **Adaptador** | Componente que convierte sesiones de un editor específico al formato estándar. |
| **Relay Asíncrono** | El feature central: un dev trabaja, guarda contexto en Git, el compañero lo recibe y continúa. |
| **age** | Herramienta de encriptación moderna. Usa SSH keys para encriptar/desencriptar. |
| **Recipients** | Llaves SSH autorizadas a encriptar/desencriptar los archivos del proyecto. |
| **jetskiStateSync** | Campo protobuf encriptado de Antigravity que contiene el índice de conversaciones. NO DECODIFICADO. |
| **Wizard TUI** | Interfaz de preguntas interactivas en la terminal (usa inquirer). |
| **Escritura transaccional** | Patrón de escribir a archivo temporal y renombrar atómicamente. |

---

## 11. Problemas Conocidos

### Antigravity — panel lateral (won't fix v1.x)

Las sesiones injectadas existen en `brain/<uuid>/session.md` pero **no** aparecen en el panel de conversaciones.

**Causa:** índice en protobuf encriptado (`jetskiStateSync`). No es bloqueante.

**Flujo oficial:** `contextvc inject …` → copiar `@path` al chat de Antigravity.

### Tupac vs context.md

| | context.md / CLAUDE.md | Tupac |
|--|------------------------|-------|
| Contenido | Convenciones del repo | Transcript / resumen de sesión |
| Tamaño | Pequeño, curado | Grande → resumido + cifrado |
| Audiencia | Toda sesión nueva | Handoff entre devs |
| Comando | Manual | `sync`, `handoff` |

---

*Documento generado: Mayo 2026. Proyecto en desarrollo activo.*