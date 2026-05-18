import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import { ConfigManager } from '../../core/config';
import { Logger } from '../../core/logger';
import { AgeEncryption } from '../../encryption/age';
import { readHandoffJson } from '../../sync/handoff';
import { CursorReader } from '../../plugin/cursor-reader';
import { VSCodeReader } from '../../plugin/vscode-reader';
import { AntigravityReader } from '../../plugin/antigravity-reader';
import { readOpenCodeSessions } from '../../plugin/storage-reader';

type CheckStatus = 'ok' | 'warn' | 'fail';

interface CheckResult {
  name: string;
  status: CheckStatus;
  detail: string;
}

function add(
  results: CheckResult[],
  name: string,
  status: CheckStatus,
  detail: string
): void {
  results.push({ name, status, detail });
}

function handoffAgeDays(mdPath: string): number {
  const mtime = fs.statSync(mdPath).mtimeMs;
  return (Date.now() - mtime) / (1000 * 60 * 60 * 24);
}

async function countEditorSessions(): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  const cwd = process.cwd();

  try {
    counts.cursor = (await CursorReader.listSessions(cwd)).length;
  } catch {
    counts.cursor = 0;
  }

  try {
    counts.vscode = (await VSCodeReader.listSessions(cwd)).length;
  } catch {
    counts.vscode = 0;
  }

  try {
    counts.antigravity = (await AntigravityReader.listSessions()).length;
  } catch {
    counts.antigravity = 0;
  }

  try {
    const oc = await readOpenCodeSessions();
    counts.opencode = oc?.length ?? 0;
  } catch {
    counts.opencode = 0;
  }

  return counts;
}

export const doctorCommand = new Command('doctor')
  .description('Valida instalación Relay: age, config, readers, HANDOFF')
  .option('--json', 'Salida JSON')
  .option('--stale-days <n>', 'Advertir si HANDOFF.md tiene más de N días', '7')
  .action(async (options) => {
    const results: CheckResult[] = [];
    const root = process.cwd();
    const memoryDir = path.join(root, '.ai-memory');
    const staleDays = parseInt(options.staleDays, 10) || 7;

    // Node
    add(results, 'node', 'ok', `v${process.version}`);

    // age
    if (AgeEncryption.isAvailable()) {
      try {
        const ver = execSync('age --version', { encoding: 'utf-8' }).trim();
        add(results, 'age', 'ok', ver);
      } catch {
        add(results, 'age', 'ok', 'installed');
      }
    } else {
      add(
        results,
        'age',
        'fail',
        'Not found. Install: brew install age (macOS) or https://github.com/FiloSottile/age'
      );
    }

    // SSH keys
    const pubKeys = AgeEncryption.findSshKeys();
    if (pubKeys.length > 0) {
      add(results, 'ssh-keys', 'ok', `${pubKeys.length} public key(s) in ~/.ssh`);
    } else {
      add(results, 'ssh-keys', 'warn', 'No ~/.ssh/*.pub — run ssh-keygen -t ed25519');
    }

    // Config
    const configPath = path.join(memoryDir, 'config.json');
    if (fs.existsSync(configPath)) {
      try {
        ConfigManager.load();
        add(results, 'relay-init', 'ok', configPath);
      } catch (e: unknown) {
        add(
          results,
          'relay-init',
          'fail',
          `Invalid config: ${e instanceof Error ? e.message : String(e)}`
        );
      }
    } else {
      add(results, 'relay-init', 'fail', 'Run: relay init');
    }

    // Recipients
    const recipients = AgeEncryption.getRecipients();
    if (recipients.length > 0) {
      add(results, 'recipients', 'ok', `${recipients.length} recipient(s)`);
    } else if (fs.existsSync(path.join(memoryDir, 'recipients.txt'))) {
      add(results, 'recipients', 'warn', 'recipients.txt empty — relay team add or auto-add');
    } else {
      add(results, 'recipients', 'warn', 'No recipients — encryption will fail on sync');
    }

    // HANDOFF
    const handoffMd = path.join(memoryDir, 'HANDOFF.md');
    const handoffJson = path.join(memoryDir, 'HANDOFF.json');
    if (fs.existsSync(handoffMd)) {
      const days = handoffAgeDays(handoffMd);
      if (days > staleDays) {
        add(
          results,
          'handoff-md',
          'warn',
          `${Math.floor(days)}d old — run: relay sync --handoff`
        );
      } else {
        add(results, 'handoff-md', 'ok', `fresh (${Math.floor(days)}d)`);
      }
    } else {
      add(results, 'handoff-md', 'warn', 'Missing — run: relay sync --handoff');
    }

    if (fs.existsSync(handoffJson)) {
      const doc = readHandoffJson(root);
      if (doc?.agent_instructions?.do_not_execute) {
        add(results, 'handoff-json', 'ok', 'schema v1, do_not_execute set');
      } else {
        add(results, 'handoff-json', 'warn', 'Present but missing agent_instructions');
      }
    } else {
      add(results, 'handoff-json', 'warn', 'Missing — run: relay sync --handoff');
    }

    // Sessions dir
    const sessionsDir = path.join(memoryDir, 'sessions');
    if (fs.existsSync(sessionsDir)) {
      const n = fs
        .readdirSync(sessionsDir)
        .filter(f => f.endsWith('.age') || f.endsWith('.json')).length;
      add(results, 'sessions', n > 0 ? 'ok' : 'warn', `${n} file(s) in .ai-memory/sessions/`);
    } else {
      add(results, 'sessions', 'warn', 'No sessions yet — run: relay sync');
    }

    // Git hooks
    const preCommit = path.join(root, '.git', 'hooks', 'pre-commit');
    if (fs.existsSync(preCommit) && fs.readFileSync(preCommit, 'utf-8').includes('relay')) {
      add(results, 'git-hooks', 'ok', 'pre-commit runs relay');
    } else {
      add(results, 'git-hooks', 'warn', 'Optional: relay install-hooks');
    }

    // Editors
    const editorCounts = await countEditorSessions();
    for (const [editor, count] of Object.entries(editorCounts)) {
      add(
        results,
        `reader:${editor}`,
        count > 0 ? 'ok' : 'warn',
        count > 0 ? `${count} session(s) on disk` : 'no sessions found for this project'
      );
    }

    const fails = results.filter(r => r.status === 'fail').length;
    const warns = results.filter(r => r.status === 'warn').length;

    if (options.json) {
      console.log(JSON.stringify({ ok: fails === 0, fails, warns, checks: results }, null, 2));
      process.exit(fails > 0 ? 1 : 0);
      return;
    }

    Logger.banner('doctor', path.basename(root));
    for (const r of results) {
      const icon = r.status === 'ok' ? '✅' : r.status === 'warn' ? '⚠️ ' : '❌';
      console.log(`  ${icon} ${r.name}: ${r.detail}`);
    }
    Logger.blank();
    if (fails > 0) {
      Logger.error(`${fails} check(s) failed`);
      process.exit(1);
    }
    if (warns > 0) {
      Logger.warn(`${warns} warning(s) — Relay can run but handoff may be stale`);
    } else {
      Logger.success('All checks passed');
    }
  });
