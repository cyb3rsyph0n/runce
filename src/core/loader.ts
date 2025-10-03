import path from 'path';
import fs from 'fs/promises';
import { pathToFileURL } from 'url';
import { RunceTask } from '../types.js';
import { calculateChecksum } from './checksum.js';

export { LoadedTask } from '../interfaces/loaded-task.interface.js';
import { LoadedTask } from '../interfaces/loaded-task.interface.js';

export async function loadTasks(tasksDir: string): Promise<LoadedTask[]> {
  try {
    const files = await fs.readdir(tasksDir);
    const taskFiles = files.filter(f => f.endsWith('.ts') || f.endsWith('.js'));

    const loadedTasks: LoadedTask[] = [];

    for (const file of taskFiles) {
      const filePath = path.join(tasksDir, file);
      try {
        const checksum = await calculateChecksum(filePath);

        let fileUrl: string;
        if (file.endsWith('.ts')) {
          // For TypeScript files, tsx should be registered by the CLI wrapper
          fileUrl = pathToFileURL(filePath).href;
        } else {
          fileUrl = pathToFileURL(filePath).href;
        }

        const module = await import(fileUrl);
        const task = module.default as RunceTask;

        if (!task || typeof task !== 'object' || !task.id || typeof task.run !== 'function') {
          throw new Error(`Invalid task format in ${file}: must export default object with id and run function`);
        }

        loadedTasks.push({ task, filePath, checksum });
      } catch (error) {
        throw new Error(`Failed to load task from ${file}: ${error}`);
      }
    }

    // Sort by task id for consistent ordering
    return loadedTasks.sort((a, b) => a.task.id.localeCompare(b.task.id));
  } catch (error) {
    if ((error as any).code === 'ENOENT') {
      throw new Error(`Tasks directory not found: ${tasksDir}`);
    }
    throw error;
  }
}