import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { ConfigManager } from '../core/config';

export class AgeEncryption {
  private static getRecipientsFile(): string {
    const config = ConfigManager.load();
    if (config?.encryption?.recipientsFile) {
      return path.resolve(config.encryption.recipientsFile);
    }
    return path.join(process.cwd(), '.ai-memory', 'recipients.txt');
  }

  static isAvailable(): boolean {
    try {
      execSync('age --version', { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  static findSshKeys(): string[] {
    const sshDir = path.join(os.homedir(), '.ssh');
    if (!fs.existsSync(sshDir)) return [];
    
    return fs.readdirSync(sshDir)
      .filter(f => f.endsWith('.pub'))
      .map(f => path.join(sshDir, f));
  }

  /**
   * Encripta un string y lo guarda en un archivo .age
   */
  static encrypt(content: string, outputPath: string): void {
    const recipientsFile = this.getRecipientsFile();
    if (!fs.existsSync(recipientsFile)) {
      throw new Error('No se han configurado destinatarios. Ejecuta "relay team add" primero.');
    }

    const tempInput = path.join(os.tmpdir(), `cvc-${Date.now()}.json`);
    fs.writeFileSync(tempInput, content);

    try {
      execSync(`age -R "${recipientsFile}" -o "${outputPath}" "${tempInput}"`);
    } finally {
      if (fs.existsSync(tempInput)) fs.unlinkSync(tempInput);
    }
  }

  /**
   * Desencripta un archivo .age y devuelve el contenido como string
   */
  static decrypt(inputPath: string): string {
    const identityFile = path.join(os.homedir(), '.ssh', 'id_ed25519');
    
    if (!fs.existsSync(identityFile)) {
      throw new Error(`No se encontró la llave privada en ${identityFile}`);
    }

    try {
      const buffer = execSync(`age -d -i "${identityFile}" "${inputPath}"`);
      return buffer.toString('utf-8');
    } catch (error: any) {
      throw new Error(`Error al desencriptar: ${error.message}`);
    }
  }

  /**
   * Añade una llave pública al archivo de recipients
   */
  static addRecipient(publicKey: string): void {
    const recipientsFile = this.getRecipientsFile();
    const dir = path.dirname(recipientsFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    fs.appendFileSync(recipientsFile, `${publicKey}\n`);
  }

  static getRecipients(): string[] {
    const recipientsFile = this.getRecipientsFile();
    if (!fs.existsSync(recipientsFile)) return [];
    return fs.readFileSync(recipientsFile, 'utf-8').split('\n').filter(line => line.trim() !== '');
  }
}
