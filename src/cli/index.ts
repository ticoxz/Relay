#!/usr/bin/env node

import { Command } from 'commander';
import { initCommand } from './commands/init';
import { syncCommand } from './commands/sync';
import { teamCommand } from './commands/team';
import { decryptCommand } from './commands/decrypt';
import { mergeCommand } from './commands/merge';
import { installHooksCommand } from './commands/install-hooks';
import { injectCommand, pullCommand, pushCommand } from './commands/inject';
import { statusCommand } from './commands/status';
import { handoffCommand } from './commands/handoff';
import { doctorCommand } from './commands/doctor';

const program = new Command();

program
  .name('relay')
  .description('Relay — Git para sesiones de IA entre editores y tu equipo')
  .version('1.3.1');

program.addCommand(initCommand);
program.addCommand(syncCommand);
program.addCommand(teamCommand);
program.addCommand(decryptCommand);
program.addCommand(mergeCommand);
program.addCommand(installHooksCommand);
program.addCommand(injectCommand);
program.addCommand(pullCommand);
program.addCommand(pushCommand);
program.addCommand(statusCommand);
program.addCommand(handoffCommand);
program.addCommand(doctorCommand);

program.parse(process.argv);
