import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import inquirer from 'inquirer';
import { HookInstaller } from '../../hooks/installer';
import { ConfigManager } from '../../core/config';
import { Logger } from '../../core/logger';
import { BackupManager } from '../../core/backup';

export const initCommand = new Command('init')
  .description('Inicializa contextvc en el repositorio actual con wizard interactivo')
  .option('-y, --yes', 'Usa configuraciones por defecto sin preguntar')
  .action(async (options) => {
    const isAuto = options.yes;
    
    Logger.header('🚀 Context Version Control - Inicialización');
    
    try {
      // 1. Validar que estamos en un repo git
      const cwd = process.cwd();
      const gitDir = path.join(cwd, '.git');
      if (!fs.existsSync(gitDir)) {
        Logger.error('No se encontró un repositorio Git. Ejecuta "git init" primero.');
        process.exit(1);
      }

      // 2. Crear estructura de carpetas
      Logger.step(1, 'Creando estructura de directorios...');
      const memoryDir = path.join(cwd, '.ai-memory');
      const sessionsDir = path.join(memoryDir, 'sessions');
      const summariesDir = path.join(memoryDir, 'summaries');

      if (!fs.existsSync(memoryDir)) {
        fs.mkdirSync(memoryDir, { recursive: true });
        fs.mkdirSync(sessionsDir, { recursive: true });
        fs.mkdirSync(summariesDir, { recursive: true });
        Logger.success('Estructura .ai-memory/ creada.');
      } else {
        Logger.info('El directorio .ai-memory ya existe.');
      }

      let config: any = {};

      if (!isAuto) {
        // 3. Preguntar interactivamente
        Logger.step(2, 'Configurando opciones...');
        const answers = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'encryption',
            message: '¿Deseas encriptar las sesiones con age? (Recomendado para equipos)',
            default: true,
          },
          {
            type: 'confirm',
            name: 'hasOpenAI',
            message: '¿Tienes una API Key de OpenAI para resumir sesiones largas?',
            default: false,
          },
          {
            type: 'input',
            name: 'openaiKey',
            message: 'Tu OpenAI API Key (opcional, deja vacío si no tienes):',
            when: (answers) => answers.hasOpenAI,
            filter: (input: string) => input.trim(),
          },
          {
            type: 'list',
            name: 'summarizer',
            message: 'Método de resumen para sesiones largas:',
            choices: [
              { name: 'Compresión local (rápido, gratuito)', value: 'local' },
              { name: 'OpenAI (mejor calidad pero costo)', value: 'openai' },
              { name: 'Sin resumen (guardar todo completo)', value: 'none' },
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
        Logger.info('Modo automático: usando configuraciones por defecto.');
      }

      // 4. Guardar configuración
      Logger.step(3, 'Guardando configuración...');
      const finalConfig = ConfigManager.init(config);
      Logger.success('Configuración guardada en .ai-memory/config.json');

      // 5. Instalar Git Hooks
      Logger.step(4, 'Instalando Git Hooks...');
      try {
        HookInstaller.installPreCommit();
        Logger.success('Git hook pre-commit instalado.');
      } catch (e: any) {
        Logger.warn('No se pudieron instalar los Git Hooks: ' + e.message);
      }

      // 6. Verificar dependencias del sistema
      Logger.step(5, 'Verificando dependencias...');
      const missingDeps: string[] = [];
      
      // Verificar age
      try {
        require('child_process').execSync('age --version', { stdio: 'ignore' });
        Logger.success('age (encryption) detectado.');
      } catch {
        missingDeps.push('age');
        Logger.warn('age no está instalado. Visita: https://github.com/FiloSottile/age');
      }

      // Verificar SSH keys
      const sshDir = path.join(require('os').homedir(), '.ssh');
      const hasSshKey = fs.existsSync(path.join(sshDir, 'id_ed25519')) || fs.existsSync(path.join(sshDir, 'id_rsa'));
      if (hasSshKey) {
        Logger.success('SSH key detectada.');
      } else {
        Logger.warn('No se detectó una SSH key. Genera una con: ssh-keygen -t ed25519');
      }

      if (missingDeps.length > 0) {
        Logger.warn(`Dependencias pendientes: ${missingDeps.join(', ')}`);
      }

      // Resumen
      Logger.divider();
      Logger.success('¡ContextVC inicializado correctamente!');
      console.log('\nPróximos pasos:');
      console.log('  1. Añade llaves SSH de tu equipo: contextvc team add "ssh-ed25519 ..."');
      console.log('  2. Sincroniza tus sesiones: contextvc sync');
      console.log('  3. Ver estado: contextvc status\n');

    } catch (error: any) {
      Logger.error('Error durante la inicialización: ' + error.message);
      process.exit(1);
    }
  });
