import { Command } from 'commander';
import { AgeEncryption } from '../../encryption/age';
import { ConfigManager } from '../../core/config';
import { Logger } from '../../core/logger';
import fs from 'fs';
import path from 'path';

const teamCommand = new Command('team')
  .description('Gestión de equipo y llaves de acceso');

teamCommand
  .command('add <publicKey>')
  .description('Añade la llave pública de un colaborador para que pueda desencriptar los chats')
  .action((publicKey: string) => {
    try {
      AgeEncryption.addRecipient(publicKey);
      Logger.success('Llave añadida correctamente a la lista de destinatarios.');
    } catch (error: any) {
      Logger.error('Error al añadir la llave: ' + error.message);
    }
  });

teamCommand
  .command('list')
  .description('Lista los destinatarios autorizados')
  .action(() => {
    const recipients = AgeEncryption.getRecipients();
    if (recipients.length === 0) {
      Logger.warn('No hay destinatarios configurados.');
    } else {
      Logger.info('Destinatarios autorizados:');
      recipients.forEach(r => console.log(` - ${r.substring(0, 50)}${r.length > 50 ? '...' : ''}`));
    }
  });

teamCommand
  .command('auto-add')
  .description('Detecta automáticamente tus llaves SSH públicas y las añade')
  .action(() => {
    try {
      const sshKeys = AgeEncryption.findSshKeys();
      if (sshKeys.length === 0) {
        Logger.error('No se encontraron llaves SSH públicas en ~/.ssh/');
        return;
      }

      Logger.info(`Se encontraron ${sshKeys.length} llave(s) SSH:`);
      sshKeys.forEach(k => console.log(`  - ${k}`));

      sshKeys.forEach(keyPath => {
        const content = fs.readFileSync(keyPath, 'utf-8').trim();
        AgeEncryption.addRecipient(content);
      });

      Logger.success(`${sshKeys.length} llave(s) añadida(s) a la lista de destinatarios.`);
    } catch (error: any) {
      Logger.error('Error al detectar llaves SSH: ' + error.message);
    }
  });

export { teamCommand };
