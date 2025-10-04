import { ITracker } from '../trackers/tracker.js';
import { LoadedTask } from './loader.js';
import { Config, RunceTaskContext } from '../types.js';
import { LockManager } from './lock.js';
import { Logger } from './logger.js';

export { RunTasksOptions } from '../@interfaces/run-tasks-options.interface.js';
import { RunTasksOptions } from '../@interfaces/run-tasks-options.interface.js';

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
    // Separate run-always tasks from run-once tasks
    const runAlwaysTasks = filteredTasks.filter(t => t.task.runAlways === true);
    const runOnceTasks = filteredTasks.filter(t => t.task.runAlways !== true);

    // Execute run-always tasks first
    if (runAlwaysTasks.length > 0) {
      log(`Running ${runAlwaysTasks.length} always-run task(s)...`);
      for (const loadedTask of runAlwaysTasks) {
        await executeTask(loadedTask, tracker, config, log, dryRun, false); // false = don't track completion
      }
    }

    // Execute run-once tasks
    if (runOnceTasks.length > 0) {
      const appliedIds = await tracker.getAppliedIds();
      log(`Running pending one-time tasks...`);

      for (const loadedTask of runOnceTasks) {
        const { task } = loadedTask;

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

        await executeTask(loadedTask, tracker, config, log, dryRun, true); // true = track completion
      }
    }
  } finally {
    if (lockManager) {
      await lockManager.release();
      log('LOCK: Released');
    }
  }
}

async function executeTask(
  loadedTask: LoadedTask,
  tracker: ITracker,
  config: Config,
  log: Logger,
  dryRun: boolean,
  trackCompletion: boolean
): Promise<void> {
  const { task, checksum } = loadedTask;
  const started = Date.now();

  if (dryRun) {
    const taskType = task.runAlways ? 'ALWAYS' : 'ONCE';
    log(`DRY-RUN [${taskType}]:`, task.id, task.title || '');
    return;
  }

  try {
    const ctx: RunceTaskContext = {
      log: (...args: any[]) => log('  ', ...args),
      config,
    };

    const taskType = task.runAlways ? 'ALWAYS' : 'RUN';
    log(`${taskType}:`, task.id, task.title || '');
    await task.run(ctx);

    const durationMs = Date.now() - started;

    // Only record completion for run-once tasks
    if (trackCompletion) {
      const record = {
        id: task.id,
        name: task.title || task.id,
        checksum,
        appliedAt: new Date(),
        durationMs,
        status: 'success' as const,
      };

      await tracker.recordApplied(record);
    }

    log('OK:', task.id, `(${durationMs}ms)`);

  } catch (error: any) {
    const durationMs = Date.now() - started;

    // Record failures for both types for debugging purposes
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