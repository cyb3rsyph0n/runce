import { ITracker } from '../trackers/tracker.js';

export class LockManager {
  private renewInterval?: NodeJS.Timeout;

  constructor(
    private tracker: ITracker,
    private owner: string,
    private ttlMs: number
  ) { }

  async acquire(): Promise<boolean> {
    if (!this.tracker.acquireLock) {
      return true; // No locking support, proceed
    }

    const acquired = await this.tracker.acquireLock(this.owner, this.ttlMs);
    if (acquired) {
      this.startRenewal();
    }
    return acquired;
  }

  async release(): Promise<void> {
    this.stopRenewal();
    if (this.tracker.releaseLock) {
      await this.tracker.releaseLock(this.owner);
    }
  }

  private startRenewal(): void {
    if (!this.tracker.renewLock) return;

    // Renew at half the TTL interval
    const renewIntervalMs = this.ttlMs / 2;
    this.renewInterval = setInterval(async () => {
      try {
        const renewed = await this.tracker.renewLock!(this.owner, this.ttlMs);
        if (!renewed) {
          console.warn('Failed to renew lock, stopping renewal');
          this.stopRenewal();
        }
      } catch (error) {
        console.error('Error renewing lock:', error);
        this.stopRenewal();
      }
    }, renewIntervalMs);
  }

  private stopRenewal(): void {
    if (this.renewInterval) {
      clearInterval(this.renewInterval);
      this.renewInterval = undefined;
    }
  }
}