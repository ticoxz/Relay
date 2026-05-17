# Relay

**Git para sesiones de IA** — sincroniza el razonamiento de tu asistente con tu código, cifrado y listo para el equipo.

[![GitHub](https://img.shields.io/github/stars/ticoxz/Relay?style=social)](https://github.com/ticoxz/Relay)

---

## El problema

Cada editor (Cursor, OpenCode, Antigravity…) guarda el historial en formatos propietarios y locales. Si cambiás de máquina, de compañero o de editor, perdés horas de contexto.

## La solución: dos modos

| Modo | Para qué | Flujo |
|------|----------|--------|
| **A — Team Relay** | Guardar / compartir estado | `relay sync --handoff` → `git commit` |
| **B — Editor bridge** | Otro editor, mismo chat | `relay inject cursor opencode` |

### Relay vs `context.md`

- **`context.md`** = manual del proyecto (estable, pequeño).
- **Relay** = bitácora de la sesión + handoff cifrado en Git.

> *`context.md` dice cómo es el proyecto; Relay preserva en qué estabas con la IA.*

Relay **no agranda** la ventana de contexto del editor. Te deja **guardar partida** y **cargar partida** en un chat nuevo.

---

## Instalación

```bash
npm install -g @ticoxz/relay
# desarrollo local:
git clone https://github.com/ticoxz/Relay.git && cd Relay
npm install && npm run build && npm link
```

Requisitos: Node 18+, [age](https://github.com/FiloSottile/age) (`brew install age`), repo Git.

---

## Quickstart

```bash
cd tu-proyecto && git init
relay init
# … trabajá con Cursor / OpenCode / Antigravity …
relay sync --handoff          # solo la última sesión por editor (rápido)
git add .ai-memory/HANDOFF.md .ai-memory/config.json .ai-memory/recipients.txt
git commit -m "chore: AI handoff"
```

### Chat al 84% de contexto → empezar de cero sin perder el hilo

```bash
relay sync --handoff
```

En Cursor: **New Chat** y en el primer mensaje (no solo adjuntar el archivo):

```
@.ai-memory/HANDOFF.md

Lee el handoff y explícame en qué quedamos. No ejecutes nada hasta que te lo pida.
```

Si solo pegás la ruta del archivo sin instrucción, el agente puede interpretar «Próximos pasos» como tareas y empezar a correr comandos solo.

---

## Comandos

| Comando | Descripción |
|---------|-------------|
| `sync [--handoff]` | **Por defecto:** última sesión de cada editor (3 max) |
| `sync --all` | Todo el historial (lento; antes era el default) |
| `handoff` | Regenera `HANDOFF.md` |
| `inject <src> <dst>` | `cursor` \| `vscode` \| `opencode` \| `antigravity` |
| `init` / `status` / `team` / `install-hooks` | Setup y equipo |

### Puentes entre editores

```bash
relay inject cursor opencode      # sesión en historial OpenCode
relay inject cursor antigravity   # luego @path al session.md en Antigravity
relay inject cursor vscode        # export → @.ai-memory/vscode-import/...
relay status --editor vscode --sessions
```

**VS Code:** lee Copilot Chat en `~/Library/Application Support/Code/User/workspaceStorage/<hash>/chatSessions/` (`.json` / `.jsonl`). Abrí el repo en VS Code y chateá con Copilot para generar sesiones.

---

## Publicar / desarrollo

```bash
npm run build && npm test
npm publish --access public   # paquete: @ticoxz/relay
```

---

MIT — [ticoxz/Relay](https://github.com/ticoxz/Relay)
