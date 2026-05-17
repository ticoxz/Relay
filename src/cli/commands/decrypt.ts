import { Command } from 'commander';
import { AgeEncryption } from '../../encryption/age';
import fs from 'fs';
import path from 'path';

export const decryptCommand = new Command('decrypt')
  .description('Desencripta los archivos .age para lectura manual')
  .argument('<file>', 'El archivo .age a desencriptar')
  .action((file: string) => {
    try {
      const fullPath = path.resolve(file);
      if (!fs.existsSync(fullPath)) {
        throw new Error(`El archivo ${file} no existe.`);
      }

      const content = AgeEncryption.decrypt(fullPath);
      console.log('--- Contenido Desencriptado ---');
      console.log(content);
      console.log('-------------------------------');
    } catch (error: any) {
      console.error('❌ Error al desencriptar:', error.message);
    }
  });
