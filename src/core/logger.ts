import chalk from 'chalk';

export class Logger {
  static success(message: string) {
    console.log(chalk.green('✅'), message);
  }

  static error(message: string) {
    console.error(chalk.red('❌'), message);
  }

  static warn(message: string) {
    console.warn(chalk.yellow('⚠️'), message);
  }

  static info(message: string) {
    console.log(chalk.blue('ℹ️'), message);
  }

  static step(stepNumber: number, message: string) {
    console.log(chalk.cyan(`[${stepNumber}/5]`), chalk.bold(message));
  }

  static quiet(message: string, isQuiet: boolean) {
    if (!isQuiet) {
      console.log(message);
    }
  }

  static divider() {
    console.log(chalk.gray('─'.repeat(60)));
  }

  static header(text: string) {
    console.log('\n' + chalk.bgCyan.black.bold(` ${text} `));
  }
}
