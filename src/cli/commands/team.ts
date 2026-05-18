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
    Logger.banner('team add', 'Nuevo destinatario age');
    try {
      AgeEncryption.addRecipient(publicKey);
      Logger.success('Llave añadida a recipients.txt');
    } catch (error: any) {
      Logger.error('Error al añadir la llave: ' + error.message);
    }
  });

teamCommand
  .command('list')
  .description('Lista los destinatarios autorizados')
  .action(() => {
    Logger.banner('team list', 'Destinatarios age');
    const recipients = AgeEncryption.getRecipients();
    if (recipients.length === 0) {
      Logger.warn('No hay destinatarios. Usá relay team auto-add');
    } else {
      recipients.forEach((r, i) => Logger.dim(`${i + 1}. ${r.substring(0, 60)}${r.length > 60 ? '…' : ''}`));
    }
  });

teamCommand
  .command('auto-add')
  .description('Detecta automáticamente tus llaves SSH públicas y las añade')
  .action(() => {
    Logger.banner('team auto-add', 'Detectar ~/.ssh');
    try {
      const sshKeys = AgeEncryption.findSshKeys();
      if (sshKeys.length === 0) {
        Logger.error('No hay llaves SSH públicas en ~/.ssh/');
        return;
      }

      Logger.phase('🔑', `${sshKeys.length} llave(s) encontrada(s)`);
      sshKeys.forEach(k => Logger.dim(k));

      sshKeys.forEach(keyPath => {
        const content = fs.readFileSync(keyPath, 'utf-8').trim();
        AgeEncryption.addRecipient(content);
      });

      Logger.success(`${sshKeys.length} llave(s) añadida(s)`);
    } catch (error: any) {
      Logger.error('Error al detectar llaves SSH: ' + error.message);
    }
  });

export { teamCommand };
