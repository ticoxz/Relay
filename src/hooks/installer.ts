import fs from 'fs';
import path from 'path';

const RELAY_DETECT = `
  local RELAY_CMD
  if npx --no-install relay --version >/dev/null 2>&1; then
    RELAY_CMD="npx --no-install relay"
  elif command -v relay >/dev/null 2>&1; then
    RELAY_CMD="relay"
  elif npx --no-install contextvc --version >/dev/null 2>&1; then
    RELAY_CMD="npx --no-install contextvc"
  elif command -v contextvc >/dev/null 2>&1; then
    RELAY_CMD="contextvc"
  else
    return 0
  fi
`;

const PRE_COMMIT_HOOK_CONTENT = `
# --- relay automation start ---
relay_auto_sync() {
${RELAY_DETECT}
  if $RELAY_CMD sync --quiet --handoff 2>/dev/null; then
    git add .ai-memory/sessions/*.age 2>/dev/null || true
    git add .ai-memory/sessions/*.json 2>/dev/null || true
    git add .ai-memory/HANDOFF.md 2>/dev/null || true
  fi
  return 0
}

relay_auto_sync
# --- relay automation end ---
`;

const POST_CHECKOUT_HOOK_CONTENT = `
# --- relay automation start ---
relay_post_checkout() {
${RELAY_DETECT}
  $RELAY_CMD handoff --from-repo --quiet 2>/dev/null || true
  return 0
}

relay_post_checkout
# --- relay automation end ---
`;

const POST_MERGE_HOOK_CONTENT = POST_CHECKOUT_HOOK_CONTENT.replace(
  'relay_post_checkout',
  'relay_post_merge'
);

const HOOK_MARKERS = ['relay automation', 'contextvc automation'];

export class HookInstaller {
  private static hasRelayHook(content: string): boolean {
    return HOOK_MARKERS.some(marker => content.includes(marker));
  }

  private static appendOrCreateHook(hookName: string, content: string): void {
    const gitDir = path.join(process.cwd(), '.git');
    if (!fs.existsSync(gitDir)) {
      throw new Error('No se encontró un repositorio Git (.git) en este directorio.');
    }

    const hooksDir = path.join(gitDir, 'hooks');
    if (!fs.existsSync(hooksDir)) {
      fs.mkdirSync(hooksDir, { recursive: true });
    }

    const hookPath = path.join(hooksDir, hookName);

    if (fs.existsSync(hookPath)) {
      const existingContent = fs.readFileSync(hookPath, 'utf-8');
      if (this.hasRelayHook(existingContent)) {
        return;
      }
      fs.appendFileSync(hookPath, content);
    } else {
      const newContent = `#!/bin/sh\n${content}`;
      fs.writeFileSync(hookPath, newContent);
    }

    fs.chmodSync(hookPath, '755');
  }

  static installPreCommit(): void {
    this.appendOrCreateHook('pre-commit', PRE_COMMIT_HOOK_CONTENT);
    console.log('✅ Git hook pre-commit instalado.');
  }

  static installPostCheckout(): void {
    this.appendOrCreateHook('post-checkout', POST_CHECKOUT_HOOK_CONTENT);
    console.log('✅ Git hook post-checkout instalado.');
  }

  static installPostMerge(): void {
    this.appendOrCreateHook('post-merge', POST_MERGE_HOOK_CONTENT);
    console.log('✅ Git hook post-merge instalado.');
  }

  static installAll(): void {
    this.installPreCommit();
    this.installPostCheckout();
    this.installPostMerge();
  }
}
