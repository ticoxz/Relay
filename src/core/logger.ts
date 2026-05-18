import chalk from 'chalk';

export type EditorKey = 'opencode' | 'antigravity' | 'cursor' | 'vscode';

export const EDITOR_META: Record<EditorKey, { icon: string; label: string }> = {
  opencode: { icon: '📦', label: 'OpenCode' },
  antigravity: { icon: '🪐', label: 'Antigravity' },
  cursor: { icon: '✨', label: 'Cursor' },
  vscode: { icon: '💙', label: 'VS Code' },
};

type EditorLineStatus = 'pending' | 'active' | 'ok' | 'skip' | 'warn';

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

export class Logger {
  private static _quiet = false;

  static setQuiet(quiet: boolean): void {
    this._quiet = quiet;
  }

  static get quiet(): boolean {
    return this._quiet;
  }

  static shouldLog(): boolean {
    return !this._quiet;
  }

  static success(message: string): void {
    if (!this.shouldLog()) return;
    console.log(chalk.green('  ✅'), message);
  }

  static error(message: string): void {
    console.error(chalk.red('  ❌'), message);
  }

  static warn(message: string): void {
    if (!this.shouldLog()) return;
    console.warn(chalk.yellow('  ⚠️ '), message);
  }

  static info(message: string): void {
    if (!this.shouldLog()) return;
    console.log(chalk.blue('  ℹ️ '), message);
  }

  static dim(message: string): void {
    if (!this.shouldLog()) return;
    console.log(chalk.gray('     ' + message));
  }

  static step(stepNumber: number, total: number, message: string, icon = '▸'): void {
    if (!this.shouldLog()) return;
    console.log(chalk.cyan(`  ${icon} [${stepNumber}/${total}]`), chalk.bold(message));
  }

  static logIfNotQuiet(message: string, isQuiet: boolean): void {
    if (!isQuiet) console.log(message);
  }

  static blank(): void {
    if (!this.shouldLog()) return;
    console.log('');
  }

  static divider(): void {
    if (!this.shouldLog()) return;
    console.log(chalk.gray('  ' + '─'.repeat(56)));
  }

  static header(text: string): void {
    if (!this.shouldLog()) return;
    console.log('');
    console.log(chalk.bgCyan.black.bold(`  ${text}  `));
    console.log('');
  }

  /** Compact command banner */
  static banner(command: string, subtitle?: string): void {
    if (!this.shouldLog()) return;
    console.log('');
    console.log(chalk.bold.cyan('  ⚡ Relay'), chalk.gray('·'), chalk.white(command));
    if (subtitle) {
      console.log(chalk.gray('     ' + subtitle));
    }
    console.log('');
  }

  /** Major phase (emoji changes per phase) */
  static phase(emoji: string, title: string): void {
    if (!this.shouldLog()) return;
    console.log(chalk.bold(`  ${emoji}  ${title}`));
  }

  static editorLine(
    editor: EditorKey,
    status: EditorLineStatus,
    detail?: string
  ): void {
    if (!this.shouldLog()) return;
    const meta = EDITOR_META[editor];
    const statusIcon =
      status === 'pending' ? chalk.gray('○') :
      status === 'active' ? chalk.cyan(SPINNER_FRAMES[0]) :
      status === 'ok' ? chalk.green('●') :
      status === 'skip' ? chalk.gray('◌') :
      chalk.yellow('◆');

    const label = chalk.bold(`${meta.icon} ${meta.label}`);
    const extra = detail ? chalk.gray(` — ${detail}`) : '';
    console.log(`     ${statusIcon} ${label}${extra}`);
  }

  static sessionSaved(fileName: string, kind: 'encrypted' | 'plain' | 'skip' | 'summary'): void {
    if (!this.shouldLog()) return;
    const tag =
      kind === 'encrypted' ? chalk.green('🔐 guardada') :
      kind === 'plain' ? chalk.green('💾 guardada') :
      kind === 'summary' ? chalk.magenta('📝 resumen') :
      chalk.gray('⏭️  sin cambios');
    console.log(`     ${tag}  ${chalk.gray(fileName)}`);
  }

  static summaryBox(title: string, rows: Array<[string, string]>): void {
    if (!this.shouldLog()) return;
    console.log('');
    console.log(chalk.bold(`  📊 ${title}`));
    for (const [key, value] of rows) {
      console.log(`     ${chalk.gray(key.padEnd(14))} ${value}`);
    }
  }

  static nextSteps(steps: string[]): void {
    if (!this.shouldLog()) return;
    console.log('');
    console.log(chalk.bold('  👉 Próximos pasos'));
    steps.forEach((s, i) => {
      console.log(chalk.cyan(`     ${i + 1}.`), s);
    });
    console.log('');
  }

  static copyBlock(label: string, text: string): void {
    if (!this.shouldLog()) return;
    console.log('');
    console.log(chalk.bold(`  📋 ${label}`));
    console.log(chalk.whiteBright(`     ${text}`));
    console.log('');
  }

  /**
   * Explains the official @file flow: new chat → paste @path → optional prompt.
   */
  static howToUseAtPath(
    editorLabel: string,
    filePath: string,
    options: { samplePrompt?: string; note?: string } = {}
  ): void {
    if (!this.shouldLog()) return;
    const atRef = filePath.startsWith('@') ? filePath : `@${filePath}`;

    console.log('');
    console.log(chalk.bold(`  📋 Cómo usar esto en ${editorLabel}`));
    console.log(chalk.gray('     Relay no puede meter el chat en el historial del editor.'));
    console.log(chalk.gray('     El truco es abrir un chat nuevo y adjuntar el archivo con @'));
    console.log('');
    console.log(chalk.cyan('     1.'), 'Abrí un', chalk.bold('chat nuevo'), `en ${editorLabel}`);
    console.log(chalk.cyan('     2.'), 'En el cuadro de mensaje, pegá o escribí:');
    console.log('');
    console.log(chalk.whiteBright.bold(`        ${atRef}`));
    console.log('');
    if (options.samplePrompt) {
      console.log(chalk.cyan('     3.'), 'Debajo (mismo mensaje o el siguiente), agregá algo como:');
      console.log(chalk.gray(`        "${options.samplePrompt}"`));
      console.log('');
    } else {
      console.log(chalk.cyan('     3.'), 'Pedile que explique en qué quedaron antes de ejecutar cosas.');
      console.log('');
    }
    if (options.note) {
      console.log(chalk.yellow('     💡'), chalk.gray(options.note));
      console.log('');
    }
  }

  /** Run async work with a spinner line (TTY-friendly, no extra deps) */
  static async withSpinner<T>(
    label: string,
    fn: () => Promise<T>
  ): Promise<T> {
    if (!this.shouldLog() || !process.stdout.isTTY) {
      return fn();
    }

    let frame = 0;
    const write = () => {
      process.stdout.write(
        `\r  ${chalk.cyan(SPINNER_FRAMES[frame % SPINNER_FRAMES.length])} ${label}...`
      );
      frame++;
    };

    write();
    const timer = setInterval(write, 80);

    try {
      const result = await fn();
      clearInterval(timer);
      process.stdout.write(`\r  ${chalk.green('✓')} ${label}\n`);
      return result;
    } catch (e) {
      clearInterval(timer);
      process.stdout.write(`\r  ${chalk.red('✗')} ${label}\n`);
      throw e;
    }
  }
}
