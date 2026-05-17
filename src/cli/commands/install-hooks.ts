import { Command } from 'commander';
import { HookInstaller } from '../../hooks/installer';

export const installHooksCommand = new Command('install-hooks')
  .description('Instala hooks Git: pre-commit (sync), post-checkout/merge (handoff)')
  .action(() => {
    try {
      HookInstaller.installAll();
      console.log('');
      console.log('Hooks instalados:');
      console.log('  pre-commit    → relay sync --quiet + git add sesiones');
      console.log('  post-checkout → relay handoff --from-repo --quiet');
      console.log('  post-merge    → relay handoff --from-repo --quiet');
    } catch (error: any) {
      console.error('❌ Error al instalar los hooks:', error.message);
    }
  });
