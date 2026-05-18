import fs from 'fs';
import path from 'path';

export interface RelayConfig {
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

/** @deprecated Use RelayConfig */
export type ContextVCConfig = RelayConfig;

const DEFAULT_CONFIG: RelayConfig = {
  version: '1.3.0',
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

  static load(): RelayConfig | null {
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

  static save(config: RelayConfig): void {
    const configPath = this.getConfigPath();
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
  }

  static init(overrides?: Partial<RelayConfig>): RelayConfig {
    const config = { ...DEFAULT_CONFIG, ...overrides, initializedAt: new Date().toISOString() };
    const configPath = this.getConfigPath();
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    this.save(config);
    return config;
  }

  static update(updates: Partial<RelayConfig>): RelayConfig {
    const current = this.load() || DEFAULT_CONFIG;
    const config = { ...current, ...updates, encryption: { ...current.encryption, ...updates.encryption }, summarizer: { ...current.summarizer, ...updates.summarizer } };
    this.save(config);
    return config;
  }
}
