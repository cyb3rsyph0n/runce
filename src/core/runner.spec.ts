import { runTasks } from './runner.js';
import { ITracker } from '../interfaces/itracker.interface.js';
import { AppliedRecord } from '../interfaces/applied-record.interface.js';
import { LoadedTask } from '../interfaces/loaded-task.interface.js';
import { Config } from '../interfaces/config.interface.js';
import { Logger } from '../interfaces/logger.interface.js';
import { RunTasksOptions } from '../interfaces/run-tasks-options.interface.js';
import { RunceTaskContext } from '../interfaces/runce-task-context.interface.js';
import { TrackerInit } from '../interfaces/tracker-init.interface.js';

// Mock tracker for testing
class MockTracker implements ITracker {
  public appliedIds = new Set<string>();
  public appliedRecords: AppliedRecord[] = [];
  public lockAcquired = false;
  public lockReleased = false;
  public acquireLockResult = true;

  async init(cfg: TrackerInit): Promise<void> { }

  async getAppliedIds(): Promise<Set<string>> {
    return this.appliedIds;
  }

  async recordApplied(record: AppliedRecord): Promise<void> {
    this.appliedIds.add(record.id);
    this.appliedRecords.push(record);
  }

  async listApplied(): Promise<AppliedRecord[]> {
    return this.appliedRecords;
  }

  async acquireLock(owner: string, ttlMs: number): Promise<boolean> {
    this.lockAcquired = true;
    return this.acquireLockResult;
  }

  async renewLock(owner: string, ttlMs: number): Promise<boolean> {
    return true;
  }

  async releaseLock(owner: string): Promise<void> {
    this.lockReleased = true;
  }
}

describe('runTasks', () => {
  let mockTracker: MockTracker;
  let mockConfig: Config;
  let logMessages: any[][];

  const mockLogger: Logger = (...args: any[]) => {
    logMessages.push(args);
  };

  beforeEach(() => {
    mockTracker = new MockTracker();
    logMessages = [];
    mockConfig = {
      tasksDir: './tasks',
      tracker: {
        type: 'file' as const,
        options: { path: './test-tracker.json' }
      }
    };
  });

  describe('basic task execution', () => {
    test('should run a simple task successfully', async () => {
      const task: LoadedTask = {
        filePath: 'test.js',
        checksum: 'abc123',
        task: {
          id: 'test-task',
          run: async (ctx: RunceTaskContext) => {
            ctx.log('Task executed');
          }
        }
      };

      const options: RunTasksOptions = {
        tasks: [task],
        config: mockConfig,
        tracker: mockTracker,
        log: mockLogger
      };

      await runTasks(options);

      expect(mockTracker.appliedRecords).toHaveLength(1);
      expect(mockTracker.appliedRecords[0].id).toBe('test-task');
      expect(logMessages.some(msg =>
        msg.join(' ').includes('Task executed')
      )).toBe(true);
    });

    test('should skip already applied tasks', async () => {
      const task: LoadedTask = {
        filePath: 'test.js',
        checksum: 'abc123',
        task: {
          id: 'applied-task',
          run: async (ctx: RunceTaskContext) => {
            ctx.log('Should not run');
          }
        }
      };

      // Mark task as already applied
      await mockTracker.recordApplied({
        id: 'applied-task',
        name: 'applied-task',
        appliedAt: new Date(),
        checksum: 'abc123',
        durationMs: 100,
        status: 'success'
      });

      const options: RunTasksOptions = {
        tasks: [task],
        config: mockConfig,
        tracker: mockTracker,
        log: mockLogger
      };

      await runTasks(options);

      expect(mockTracker.appliedRecords).toHaveLength(1); // Still only the pre-existing one
      expect(logMessages.some(msg =>
        msg.join(' ').includes('SKIP: applied-task')
      )).toBe(true);
      expect(logMessages.some(msg =>
        msg.join(' ').includes('Should not run')
      )).toBe(false);
    });

    test('should handle task with alreadyDone check', async () => {
      const task: LoadedTask = {
        filePath: 'test.js',
        checksum: 'abc123',
        task: {
          id: 'conditional-task',
          alreadyDone: async (ctx: RunceTaskContext) => true,
          run: async (ctx: RunceTaskContext) => {
            ctx.log('Should not run due to alreadyDone');
          }
        }
      };

      const options: RunTasksOptions = {
        tasks: [task],
        config: mockConfig,
        tracker: mockTracker,
        log: mockLogger
      };

      await runTasks(options);

      expect(mockTracker.appliedRecords).toHaveLength(0);
      expect(logMessages.some(msg => {
        const message = msg.join(' ');
        return message.includes('SKIP:') &&
          message.includes('conditional-task') &&
          message.includes('(alreadyDone check)');
      })).toBe(true);
    });
  });

  describe('task context', () => {
    test('should provide context to task', async () => {
      let receivedContext: RunceTaskContext | undefined;

      const task: LoadedTask = {
        filePath: 'test.js',
        checksum: 'abc123',
        task: {
          id: 'context-task',
          run: async (context: RunceTaskContext) => {
            receivedContext = context;
          }
        }
      };

      const options: RunTasksOptions = {
        tasks: [task],
        config: mockConfig,
        tracker: mockTracker,
        log: mockLogger
      };

      await runTasks(options);

      expect(receivedContext).toBeDefined();
      expect(receivedContext!.config).toEqual(mockConfig);
      expect(typeof receivedContext!.log).toBe('function');
    });
  });

  describe('error handling', () => {
    test('should handle task execution errors', async () => {
      const task: LoadedTask = {
        filePath: 'test.js',
        checksum: 'abc123',
        task: {
          id: 'error-task',
          run: async (ctx: RunceTaskContext) => {
            throw new Error('Task failed');
          }
        }
      };

      const options: RunTasksOptions = {
        tasks: [task],
        config: mockConfig,
        tracker: mockTracker,
        log: mockLogger
      };

      // Reset process.exitCode before test
      const originalExitCode = process.exitCode;
      process.exitCode = 0;

      await runTasks(options);

      // Should record the failed task
      expect(mockTracker.appliedRecords).toHaveLength(1);
      expect(mockTracker.appliedRecords[0].status).toBe('failed');
      expect(mockTracker.appliedRecords[0].error).toContain('Task failed');
      expect(process.exitCode).toBe(1);

      // Should log the failure
      expect(logMessages.some(msg =>
        msg.join(' ').includes('FAIL: error-task')
      )).toBe(true);

      // Restore original exit code
      process.exitCode = originalExitCode;
    });

    test('should handle alreadyDone check errors', async () => {
      const task: LoadedTask = {
        filePath: 'test.js',
        checksum: 'abc123',
        task: {
          id: 'alreadyDone-error-task',
          alreadyDone: async (ctx: RunceTaskContext) => {
            throw new Error('AlreadyDone check failed');
          },
          run: async (ctx: RunceTaskContext) => {
            ctx.log('Should still run due to error');
          }
        }
      };

      const options: RunTasksOptions = {
        tasks: [task],
        config: mockConfig,
        tracker: mockTracker,
        log: mockLogger
      };

      await runTasks(options);

      // Should warn about the alreadyDone error but still run the task
      expect(logMessages.some(msg =>
        msg.join(' ').includes('WARN: alreadyDone-error-task alreadyDone check failed:')
      )).toBe(true);

      // Should have run the task
      expect(mockTracker.appliedRecords).toHaveLength(1);
      expect(mockTracker.appliedRecords[0].status).toBe('success');
      expect(logMessages.some(msg =>
        msg.join(' ').includes('Should still run due to error')
      )).toBe(true);
    });
  });

  describe('filters', () => {
    test('should filter tasks by only option', async () => {
      const tasks: LoadedTask[] = [
        {
          filePath: 'test1.js',
          checksum: 'abc123',
          task: {
            id: 'task1',
            run: async (ctx: RunceTaskContext) => {
              ctx.log('Task 1');
            }
          }
        },
        {
          filePath: 'test2.js',
          checksum: 'def456',
          task: {
            id: 'task2',
            run: async (ctx: RunceTaskContext) => {
              ctx.log('Task 2');
            }
          }
        }
      ];

      const options: RunTasksOptions = {
        tasks,
        config: mockConfig,
        tracker: mockTracker,
        log: mockLogger,
        filters: {
          only: ['task1']
        }
      };

      await runTasks(options);

      expect(mockTracker.appliedRecords).toHaveLength(1);
      expect(mockTracker.appliedRecords[0].id).toBe('task1');
      expect(logMessages.some(msg =>
        msg.join(' ').includes('Task 1')
      )).toBe(true);
      expect(logMessages.some(msg =>
        msg.join(' ').includes('Task 2')
      )).toBe(false);
    });

    test('should filter tasks by since option', async () => {
      const tasks: LoadedTask[] = [
        {
          filePath: 'test1.js',
          checksum: 'abc123',
          task: {
            id: 'task-01',
            run: async (ctx: RunceTaskContext) => {
              ctx.log('Task 1');
            }
          }
        },
        {
          filePath: 'test2.js',
          checksum: 'def456',
          task: {
            id: 'task-02',
            run: async (ctx: RunceTaskContext) => {
              ctx.log('Task 2');
            }
          }
        }
      ];

      const options: RunTasksOptions = {
        tasks,
        config: mockConfig,
        tracker: mockTracker,
        log: mockLogger,
        filters: {
          since: 'task-02'
        }
      };

      await runTasks(options);

      expect(mockTracker.appliedRecords).toHaveLength(1);
      expect(mockTracker.appliedRecords[0].id).toBe('task-02');
    });
  });

  describe('dry run', () => {
    test('should not execute tasks in dry run mode', async () => {
      const task: LoadedTask = {
        filePath: 'test.js',
        checksum: 'abc123',
        task: {
          id: 'dry-run-task',
          run: async (ctx: RunceTaskContext) => {
            ctx.log('Should not run in dry mode');
          }
        }
      };

      const options: RunTasksOptions = {
        tasks: [task],
        config: mockConfig,
        tracker: mockTracker,
        log: mockLogger,
        dryRun: true
      };

      await runTasks(options);

      expect(mockTracker.appliedRecords).toHaveLength(0);
      expect(logMessages.some(msg =>
        msg.join(' ').includes('Should not run in dry mode')
      )).toBe(false);
    });
  });

  describe('checksum handling', () => {
    test('should include checksum in applied record', async () => {
      const task: LoadedTask = {
        filePath: 'test.js',
        checksum: 'test-checksum-123',
        task: {
          id: 'checksum-task',
          run: async (ctx: RunceTaskContext) => {
            ctx.log('Task with checksum');
          }
        }
      };

      const options: RunTasksOptions = {
        tasks: [task],
        config: mockConfig,
        tracker: mockTracker,
        log: mockLogger
      };

      await runTasks(options);

      expect(mockTracker.appliedRecords).toHaveLength(1);
      expect(mockTracker.appliedRecords[0].checksum).toBe('test-checksum-123');
    });
  });
});