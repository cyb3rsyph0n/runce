export default {
  tasksDir: './tasks',
  tracker: {
    type: 'file',
    options: {
      path: './.runce.json',
    },
  },
  lock: {
    enabled: false, // File tracker doesn't support locking yet
    ttlMs: 60_000,
    owner: process.env.HOSTNAME || `runce-${process.pid}`,
  },
  dryRun: false,
};