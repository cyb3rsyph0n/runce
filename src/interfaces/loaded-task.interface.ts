import { RunceTask } from './runce-task.interface.js';

export interface LoadedTask {
  task: RunceTask;
  filePath: string;
  checksum: string;
}