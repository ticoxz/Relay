# Relay

**Git para sesiones de IA** — sincroniza el razonamiento de tu asistente con tu código, cifrado y listo para el equipo.

[![GitHub](https://img.shields.io/github/stars/ticoxz/Relay?style=social)](https://github.com/ticoxz/Relay)

---

## El problema

Cada editor (Cursor, OpenCode, Antigravity…) guarda el historial en formatos propietarios y locales. Si cambiás de máquina, de compañero o de editor, perdés horas de contexto: decisiones, trade-offs, archivos discutidos.

## La solución: dos modos

| Modo | Para qué | Flujo |
|------|----------|--------|
| **A — Team Relay** (principal) | Tu compañero continúa donde vos dejaste | `relay sync` → `git commit` → `git pull` → leer `HANDOFF.md` |
| **B — Editor bridge** (secundario) | Cambiar de editor sin empezar de cero | `relay inject opencode antigravity` → `@session.md` en el chat |

### Relay vs `context.md` vs memoria de Cursor

- **`context.md` / `CLAUDE.md` / rules** = manual del proyecto (estable, curado, pequeño).
- **Memoria nativa del editor** = optimizada dentro de *un* producto; no porta a Git ni a otro editor.
- **Relay** = bitácora de la sesión de IA + relay de equipo cifrado en el repo.

> *`context.md` dice cómo es el proyecto; Relay preserva qué decidió la IA contigo ayer y lo deja continuar en otra máquina, otro editor u otra persona.*

> El binario `contextvc` sigue disponible como alias de `relay` por compatibilidad.

---

## Quickstart (3 comandos)

**Requisitos:** Node 18+, [age](https://github.com/FiloSottile/age) (`brew install age`), repo Git.

```bash
npm install -g relay   # o: npx relay
cd tu-proyecto && git init
relay init
# … trabajá con tu IA …
relay sync --handoff
git add .ai-memory && git commit -m "chore: sync AI context"
```

Tu compañero:

```bash
git pull
cat .ai-memory/HANDOFF.md
relay decrypt .ai-memory/sessions/session-*.json.age  # transcript completo
```

Hooks automáticos (opcional):

```bash
relay install-hooks
```

---

## Comandos

| Comando | Descripción |
|---------|-------------|
| `init` | Wizard: encriptación, summarizer, `.ai-memory/` |
| `sync [--handoff]` | Extrae sesiones de editores → repo |
| `handoff [--from-repo]` | Genera `.ai-memory/HANDOFF.md` |
| `pull [editor]` | `opencode` \| `antigravity` \| `cursor` |
| `inject <src> <dst>` | Migra sesión entre editores |
| `status [--editor]` | Estado del repo y editores |
| `install-hooks` | pre-commit + post-checkout/merge |
| `team auto-add` | SSH keys → destinatarios age |
| `merge` / `decrypt` | Conflictos y lectura |

### Antigravity (flujo oficial)

```bash
relay inject opencode antigravity
# Copiar el @path que imprime el CLI
```

La sesión **no aparece en el panel lateral** (requiere `.pb` encriptados). Usar **`@path`** al `session.md` generado.

### Cursor

```bash
relay pull cursor
relay status --editor cursor --sessions
relay inject cursor antigravity
```

Lee `~/.cursor/projects/<proyecto>/agent-transcripts/*.jsonl`.

---

## Arquitectura

```
Editores → readers → JSON estándar → age → .ai-memory/ → Git → HANDOFF.md
```

---

## Desarrollo

```bash
git clone https://github.com/ticoxz/Relay.git
cd Relay && npm install && npm run build && npm test
```

---

## Licencia

MIT — Marcelo Miranda
