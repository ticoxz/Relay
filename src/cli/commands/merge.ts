import { Command } from 'commander';
import { AgeEncryption } from '../../encryption/age';
import { MergeEngine } from '../../sync/merge';
import { OpenCodeSession } from '../../plugin/storage-reader';
import fs from 'fs';
import path from 'path';

export const mergeCommand = new Command('merge')
  .description('Resuelve un conflicto entre dos archivos de sesión encriptados')
  .argument('<ours>', 'Tu versión del archivo .age')
  .argument('<theirs>', 'La versión entrante del archivo .age')
  .argument('[output]', 'Dónde guardar el resultado (sobrescribe "ours" por defecto)')
  .action((ours: string, theirs: string, output?: string) => {
    try {
      const oursPath = path.resolve(ours);
      const theirsPath = path.resolve(theirs);
      const outputPath = output ? path.resolve(output) : oursPath;

      if (!fs.existsSync(oursPath)) throw new Error(`El archivo local no existe: ${oursPath}`);
      if (!fs.existsSync(theirsPath)) throw new Error(`El archivo remoto no existe: ${theirsPath}`);

      console.log('🔄 Desencriptando ambas versiones...');
      const oursContent = AgeEncryption.decrypt(oursPath);
      const theirsContent = AgeEncryption.decrypt(theirsPath);

      const oursSession = JSON.parse(oursContent) as OpenCodeSession;
      const theirsSession = JSON.parse(theirsContent) as OpenCodeSession;

      console.log(`Fusionando sesión ${oursSession.id}...`);
      const mergedSession = MergeEngine.mergeSessions(oursSession, theirsSession);

      console.log('🔒 Encriptando resultado fusionado...');
      const mergedContent = JSON.stringify(mergedSession, null, 2);
      
      // Aseguramos escribir el archivo final
      AgeEncryption.encrypt(mergedContent, outputPath);

      console.log(`✅ Fusión exitosa. Archivo guardado en: ${outputPath}`);
      console.log('Recuerda hacer `git add` del archivo fusionado.');

    } catch (error: any) {
      console.error('❌ Error durante la resolución de conflictos:', error.message);
    }
  });
