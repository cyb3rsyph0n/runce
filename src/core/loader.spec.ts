import { loadTasks } from './loader.js';
import { writeFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { RunceTask } from '../types.js';

describe('loader', () => {
  const testDir = join(process.cwd(), 'test-tasks');

  beforeEach(async () => {
    await rm(testDir, { recursive: true, force: true });
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('loadTasks', () => {
    it('should return empty array for empty tasks directory', async () => {
      const tasks = await loadTasks(testDir);
      expect(tasks).toEqual([]);
    });

    it('should throw error for missing tasks directory', async () => {
      const nonExistentDir = join(process.cwd(), 'non-existent-dir');

      await expect(loadTasks(nonExistentDir)).rejects.toThrow(
        'Tasks directory not found: ' + nonExistentDir
      );
    });

    it('should ignore non-task files', async () => {
      await writeFile(join(testDir, 'readme.txt'), 'This is not a task');
      await writeFile(join(testDir, 'config.json'), '{"not": "a task"}');

      const tasks = await loadTasks(testDir);
      expect(tasks).toEqual([]);
    });

    it('should throw error for task with invalid format', async () => {
      const invalidTaskContent = `
        // Missing default export
        const task = {
          id: 'invalid-task',
          async run() {}
        };
        // No export default
      `;

      await writeFile(join(testDir, 'invalid.js'), invalidTaskContent);

      await expect(loadTasks(testDir)).rejects.toThrow('Failed to load task from invalid.js');
    });

    it('should throw error for task missing required properties', async () => {
      const incompleteTaskContent = `
        const task = {
          // Missing id
          async run() {}
        };
        export default task;
      `;

      await writeFile(join(testDir, 'incomplete.js'), incompleteTaskContent);

      await expect(loadTasks(testDir)).rejects.toThrow('Failed to load task from incomplete.js');
    });

    it('should handle syntax errors in task files', async () => {
      const syntaxErrorContent = `
        const task = {
          id: 'syntax-error-task'
          // Missing comma - syntax error
          async run() {}
        };
        export default task;
      `;

      await writeFile(join(testDir, 'syntax-error.js'), syntaxErrorContent);

      await expect(loadTasks(testDir)).rejects.toThrow('Failed to load task from syntax-error.js');
    });

    // Note: Testing successful task loading with dynamic imports is complex in Jest
    // The loadTasks function uses dynamic imports which require the modules to be
    // available at runtime. In a test environment, this would require:
    // 1. Creating actual executable modules
    // 2. Managing module resolution and cleanup
    // 3. Handling TypeScript compilation in tests

    // These scenarios are tested through integration with other components
    // that use loadTasks, and through the error path tests above.

    // For comprehensive testing, we would need:
    // 1. Mock the import() function
    // 2. Create a test-specific loader
    // 3. Use end-to-end integration tests with actual files
  });

  describe('recursive folder loading', () => {
    it('should attempt to load tasks from subdirectories', async () => {
      // Create subdirectory structure
      const subDir = join(testDir, 'subfolder');
      await mkdir(subDir, { recursive: true });

      // Create a task file in subdirectory (will fail to import)
      const taskContent = `export default { invalidTask: true };`;
      await writeFile(join(subDir, 'sub-task.js'), taskContent);

      // This should attempt to load from subdirectory and fail with import error
      await expect(loadTasks(testDir)).rejects.toThrow(
        'Failed to load task from sub-task.js'
      );
    });

    it('should handle nested subdirectories', async () => {
      // Create nested directory structure  
      const nestedDir = join(testDir, 'level1', 'level2');
      await mkdir(nestedDir, { recursive: true });

      // Create a task file in nested directory (will fail to import)
      const taskContent = `export default "not an object";`;
      await writeFile(join(nestedDir, 'nested-task.js'), taskContent);

      // Should try to load and fail with import error
      await expect(loadTasks(testDir)).rejects.toThrow(
        'Failed to load task from nested-task.js'
      );
    });
  });
});