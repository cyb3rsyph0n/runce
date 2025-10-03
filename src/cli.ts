#!/usr/bin/env node

import { program } from 'commander';
import path from 'path';
import fs from 'fs/promises';
import { runWithConfig, listApplied } from './index.js';
import { createLogger } from './core/logger.js';
import { createTracker } from './trackers/factory.js';
import { loadTasks } from './core/loader.js';
import { runTasks } from './core/runner.js';
import { Config } from './types.js';

const log = createLogger('runce-cli');

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

program
  .name('runce')
  .description('Run one-time tasks for Node.js services')
  .version('1.0.0');

program
  .command('run')
  .description('Run pending tasks')
  .option('-c, --config <path>', 'Config file path', './config/runce.config.ts')
  .option('--tasks-dir <path>', 'Tasks directory')
  .option('--dry-run', 'Show what would run without executing')
  .option('--only <ids>', 'Run only specific task IDs (comma-separated)')
  .option('--since <id>', 'Run tasks since this ID')
  .option('--until <id>', 'Run tasks until this ID')
  .action(async (options) => {
    try {
      const config = await loadConfig(options.config);

      // Override config with CLI options
      if (options.dryRun) config.dryRun = true;
      if (options.tasksDir) config.tasksDir = options.tasksDir;

      const tracker = createTracker(config.tracker.type);
      await tracker.init(config.tracker.options);

      try {
        const tasks = await loadTasks(config.tasksDir);
        const runceLog = createLogger('runce');

        const filters: any = {};
        if (options.only) filters.only = options.only.split(',');
        if (options.since) filters.since = options.since;
        if (options.until) filters.until = options.until;

        await runTasks({
          tracker,
          tasks,
          config,
          log: runceLog,
          dryRun: config.dryRun,
          filters: Object.keys(filters).length > 0 ? filters : undefined,
        });
      } finally {
        if ('close' in tracker && typeof tracker.close === 'function') {
          await tracker.close();
        }
      }
    } catch (error: any) {
      log('ERROR:', error.message);
      process.exit(1);
    }
  });

program
  .command('list')
  .description('List applied tasks')
  .option('-c, --config <path>', 'Config file path', './config/runce.config.ts')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    try {
      const records = await listApplied(options.config);

      if (options.json) {
        console.log(JSON.stringify(records, null, 2));
      } else {
        if (records.length === 0) {
          log('No tasks have been applied');
          return;
        }

        log('Applied tasks:');
        for (const record of records) {
          const status = record.status === 'success' ? '✓' : '✗';
          const duration = `${record.durationMs}ms`;
          const date = new Date(record.appliedAt).toISOString();
          log(`  ${status} ${record.id} (${duration}) - ${date}`);
          if (record.error) {
            log(`    ERROR: ${record.error}`);
          }
        }
      }
    } catch (error: any) {
      log('ERROR:', error.message);
      process.exit(1);
    }
  });

program
  .command('make')
  .description('Create a new task file')
  .argument('<name>', 'Human-readable task name')
  .option('--tasks-dir <path>', 'Tasks directory', './tasks')
  .action(async (name: string, options) => {
    try {
      const timestamp = new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15);
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      const id = `${timestamp}.${slug}`;
      const filename = `${id}.ts`;
      const filePath = path.join(options.tasksDir, filename);

      const template = `import { RunceTask } from '@nurv/runce';

const task: RunceTask = {
  id: '${id}',
  title: '${name}',
  async run({ log }) {
    log('Starting task: ${name}');
    
    // TODO: Implement your one-time logic here
    // Examples:
    // - Create database indexes
    // - Initialize S3 buckets
    // - Seed data
    // - Call external APIs
    
    log('Task completed successfully');
  },
  
  // Optional: check if task is already done
  // async alreadyDone({ log }) {
  //   log('Checking if task is already done...');
  //   // Return true if task should be skipped
  //   return false;
  // },
};

export default task;
`;

      // Ensure tasks directory exists
      await fs.mkdir(options.tasksDir, { recursive: true });

      // Check if file already exists
      try {
        await fs.access(filePath);
        log('ERROR: Task file already exists:', filePath);
        process.exit(1);
      } catch {
        // File doesn't exist, which is what we want
      }

      await fs.writeFile(filePath, template, 'utf-8');
      log('Created task file:', filePath);
      log('Task ID:', id);

    } catch (error: any) {
      log('ERROR:', error.message);
      process.exit(1);
    }
  });

program.parse();