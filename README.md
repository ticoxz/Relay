# Relay

**Git for AI sessions** — sync the reasoning behind your code across editors, machines, and teammates. Encrypted, local-first, and built for real workflows.

[![GitHub](https://img.shields.io/github/stars/ticoxz/Relay?style=social)](https://github.com/ticoxz/Relay)

---

## The problem

When you code with an AI assistant (Cursor, VS Code Copilot, OpenCode, Antigravity, etc.), you build valuable context over hours:

- Architectural decisions and trade-offs  
- Why you chose approach A over B  
- Files you touched and errors you hit  
- The current mental model of the problem  

That context lives in **proprietary, local storage** inside each editor. It does not travel with your Git repo.

So when you:

- Open a **new chat** because the context window is full  
- Switch **machines** or hand off to a **teammate**  
- Move to a **different editor**  

…you lose the thread. Your repo has the code; nobody has the conversation that produced it.

---

## What Relay does

Relay is a CLI that:

1. **Reads** AI chat sessions from supported editors on your machine  
2. **Normalizes** them into a standard JSON format  
3. **Encrypts** them with [age](https://github.com/FiloSottile/age) + your team's SSH keys  
4. **Stores** them under `.ai-memory/` in your project  
5. **Generates** `.ai-memory/HANDOFF.md` — a human- and agent-friendly briefing for the next session  

You commit handoff + config to Git. Your teammate runs `git pull`, reads `HANDOFF.md`, and continues where you left off.

```
Editors → readers → standard session JSON → age encrypt → .ai-memory/ → Git → HANDOFF.md
```

---

## Relay is not…

| Relay is **not** | Relay **is** |
|------------------|--------------|
| A bigger context window inside one editor | A **save/load checkpoint** for AI sessions |
| A replacement for `context.md` / `AGENTS.md` | A **session log** that complements static project docs |
| A hosted chat server | **Local-first** + Git + optional team encryption |
| Import into every editor's native sidebar | **@file** handoff where APIs don't exist (Antigravity, Cursor import) |

> **`context.md`** describes how the project works (stable, curated).  
> **Relay** captures what you and the AI decided in this session (dynamic, exported from the editor).

---

## Two modes

### Mode A — Team relay (primary)

Share state with your team through Git.

```bash
relay sync --handoff
git add .ai-memory/HANDOFF.md .ai-memory/config.json .ai-memory/recipients.txt
git commit -m "chore: AI handoff"
git push
```

Teammate:

```bash
git pull
cat .ai-memory/HANDOFF.md
# full transcript (encrypted):
relay decrypt .ai-memory/sessions/session-*.json.age
```

### Mode B — Editor bridge (secondary)

Continue the same conversation in another editor without starting from zero.

```bash
relay inject cursor antigravity   # prints @path to session.md
relay inject cursor vscode        # exports to .ai-memory/vscode-import/
relay inject vscode cursor
```

---

## Supported editors

| Editor | Read sessions | Inject into |
|--------|---------------|-------------|
| **Cursor** | `~/.cursor/projects/<project>/agent-transcripts/*.jsonl` | `@.ai-memory/cursor-import/...` |
| **VS Code** (Copilot Chat) | `workspaceStorage/<hash>/chatSessions/` (`.json` / `.jsonl`) | `@.ai-memory/vscode-import/...` |
| **OpenCode** | `~/.local/share/opencode/` | Native session history |
| **Antigravity** | `~/.gemini/antigravity/brain/` | `@~/.gemini/.../session.md` |

> **VS Code:** open the repo in VS Code and use Copilot Chat so sessions are written to disk.  
> **Antigravity:** imported sessions do not appear in the sidebar; use `@path` in chat (official flow).

The `contextvc` binary alias is kept for backward compatibility.

---

## Install

**Requirements:** Node 18+, [pnpm](https://pnpm.io/installation) (via Corepack: `corepack enable`), [age](https://github.com/FiloSottile/age) (`brew install age` on macOS), Git.

```bash
corepack enable
pnpm add -g @ticoxz/relay
```

npm also works: `npm install -g @ticoxz/relay` (same package on the npm registry).

**From source:**

```bash
git clone https://github.com/ticoxz/Relay.git && cd Relay
corepack enable
pnpm install && pnpm run build && pnpm link --global
```

---

## Quickstart

```bash
cd your-project && git init
relay init
relay doctor          # optional: verify age, config, readers
# work with Cursor, VS Code, OpenCode, or Antigravity…
relay sync --handoff
git add .ai-memory/HANDOFF.md .ai-memory/HANDOFF.json .ai-memory/config.json .ai-memory/recipients.txt
git commit -m "chore: AI handoff"
```

By default, `sync` imports only the **latest session per editor** (fast). Use `relay sync --all` for full history.

---

## Context window full? (primary flow)

When the chat is ~90% full, **save game** and **load game** in a new chat:

```bash
relay sync --handoff
relay handoff --for-agent   # prints copy-paste prompt
```

Open a **New Chat** in your editor and send:

```
@.ai-memory/HANDOFF.md

Read the handoff and explain where we left off. Do not run commands or edit files until I ask.
```

> Without those instructions, some agents treat "next steps" as tasks and start executing. `HANDOFF.md` and `HANDOFF.json` include `do_not_execute` guardrails for agents.

Run `relay doctor` if handoff feels stale or sync fails.

---

## Commands

| Command | Description |
|---------|-------------|
| `relay init` | Wizard: encryption, summarizer, `.ai-memory/` |
| `relay sync [--handoff]` | Export latest session per editor → repo |
| `relay sync --all` | Export full history (slower) |
| `relay handoff [--for-agent]` | Regenerate `HANDOFF.md` + `HANDOFF.json`; `--for-agent` prints chat prompt |
| `relay doctor` | Validate age, config, readers, HANDOFF freshness |
| `relay-mcp` | MCP server (optional): `get_handoff`, `get_handoff_json`, `list_sessions`, `decrypt_session` |
| `relay inject <src> <dst>` | Bridge: `cursor` \| `vscode` \| `opencode` \| `antigravity` |
| `relay pull [editor]` | Pull one or all editors into `.ai-memory/sessions/` |
| `relay status [--editor] [--sessions]` | Dashboard |
| `relay install-hooks` | `pre-commit` sync + `post-checkout` / `post-merge` |
| `relay team auto-add` | Add SSH keys as age recipients |
| `relay decrypt <file.age>` | Decrypt a session file |

---

## Relay for agents (optional)

MCP and `HANDOFF.json` are for power users and CI. **Start with `@HANDOFF.md`** in a new chat; add MCP only if you need programmatic access.

Relay is a **checkpoint between agent runs** — not a code index (see tools like CodeGraph for that).

| Artifact | Consumer |
|----------|----------|
| `AGENTS.md` / rules | How to work in this repo (stable) |
| `HANDOFF.md` | Human-readable session state |
| `HANDOFF.json` | Machine-readable schema **v1** ([`schema/HANDOFF.schema.json`](schema/HANDOFF.schema.json)) |

`HANDOFF.json` includes `agent_instructions.do_not_execute: true` so agents explain context first instead of auto-running tasks.

### MCP server (`relay-mcp`)

See [docs/MCP.md](docs/MCP.md) for setup, optional rules, and the 90-day adoption review.

Add to Cursor → Settings → MCP:

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

Tools:

| Tool | Purpose |
|------|---------|
| `get_handoff` | `HANDOFF.md` + agent instructions |
| `get_handoff_json` | Structured v1 document |
| `list_sessions` | Metadata for `.ai-memory/sessions/*` |
| `decrypt_session` | Decrypt one `.age` file (local age + SSH) |
| `sync_status` | Whether handoff files exist |

### Prompt for a new chat

```bash
relay handoff --for-agent
```

Copy the output into a **new chat**, or use:

```
@.ai-memory/HANDOFF.md

Read the handoff and explain where we left off. Do not run commands or edit files until I ask.
```

### GitHub Action (PR comments)

When a PR changes `HANDOFF.md`, post a short excerpt on the PR:

```yaml
# .github/workflows/relay-handoff.yml
on:
  pull_request:
    paths: ['.ai-memory/HANDOFF.md', '.ai-memory/HANDOFF.json']
permissions:
  pull-requests: write
jobs:
  handoff:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: ticoxz/Relay/action@v1.3.0
```

See [`action/action.yml`](action/action.yml). Comments only run when `HANDOFF.md` changed in the PR.

### Agent role templates (prompts)

**Onboarding** (new teammate or new chat):

```
@.ai-memory/HANDOFF.md
@AGENTS.md

You are onboarding to this repo. Read HANDOFF for session context and AGENTS.md for rules.
Explain the project state and suggest a 30-minute plan. Do not edit files or run commands until I confirm.
```

**Reviewer** (before merge):

```
@.ai-memory/HANDOFF.json

Compare the PR diff with handoff decisions. List any contradictions or missing updates to HANDOFF.
Do not approve or run CI — checklist only.
```

---

## Security

- Sessions are encrypted with **age** using team SSH public keys (`recipients.txt`).  
- Raw chat files under `.ai-memory/sessions/` are typically **gitignored**; you commit `HANDOFF.md` + config.  
- Only people with repo access **and** a listed SSH key can decrypt.

---

## Development

```bash
corepack enable
pnpm install
pnpm run build && pnpm test
pnpm publish --access public   # publishes to npm registry; package: @ticoxz/relay
```

---

## License

MIT — [ticoxz/Relay](https://github.com/ticoxz/Relay)
