# Install Relay (pnpm)

Relay uses **pnpm** for development and publishing. End users install the CLI with pnpm (recommended) or build from Git.

## Requirements

- Node.js 18+
- [pnpm](https://pnpm.io/installation) via Corepack (ships with Node 16.13+)
- [age](https://github.com/FiloSottile/age) for encryption
- Git

```bash
corepack enable
corepack prepare pnpm@9.15.0 --activate
pnpm --version
```

## Option A — Global CLI (registry)

Pin the version you trust (avoid floating `@latest` after supply-chain incidents):

```bash
pnpm add -g @ticoxz/relay@1.3.0
relay --version
which relay
which relay-mcp
```

Verify the package scope: **`@ticoxz/relay`** only.

## Option B — From Git (no registry install)

Use this if you prefer not to run `pnpm add -g` from the public registry:

```bash
git clone https://github.com/ticoxz/Relay.git
cd Relay
corepack enable
pnpm install --frozen-lockfile
pnpm run build
pnpm link --global
relay --version
```

Updates:

```bash
cd Relay && git pull && pnpm install --frozen-lockfile && pnpm run build
```

## Option C — One-off in a project

```bash
pnpm dlx @ticoxz/relay@1.3.0 init
pnpm dlx @ticoxz/relay@1.3.0 sync --handoff
```

## Security notes

- pnpm uses the **same npm registry** as npm; switching clients does not remove registry risk.
- Prefer **pinned versions** (`@1.3.0`) and verify the scope `@ticoxz/relay`.
- For maximum control, use **Option B** and review `pnpm-lock.yaml` before `pnpm install`.
- Enable **2FA** on your npm account if you publish the package.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `command not found: pnpm` | `corepack enable` |
| `command not found: relay` | `pnpm link --global` or re-open terminal |
| `age not found` | `brew install age` (macOS) |
| Hook does not run relay | `relay install-hooks` after global install |
