import fs from 'fs';
import path from 'path';

export interface ContextVCConfig {
  version: string;
  encryption: {
    enabled: boolean;
    recipientsFile: string;
  };
  summarizer: {
    provider: 'openai' | 'local' | 'none';
    openaiApiKey?: string;
    model?: string;
    messageThreshold: number;
    sizeThresholdKb: number;
  };
  editors: {
    opencode?: string;
    antigravity?: string;
    cursor?: string;
  };
  initializedAt: string;
}

const DEFAULT_CONFIG: ContextVCConfig = {
  version: '1.0.0',
  encryption: {
    enabled: true,
    recipientsFile: './.ai-memory/recipients.txt',
  },
  summarizer: {
    provider: 'local',
    model: 'gpt-4o-mini',
    messageThreshold: 10,
    sizeThresholdKb: 100,
  },
  editors: {},
  initializedAt: new Date().toISOString(),
};

export class ConfigManager {
  private static CONFIG_FILE = '.ai-memory/config.json';

  static getConfigPath(): string {
    return path.join(process.cwd(), this.CONFIG_FILE);
  }

  static load(): ContextVCConfig | null {
    try {
      const configPath = this.getConfigPath();
      if (!fs.existsSync(configPath)) return null;
      const raw = fs.readFileSync(configPath, 'utf-8');
      return JSON.parse(raw);
    } catch (error) {
      console.warn('No se pudo cargar la configuración, usando defaults.');
      return null;
    }
  }

  static save(config: ContextVCConfig): void {
    const configPath = this.getConfigPath();
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
  }

  static init(overrides?: Partial<ContextVCConfig>): ContextVCConfig {
    const config = { ...DEFAULT_CONFIG, ...overrides, initializedAt: new Date().toISOString() };
    const configPath = this.getConfigPath();
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    this.save(config);
    return config;
  }

  static update(updates: Partial<ContextVCConfig>): ContextVCConfig {
    const current = this.load() || DEFAULT_CONFIG;
    const config = { ...current, ...updates, encryption: { ...current.encryption, ...updates.encryption }, summarizer: { ...current.summarizer, ...updates.summarizer } };
    this.save(config);
    return config;
  }
}
