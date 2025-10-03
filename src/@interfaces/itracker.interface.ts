import { AppliedRecord } from './applied-record.interface.js';
import { TrackerInit } from './tracker-init.interface.js';

export interface ITracker {
  init(cfg: TrackerInit): Promise<void>;
  /**
   * Returns a set of task ids that have been successfully applied.
   */
  getAppliedIds(): Promise<Set<string>>;
  /**
   * Atomically upsert an applied record by id.
   */
  recordApplied(rec: AppliedRecord): Promise<void>;
  /**
   * Optionally expose read API for records (used by --list).
   */
  listApplied(): Promise<AppliedRecord[]>;
  /**
   * Acquire a distributed lock
   */
  acquireLock?(owner: string, ttlMs: number): Promise<boolean>;
  /**
   * Release a distributed lock
   */
  releaseLock?(owner: string): Promise<void>;
  /**
   * Renew a distributed lock
   */
  renewLock?(owner: string, ttlMs: number): Promise<boolean>;
}