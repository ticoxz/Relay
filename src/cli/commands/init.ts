import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import os from 'os';
import inquirer from 'inquirer';
import { HookInstaller } from '../../hooks/installer';
import { ConfigManager } from '../../core/config';
import { Logger } from '../../core/logger';

const INIT_STEPS = 5;

export const initCommand = new Command('init')
  .description('Inicializa Relay en el repositorio actual con wizard interactivo')
  .option('-y, --yes', 'Usa configuraciones por defecto sin preguntar')
  .action(async (options) => {
    const isAuto = options.yes;

    Logger.banner('init', 'Configuración del proyecto');
    Logger.header('🚀 Inicialización');

    try {
      const cwd = process.cwd();
      const gitDir = path.join(cwd, '.git');
      if (!fs.existsSync(gitDir)) {
        Logger.error('No se encontró un repositorio Git. Ejecutá git init primero.');
        process.exit(1);
      }

      Logger.step(1, INIT_STEPS, 'Creando estructura .ai-memory/', '📁');
      const memoryDir = path.join(cwd, '.ai-memory');
      const sessionsDir = path.join(memoryDir, 'sessions');
      const summariesDir = path.join(memoryDir, 'summaries');

      if (!fs.existsSync(memoryDir)) {
        fs.mkdirSync(memoryDir, { recursive: true });
        fs.mkdirSync(sessionsDir, { recursive: true });
        fs.mkdirSync(summariesDir, { recursive: true });
        Logger.success('Carpetas creadas');
      } else {
        Logger.info('.ai-memory/ ya existe');
      }

      let config: Record<string, unknown> = {};

      if (!isAuto) {
        Logger.step(2, INIT_STEPS, 'Opciones de Relay', '⚙️');
        const answers = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'encryption',
            message: '¿Encriptar sesiones con age? (recomendado para equipos)',
            default: true,
          },
          {
            type: 'confirm',
            name: 'hasOpenAI',
            message: '¿Tenés API key de OpenAI para resumir sesiones largas?',
            default: false,
          },
          {
            type: 'input',
            name: 'openaiKey',
            message: 'OpenAI API Key (opcional):',
            when: (answers) => answers.hasOpenAI,
            filter: (input: string) => input.trim(),
          },
          {
            type: 'list',
            name: 'summarizer',
            message: 'Resumen de sesiones largas:',
            choices: [
              { name: '🏠 Local (rápido, gratis)', value: 'local' },
              { name: '🤖 OpenAI (mejor calidad)', value: 'openai' },
              { name: '📄 Sin resumen (todo completo)', value: 'none' },
            ],
            default: 'local',
          },
        ]);

        config = {
          encryption: { enabled: answers.encryption },
          summarizer: {
            provider: answers.summarizer,
            ...(answers.openaiKey && { openaiApiKey: answers.openaiKey }),
          },
        };
      } else {
        Logger.step(2, INIT_STEPS, 'Modo automático (--yes)', '⚡');
        Logger.dim('Encriptación + resumen local por defecto');
      }

      Logger.step(3, INIT_STEPS, 'Guardando config.json', '💾');
      ConfigManager.init(config);
      Logger.success('Configuración guardada');

      Logger.step(4, INIT_STEPS, 'Instalando Git hooks', '🪝');
      try {
        HookInstaller.installAll();
        Logger.success('Hooks instalados (pre-commit, post-checkout, post-merge)');
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        Logger.warn('No se pudieron instalar hooks: ' + msg);
      }

      Logger.step(5, INIT_STEPS, 'Verificando dependencias', '🔎');
      const missingDeps: string[] = [];

      try {
        require('child_process').execSync('age --version', { stdio: 'ignore' });
        Logger.success('age detectado');
      } catch {
        missingDeps.push('age');
        Logger.warn('Instalá age: https://github.com/FiloSottile/age');
      }

      const sshDir = path.join(os.homedir(), '.ssh');
      const hasSshKey =
        fs.existsSync(path.join(sshDir, 'id_ed25519')) ||
        fs.existsSync(path.join(sshDir, 'id_rsa'));
      if (hasSshKey) {
        Logger.success('SSH key detectada');
      } else {
        Logger.warn('Generá una SSH key: ssh-keygen -t ed25519');
      }

      if (missingDeps.length > 0) {
        Logger.warn(`Pendiente: ${missingDeps.join(', ')}`);
      }

      Logger.divider();
      Logger.success('¡Relay listo!');
      Logger.nextSteps([
        'relay team auto-add',
        'relay sync --handoff',
        'relay status',
      ]);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      Logger.error('Error durante la inicialización: ' + msg);
      process.exit(1);
    }
  });
