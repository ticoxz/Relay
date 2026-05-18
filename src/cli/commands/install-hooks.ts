import { Command } from 'commander';
import { HookInstaller } from '../../hooks/installer';
import { Logger } from '../../core/logger';

export const installHooksCommand = new Command('install-hooks')
  .description('Instala hooks Git: pre-commit (sync), post-checkout/merge (handoff)')
  .action(() => {
    try {
      Logger.banner('install-hooks', 'Automatización con Git');
      Logger.phase('🪝', 'Instalando hooks…');
      HookInstaller.installAll();
      Logger.success('Hooks instalados');
      Logger.summaryBox('Hooks', [
        ['pre-commit', 'relay sync --quiet --handoff'],
        ['post-checkout', 'relay handoff --from-repo --quiet'],
        ['post-merge', 'relay handoff --from-repo --quiet'],
      ]);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      Logger.error('Error al instalar hooks: ' + msg);
    }
  });
