# Publish @ticoxz/relay (maintainers)

## One-time: npm account

1. Create/login at [npmjs.com](https://www.npmjs.com/) as org/user **ticoxz**.
2. Enable **2FA** on the account.
3. Create an **Automation** or **Publish** token: Account → Access Tokens.

## Publish from your machine

```bash
cd /path/to/Relay
corepack enable
pnpm login                    # paste OTP if 2FA
./scripts/ship.sh --publish
git tag v$(node -p "require('./package.json').version")
git push origin --tags
```

Or manually:

```bash
pnpm publish --access public
```

## Publish via GitHub Actions

1. Repo **Settings → Secrets and variables → Actions**
2. New secret: `NPM_TOKEN` = npm automation token
3. Push a version tag:

```bash
# after bumping package.json version
git tag v1.3.1
git push origin v1.3.1
```

Workflow [`.github/workflows/publish.yml`](../.github/workflows/publish.yml) runs `pnpm publish` on tag push.

Re-run a failed publish: Actions → Publish → Re-run job.

## Verify

```bash
npm view @ticoxz/relay version
pnpm add -g @ticoxz/relay@$(npm view @ticoxz/relay version)
relay --version
```
