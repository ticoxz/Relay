import { BackupManager } from '../src/core/backup';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('BackupManager', () => {
  const testDir = path.join(os.tmpdir(), 'contextvc-test-backup');
  const originalCwd = process.cwd();

  beforeAll(() => {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    process.chdir(testDir);
  });

  afterAll(() => {
    process.chdir(originalCwd);
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  beforeEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testDir, { recursive: true });
  });

  describe('createBackup', () => {
    it('should return null if file does not exist', () => {
      const result = BackupManager.createBackup(path.join(testDir, 'nonexistent.txt'));
      expect(result).toBeNull();
    });

    it('should create backup of existing file', () => {
      const testFile = path.join(testDir, 'test.txt');
      fs.writeFileSync(testFile, 'test content');

      const backupPath = BackupManager.createBackup(testFile);

      expect(backupPath).not.toBeNull();
      expect(fs.existsSync(backupPath!)).toBe(true);
      expect(fs.readFileSync(backupPath!, 'utf-8')).toBe('test content');
    });
  });

  describe('createDirectoryBackup', () => {
    it('should return null if directory does not exist', () => {
      const result = BackupManager.createDirectoryBackup(path.join(testDir, 'nonexistent'));
      expect(result).toBeNull();
    });

    it('should create backup of directory', () => {
      const testDirPath = path.join(testDir, 'testdir');
      fs.mkdirSync(testDirPath);
      fs.writeFileSync(path.join(testDirPath, 'file.txt'), 'content');

      const backupPath = BackupManager.createDirectoryBackup(testDirPath);

      expect(backupPath).not.toBeNull();
      expect(fs.existsSync(backupPath!)).toBe(true);
      expect(fs.existsSync(path.join(backupPath!, 'file.txt'))).toBe(true);
    });
  });
});