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