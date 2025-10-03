import { defineConfig } from '../src/types.js';

export default defineConfig({
  tasksDir: './tasks',
  tracker: {
    type: 'file',
    options: {
      path: './.runce-ts.json',
    },
  },
  lock: {
    enabled: false,
    ttlMs: 60_000, // 1 minute
    owner: process.env.HOSTNAME || `runce-${process.pid}`,
  },
  dryRun: false,
});