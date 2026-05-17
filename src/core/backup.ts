import fs from 'fs';
import path from 'path';

export class BackupManager {
  static createBackup(filePath: string): string | null {
    try {
      if (!fs.existsSync(filePath)) return null;
      
      const backupDir = path.join(path.dirname(filePath), '.backups');
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }
      
      const fileName = path.basename(filePath);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(backupDir, `${fileName}.${timestamp}.bak`);
      
      fs.copyFileSync(filePath, backupPath);
      return backupPath;
    } catch (error) {
      console.warn('No se pudo crear backup:', error);
      return null;
    }
  }

  static createDirectoryBackup(dirPath: string): string | null {
    try {
      if (!fs.existsSync(dirPath)) return null;
      
      const backupDir = path.join(path.dirname(dirPath), '.backups');
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }
      
      const dirName = path.basename(dirPath);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(backupDir, `${dirName}.${timestamp}`);
      
      // Simple copy for directories
      this.copyDir(dirPath, backupPath);
      return backupPath;
    } catch (error) {
      console.warn('No se pudo crear backup del directorio:', error);
      return null;
    }
  }

  private static copyDir(src: string, dest: string): void {
    fs.mkdirSync(dest, { recursive: true });
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      if (entry.isDirectory()) {
        this.copyDir(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }
}
