import { RunceTaskContext } from './runce-task-context.interface.js';

export interface RunceTask {
  id: string;   // canonical, stable id (often timestamped)
  title?: string;
  runAlways?: boolean; // if true, runs every time (not tracked for completion)
  run(ctx: RunceTaskContext): Promise<void>;
  alreadyDone?: (ctx: RunceTaskContext) => Promise<boolean>;
}