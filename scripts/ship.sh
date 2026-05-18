#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> Relay ship (pnpm)"
corepack enable
pnpm install --frozen-lockfile
pnpm run build
pnpm test

VERSION=$(node -p "require('./package.json').version")
echo "==> Version: $VERSION"

if [[ "${1:-}" == "--publish" ]]; then
  if [[ -z "${NODE_AUTH_TOKEN:-}" && -z "${NPM_TOKEN:-}" ]]; then
    echo "Set NPM_TOKEN or run: pnpm login"
    exit 1
  fi
  export NODE_AUTH_TOKEN="${NODE_AUTH_TOKEN:-$NPM_TOKEN}"
  pnpm publish --access public --no-git-checks
  echo "Published @ticoxz/relay@$VERSION"
fi

echo "==> Tag (if not exists): git tag v$VERSION && git push origin v$VERSION"
echo "==> Global link: pnpm link --global"
echo "Done."
