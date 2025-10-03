import { ITracker } from '../trackers/tracker.js';
import { LoadedTask } from './loader.js';
import { Config, RunceTaskContext } from '../types.js';
import { LockManager } from './lock.js';
import { Logger } from './logger.js';

export { RunTasksOptions } from '../interfaces/run-tasks-options.interface.js';
import { RunTasksOptions } from '../interfaces/run-tasks-options.interface.js';

export async function runTasks(opts: RunTasksOptions): Promise<void> {
  const { tracker, tasks, config, log, dryRun = false, filters } = opts;

  // Apply filters
  let filteredTasks = tasks;

  if (filters?.only) {
    filteredTasks = filteredTasks.filter(t => filters.only!.includes(t.task.id));
  }

  if (filters?.since) {
    filteredTasks = filteredTasks.filter(t => t.task.id >= filters.since!);
  }

  if (filters?.until) {
    filteredTasks = filteredTasks.filter(t => t.task.id <= filters.until!);
  }

  // Acquire lock if enabled
  let lockManager: LockManager | undefined;
  if (config.lock?.enabled) {
    const owner = config.lock.owner || `runce-${process.pid}-${Date.now()}`;
    lockManager = new LockManager(tracker, owner, config.lock.ttlMs);

    const acquired = await lockManager.acquire();
    if (!acquired) {
      log('FAIL: Could not acquire lock, another process may be running');
      process.exitCode = 1;
      return;
    }
    log('LOCK: Acquired');
  }

  try {
    // Get already applied tasks
    const appliedIds = await tracker.getAppliedIds();

    for (const loadedTask of filteredTasks) {
      const { task, checksum } = loadedTask;

      if (appliedIds.has(task.id)) {
        log('SKIP:', task.id, '(already applied)');
        continue;
      }

      // Check if task says it's already done
      if (task.alreadyDone) {
        const ctx: RunceTaskContext = {
          log: (...args: any[]) => log('  ', ...args),
          config,
        };

        try {
          const isDone = await task.alreadyDone(ctx);
          if (isDone) {
            log('SKIP:', task.id, '(alreadyDone check)');
            continue;
          }
        } catch (error) {
          log('WARN:', task.id, 'alreadyDone check failed:', error);
        }
      }

      const started = Date.now();

      if (dryRun) {
        log('DRY-RUN:', task.id, task.title || '');
        continue;
      }

      try {
        const ctx: RunceTaskContext = {
          log: (...args: any[]) => log('  ', ...args),
          config,
        };

        log('RUN:', task.id, task.title || '');
        await task.run(ctx);

        const durationMs = Date.now() - started;
        const record = {
          id: task.id,
          name: task.title || task.id,
          checksum,
          appliedAt: new Date(),
          durationMs,
          status: 'success' as const,
        };

        await tracker.recordApplied(record);
        log('OK:', task.id, `(${durationMs}ms)`);

      } catch (error: any) {
        const durationMs = Date.now() - started;
        const record = {
          id: task.id,
          name: task.title || task.id,
          checksum,
          appliedAt: new Date(),
          durationMs,
          status: 'failed' as const,
          error: String(error?.stack || error?.message || error),
        };

        await tracker.recordApplied(record);
        log('FAIL:', task.id, `(${durationMs}ms)`, error?.message || error);
        process.exitCode = 1;
      }
    }
  } finally {
    if (lockManager) {
      await lockManager.release();
      log('LOCK: Released');
    }
  }
}