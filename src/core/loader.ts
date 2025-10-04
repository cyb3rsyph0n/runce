import path from 'path';
import fs from 'fs/promises';
import { pathToFileURL } from 'url';
import { RunceTask } from '../types.js';
import { calculateChecksum } from './checksum.js';

export { LoadedTask } from '../@interfaces/loaded-task.interface.js';
import { LoadedTask } from '../@interfaces/loaded-task.interface.js';

export async function loadTasks(tasksDir: string): Promise<LoadedTask[]> {
  try {
    const loadedTasks: LoadedTask[] = [];
    await loadTasksRecursive(tasksDir, loadedTasks);

    // Sort by task id for consistent ordering
    return loadedTasks.sort((a, b) => a.task.id.localeCompare(b.task.id));
  } catch (error) {
    if ((error as any).code === 'ENOENT') {
      throw new Error(`Tasks directory not found: ${tasksDir}`);
    }
    throw error;
  }
}

async function loadTasksRecursive(dirPath: string, loadedTasks: LoadedTask[]): Promise<void> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      // Recursively load tasks from subdirectories
      await loadTasksRecursive(fullPath, loadedTasks);
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.js'))) {
      // Load task file
      try {
        const checksum = await calculateChecksum(fullPath);

        let fileUrl: string;
        if (entry.name.endsWith('.ts')) {
          // For TypeScript files, tsx should be registered by the CLI wrapper
          fileUrl = pathToFileURL(fullPath).href;
        } else {
          fileUrl = pathToFileURL(fullPath).href;
        }

        const module = await import(fileUrl);
        const task = module.default as RunceTask;

        if (!task || typeof task !== 'object' || !task.id || typeof task.run !== 'function') {
          throw new Error(`Invalid task format in ${entry.name}: must export default object with id and run function`);
        }

        loadedTasks.push({ task, filePath: fullPath, checksum });
      } catch (error) {
        throw new Error(`Failed to load task from ${entry.name}: ${error}`);
      }
    }
  }
}