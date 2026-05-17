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

**Requirements:** Node 18+, [age](https://github.com/FiloSottile/age) (`brew install age` on macOS), Git.

```bash
npm install -g @ticoxz/relay
```

**From source:**

```bash
git clone https://github.com/ticoxz/Relay.git && cd Relay
npm install && npm run build && npm link
```

---

## Quickstart

```bash
cd your-project && git init
relay init
# work with Cursor, VS Code, OpenCode, or Antigravity…
relay sync --handoff
git add .ai-memory/HANDOFF.md .ai-memory/config.json .ai-memory/recipients.txt
git commit -m "chore: AI handoff"
```

By default, `sync` imports only the **latest session per editor** (fast). Use `relay sync --all` for full history.

---

## Context window full? Start a fresh chat

Relay does **not** extend your editor's context limit. It lets you **save game** and **load game** in a new chat.

```bash
relay sync --handoff
```

In Cursor (or any supported editor), open a **New Chat** and send:

```
@.ai-memory/HANDOFF.md

Read the handoff and explain where we left off. Do not run commands or edit files until I ask.
```

> If you only attach the file without instructions, some agents may treat "next steps" as tasks and start executing. The prompt above avoids that. `HANDOFF.md` includes agent instructions for this case.

---

## Commands

| Command | Description |
|---------|-------------|
| `relay init` | Wizard: encryption, summarizer, `.ai-memory/` |
| `relay sync [--handoff]` | Export latest session per editor → repo |
| `relay sync --all` | Export full history (slower) |
| `relay handoff` | Regenerate `.ai-memory/HANDOFF.md` |
| `relay inject <src> <dst>` | Bridge: `cursor` \| `vscode` \| `opencode` \| `antigravity` |
| `relay pull [editor]` | Pull one or all editors into `.ai-memory/sessions/` |
| `relay status [--editor] [--sessions]` | Dashboard |
| `relay install-hooks` | `pre-commit` sync + `post-checkout` / `post-merge` |
| `relay team auto-add` | Add SSH keys as age recipients |
| `relay decrypt <file.age>` | Decrypt a session file |

---

## For agents

Relay works well as a **checkpoint between agent runs**:

- `AGENTS.md` / rules = constitution (how to work in this repo)  
- `HANDOFF.md` = state of the last AI session (what happened, what's pending)  

Same Git commit can carry code + reasoning for the next human or autonomous agent.

---

## Security

- Sessions are encrypted with **age** using team SSH public keys (`recipients.txt`).  
- Raw chat files under `.ai-memory/sessions/` are typically **gitignored**; you commit `HANDOFF.md` + config.  
- Only people with repo access **and** a listed SSH key can decrypt.

---

## Development

```bash
npm run build && npm test
npm publish --access public   # package: @ticoxz/relay
```

---

## License

MIT — [ticoxz/Relay](https://github.com/ticoxz/Relay)
