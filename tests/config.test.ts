import { ConfigManager, ContextVCConfig } from '../src/core/config';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('ConfigManager', () => {
  const testDir = path.join(os.tmpdir(), 'contextvc-test-config');
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
    const configPath = path.join(testDir, '.ai-memory', 'config.json');
    if (fs.existsSync(configPath)) {
      fs.unlinkSync(configPath);
    }
  });

  describe('init', () => {
    it('should create config file with defaults', () => {
      const config = ConfigManager.init();
      
      expect(config).toBeDefined();
      expect(config.version).toBe('1.3.3');
      expect(config.encryption.enabled).toBe(true);
      expect(config.summarizer.provider).toBe('local');
      expect(fs.existsSync(path.join(testDir, '.ai-memory', 'config.json'))).toBe(true);
    });

    it('should accept override values', () => {
      const config = ConfigManager.init({
        summarizer: { provider: 'openai', openaiApiKey: 'sk-test', model: 'gpt-4', messageThreshold: 5, sizeThresholdKb: 50 },
      });
      
      expect(config.summarizer.provider).toBe('openai');
      expect(config.summarizer.openaiApiKey).toBe('sk-test');
    });
  });

  describe('load', () => {
    it('should return null if config does not exist', () => {
      const config = ConfigManager.load();
      expect(config).toBeNull();
    });

    it('should load existing config', () => {
      ConfigManager.init();
      const loaded = ConfigManager.load();
      
      expect(loaded).not.toBeNull();
      expect(loaded!.version).toBe('1.3.3');
    });
  });

  describe('update', () => {
    it('should merge updates with existing config', () => {
      ConfigManager.init();
      
      const updated = ConfigManager.update({
        summarizer: { provider: 'openai', openaiApiKey: 'sk-test', model: 'gpt-4', messageThreshold: 5, sizeThresholdKb: 50 },
      });
      
      expect(updated.encryption.enabled).toBe(true);
      expect(updated.summarizer.provider).toBe('openai');
    });
  });
});