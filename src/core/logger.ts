import { Logger } from '../interfaces/logger.interface.js';

export { Logger } from '../interfaces/logger.interface.js';

export function createLogger(prefix?: string): Logger {
  return (...args: any[]) => {
    const timestamp = new Date().toISOString();
    const prefixStr = prefix ? `[${prefix}]` : '';
    console.log(`${timestamp} ${prefixStr}`, ...args);
  };
}