// CLI testing is complex due to commander.js and process interactions
// This spec tests the exported functions and core logic
import { jest } from '@jest/globals';

describe('cli', () => {
  let originalArgv: string[];
  let originalExit: typeof process.exit;
  let originalLog: typeof console.log;
  let exitCode: number | undefined;
  let logOutput: any[][];

  beforeEach(() => {
    originalArgv = process.argv;
    originalExit = process.exit;
    originalLog = console.log;
    exitCode = undefined;
    logOutput = [];

    // Mock process.exit to capture exit codes
    (process.exit as any) = jest.fn(((code?: number) => {
      exitCode = code;
      throw new Error('Process exit called');
    }) as any);

    // Mock console.log to capture output
    console.log = jest.fn((...args: any[]) => {
      logOutput.push(args);
    });
  });

  afterEach(() => {
    process.argv = originalArgv;
    process.exit = originalExit;
    console.log = originalLog;
  });

  describe('CLI module', () => {
    it('should have proper shebang for executable', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');
      const cliPath = path.join(process.cwd(), 'src', 'cli.ts');
      const content = await fs.readFile(cliPath, 'utf-8');
      expect(content.startsWith('#!/usr/bin/env node')).toBe(true);
    });

    // Note: CLI import testing is complex due to commander.js side effects
    // The CLI module executes commander setup on import, which affects tests
    // For comprehensive CLI testing, we would need:
    // 1. Mocking commander.js behavior
    // 2. Testing individual command handlers in isolation
    // 3. Integration tests with actual command execution
    // 4. Testing error handling for various CLI scenarios
  });

  describe('CLI integration points', () => {
    it('should export CLI functionality through index.js', async () => {
      const indexModule = await import('./index.js');

      // Verify that the main functions used by CLI are exported
      expect(typeof indexModule.runWithConfig).toBe('function');
      expect(typeof indexModule.listApplied).toBe('function');
      expect(typeof indexModule.loadTasks).toBe('function');
      expect(typeof indexModule.runTasks).toBe('function');
      expect(typeof indexModule.createLogger).toBe('function');
    });

    it('should have type exports available for CLI', async () => {
      const indexModule = await import('./index.js');

      // These should be available as type exports
      expect(typeof indexModule.defineConfig).toBe('function');
    });
  });
});