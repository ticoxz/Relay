# Relay MCP (optional)

Use MCP when you need programmatic handoff access (rules, automation, multi-repo agents). **Most users should start with `@.ai-memory/HANDOFF.md` in a new chat.**

## Setup (Cursor)

Settings → MCP:

```json
{
  "mcpServers": {
    "relay": {
      "command": "relay-mcp",
      "args": [],
      "env": {
        "RELAY_PROJECT_ROOT": "/absolute/path/to/your/repo"
      }
    }
  }
}
```

Requires `relay-mcp` on PATH (`pnpm add -g @ticoxz/relay@1.3.0` or `pnpm link --global` from a Git clone).

## Tools

| Tool | Purpose |
|------|---------|
| `get_handoff` | `HANDOFF.md` + agent instructions |
| `get_handoff_json` | Structured HANDOFF v1 |
| `list_sessions` | Metadata under `.ai-memory/sessions/` |
| `decrypt_session` | Decrypt one `.age` file locally |
| `sync_status` | Whether handoff files exist |

## Suggested rule (optional)

In `AGENTS.md` or Cursor rules:

```
When starting work in this repo, call MCP get_handoff (or read @.ai-memory/HANDOFF.md).
Explain context first; do not run commands or edit files until the user confirms.
```

## 90-day adoption review

90 days after `@ticoxz/relay@1.3.0` is on the registry (`pnpm publish`): if MCP/JSON are unused, defer new MCP features and focus on readers, `relay doctor`, and HANDOFF.md workflow. See [doc.md](../doc.md) §8.
