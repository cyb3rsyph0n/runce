export * from './interfaces/index.js';
import { Config } from './interfaces/config.interface.js';

export function defineConfig(config: Config): Config {
  return config;
}