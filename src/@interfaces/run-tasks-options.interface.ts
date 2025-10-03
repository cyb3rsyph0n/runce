import { ITracker } from './itracker.interface.js';
import { LoadedTask } from './loaded-task.interface.js';
import { Config } from './config.interface.js';
import { Logger } from './logger.interface.js';

export interface RunTasksOptions {
  tracker: ITracker;
  tasks: LoadedTask[];
  config: Config;
  log: Logger;
  dryRun?: boolean;
  filters?: {
    only?: string[];
    since?: string;
    until?: string;
  };
}