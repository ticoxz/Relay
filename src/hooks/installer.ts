import fs from 'fs';
import path from 'path';

const CVC_DETECT = `
  local CVC_CMD
  if npx --no-install contextvc --version >/dev/null 2>&1; then
    CVC_CMD="npx --no-install contextvc"
  elif command -v contextvc >/dev/null 2>&1; then
    CVC_CMD="contextvc"
  else
    return 0
  fi
`;

const PRE_COMMIT_HOOK_CONTENT = `
# --- contextvc automation start ---
contextvc_auto_sync() {
${CVC_DETECT}
  if $CVC_CMD sync --quiet 2>/dev/null; then
    git add .ai-memory/sessions/*.age 2>/dev/null || true
    git add .ai-memory/sessions/*.json 2>/dev/null || true
    git add .ai-memory/HANDOFF.md 2>/dev/null || true
  fi
  return 0
}

contextvc_auto_sync
# --- contextvc automation end ---
`;

const POST_CHECKOUT_HOOK_CONTENT = `
# --- contextvc automation start ---
contextvc_post_checkout() {
${CVC_DETECT}
  $CVC_CMD handoff --from-repo --quiet 2>/dev/null || true
  return 0
}

contextvc_post_checkout
# --- contextvc automation end ---
`;

const POST_MERGE_HOOK_CONTENT = POST_CHECKOUT_HOOK_CONTENT.replace(
  'contextvc_post_checkout',
  'contextvc_post_merge'
);

export class HookInstaller {
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
      if (existingContent.includes('contextvc automation')) {
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
