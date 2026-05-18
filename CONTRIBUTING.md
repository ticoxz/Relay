# Contributing

## Setup

```bash
git clone https://github.com/ticoxz/Relay.git
cd Relay
corepack enable
pnpm install --frozen-lockfile
pnpm run build
pnpm test
pnpm link --global
```

Use **pnpm only**. This project sets `packageManager` and `engine-strict`; do not commit `package-lock.json`.

## Before a PR

```bash
pnpm run build && pnpm test
pnpm exec relay doctor
```

## Release (maintainers)

1. Bump version in `package.json` and `src/cli/index.ts`.
2. Commit and tag: `git tag v1.x.x && git push origin v1.x.x`
3. CI publishes when `NPM_TOKEN` secret is configured, or run locally: `pnpm publish --access public`
