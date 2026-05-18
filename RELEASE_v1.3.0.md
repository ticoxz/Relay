# Relay v1.3.0

**Git for AI sessions** — checkpoint between chats, machines, and teammates.

## Highlights

- **HANDOFF.json** (schema v1) alongside `HANDOFF.md` for humans and agents
- **`relay-mcp`** — optional MCP tools: `get_handoff`, `get_handoff_json`, `list_sessions`, `decrypt_session`, `sync_status`
- **VS Code** Copilot Chat reader and `relay inject` bridge
- **`relay doctor`** — validate age, config, readers, HANDOFF freshness
- **GitHub Action** — PR comment when `HANDOFF.md` changes
- **CLI UX** — `relay handoff --for-agent`, clearer sync/handoff output

## Install

```bash
corepack enable
pnpm add -g @ticoxz/relay
cd your-project && relay init && relay sync --handoff
```

## New chat (recommended)

```
@.ai-memory/HANDOFF.md

Read the handoff and explain where we left off. Do not run commands or edit files until I ask.
```

## Full changelog

See commits from `cursor/relay-rebrand-v1.1.0` merged to `main`.
