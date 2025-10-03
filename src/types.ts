export interface RunceTaskContext {
  log: (...args: any[]) => void;
  config: Config;
  /** Optional DI hooks (e.g., db clients) */
  services?: Record<string, unknown>;
}

export interface RunceTask {
  id: string;   // canonical, stable id (often timestamped)
  title?: string;
  run(ctx: RunceTaskContext): Promise<void>;
  alreadyDone?: (ctx: RunceTaskContext) => Promise<boolean>;
}

export interface Config {
  tasksDir: string;
  tracker: {
    type: 'mongo' | 'file' | 'postgres' | string; // extensible
    options: Record<string, unknown>;             // passed to tracker.init
  };
  lock?: {
    enabled: boolean;
    /** lease duration in ms */
    ttlMs: number;
    /** best-effort owner id for diagnostics */
    owner?: string;
  };
  dryRun?: boolean;
}

export function defineConfig(config: Config): Config {
  return config;
}