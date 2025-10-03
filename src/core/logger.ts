export interface Logger {
  (...args: any[]): void;
}

export function createLogger(prefix?: string): Logger {
  return (...args: any[]) => {
    const timestamp = new Date().toISOString();
    const prefixStr = prefix ? `[${prefix}]` : '';
    console.log(`${timestamp} ${prefixStr}`, ...args);
  };
}