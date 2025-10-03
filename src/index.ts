export { RunceTask, RunceTaskContext, Config, defineConfig } from './types.js';
export { ITracker, AppliedRecord } from './trackers/tracker.js';
export { MongoTracker } from './trackers/mongo-tracker.js';
export { runTasks } from './core/runner.js';
export { loadTasks } from './core/loader.js';
export { createLogger } from './core/logger.js';

import path from 'path';
import { createTracker } from './trackers/factory.js';
import { loadTasks } from './core/loader.js';
import { runTasks } from './core/runner.js';
import { createLogger } from './core/logger.js';
import { Config } from './types.js';

export async function runWithConfig(configPath: string): Promise<void> {
  const config = await loadConfig(configPath);
  await runWithConfigObject(config);
}

export async function runWithConfigObject(config: Config): Promise<void> {
  const tracker = createTracker(config.tracker.type);
  await tracker.init(config.tracker.options);

  try {
    const tasks = await loadTasks(config.tasksDir);
    const log = createLogger('runce');

    await runTasks({
      tracker,
      tasks,
      config,
      log,
      dryRun: config.dryRun,
    });
  } finally {
    if ('close' in tracker && typeof tracker.close === 'function') {
      await tracker.close();
    }
  }
}

export async function listApplied(configPath: string): Promise<any[]> {
  const config = await loadConfig(configPath);
  return await listAppliedWithConfig(config);
}

export async function listAppliedWithConfig(config: Config): Promise<any[]> {
  const tracker = createTracker(config.tracker.type);
  await tracker.init(config.tracker.options);

  try {
    return await tracker.listApplied();
  } finally {
    if ('close' in tracker && typeof tracker.close === 'function') {
      await tracker.close();
    }
  }
}

async function loadConfig(configPath: string): Promise<Config> {
  try {
    const absolutePath = path.resolve(configPath);
    const { pathToFileURL } = await import('url');
    const fileUrl = pathToFileURL(absolutePath).href;
    const module = await import(fileUrl);
    return module.default || module;
  } catch (error) {
    throw new Error(`Failed to load config from ${configPath}: ${error}`);
  }
}