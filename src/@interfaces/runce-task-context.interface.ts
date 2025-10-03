import { Config } from './config.interface.js';

export interface RunceTaskContext {
  log: (...args: any[]) => void;
  config: Config;
  /** Optional DI hooks (e.g., db clients) */
  services?: Record<string, unknown>;
}