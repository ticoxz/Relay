# Tupac (ContextVC)

**Git para sesiones de IA** — sincroniza el razonamiento de tu asistente con tu código, cifrado y listo para el equipo.

---

## El problema

Cada editor (Cursor, OpenCode, Antigravity…) guarda el historial en formatos propietarios y locales. Si cambiás de máquina, de compañero o de editor, perdés horas de contexto: decisiones, trade-offs, archivos discutidos.

## La solución: dos modos

| Modo | Para qué | Flujo |
|------|----------|--------|
| **A — Team Relay** (principal) | Tu compañero continúa donde vos dejaste | `sync` → `git commit` → `git pull` → leer `HANDOFF.md` |
| **B — Editor bridge** (secundario) | Cambiar de editor sin empezar de cero | `inject opencode antigravity` → `@session.md` en el chat |

### Tupac vs `context.md` vs memoria de Cursor

- **`context.md` / `CLAUDE.md` / rules** = manual del proyecto (estable, curado, pequeño).
- **Memoria nativa del editor** = optimizada dentro de *un* producto; no porta a Git ni a otro editor.
- **Tupac** = bitácora de la sesión de IA + relay de equipo cifrado en el repo.

> *`context.md` dice cómo es el proyecto; Tupac preserva qué decidió la IA contigo ayer y lo deja continuar en otra máquina, otro editor u otra persona.*

---

## Quickstart (3 comandos)

**Requisitos:** Node 18+, [age](https://github.com/FiloSottile/age) (`brew install age`), repo Git.

```bash
npm install -g contextvc   # o: npx contextvc
cd tu-proyecto && git init
contextvc init
# … trabajá con tu IA …
contextvc sync --handoff
git add .ai-memory && git commit -m "chore: sync AI context"
```

Tu compañero:

```bash
git pull
cat .ai-memory/HANDOFF.md    # resumen legible
contextvc decrypt .ai-memory/sessions/session-*.json.age  # transcript completo
```

Hooks automáticos (opcional):

```bash
contextvc install-hooks
```

---

## Comandos

| Comando | Descripción |
|---------|-------------|
| `init` | Wizard: encriptación, summarizer, estructura `.ai-memory/` |
| `sync [--handoff]` | Extrae sesiones de editores → `.ai-memory/sessions/` |
| `handoff [--from-repo]` | Genera `.ai-memory/HANDOFF.md` para el equipo |
| `pull [editor]` | `opencode` \| `antigravity` \| `cursor` |
| `inject <src> <dst>` | Migra sesión entre editores |
| `status [--editor]` | Estado del repo y editores |
| `install-hooks` | pre-commit + post-checkout/merge |
| `team auto-add` | Añade SSH keys como destinatarios age |
| `merge` / `decrypt` | Resolución de conflictos y lectura |

### Inyectar en Antigravity (flujo oficial)

```bash
contextvc inject opencode antigravity
# Copiar el @path que imprime el CLI y pegarlo en el chat
```

La sesión **no aparece en el panel lateral** de Antigravity (requiere `.pb` encriptados de ~6MB). El flujo soportado es **`@path`** al `session.md` generado.

### Cursor

```bash
contextvc pull cursor
contextvc status --editor cursor --sessions
contextvc inject cursor antigravity   # o inject opencode cursor
```

Lectura desde `~/.cursor/projects/<proyecto>/agent-transcripts/*.jsonl`. Inyección “soft” vía `@.ai-memory/cursor-import/session-*.md`.

---

## Arquitectura

```
Editores (OpenCode, Antigravity, Cursor)
        ↓ readers
   Formato estándar (JSON)
        ↓ summarizer + age
   .ai-memory/sessions/*.age
        ↓ git
   Equipo + HANDOFF.md
```

---

## Estado del proyecto

| Componente | Estado |
|------------|--------|
| Core (config, age, backup, logger) | ✅ |
| OpenCode / Antigravity readers & injectors | ✅ |
| Cursor reader + inject soft | ✅ |
| `sync`, `status`, `handoff`, hooks | ✅ |
| Panel lateral Antigravity | ❌ Won't fix — usar `@path` |
| `jetskiStateSync` decode | ❌ Fuera de scope v1.x |

---

## Desarrollo

```bash
npm install && npm run build && npm test
```

---

## Roadmap

```
v1.0.1 — Ship: docs, dedup sync, handoff, Cursor reader, npm
v1.1   — Team relay polish, más tests de integración
v1.2+  — Más editores, file-watcher (si hay demanda)
v2.0   — Dashboard / servidor (solo con tracción)
```

---

*Marcelo Miranda — [github.com/anomalyco/tupac](https://github.com/anomalyco/tupac)*
