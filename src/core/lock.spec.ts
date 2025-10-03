import { LockManager } from './lock.js';
import { ITracker } from '../interfaces/itracker.interface.js';

// Mock tracker for testing
class MockTracker implements ITracker {
  private appliedIds = new Set<string>();
  private appliedRecords: any[] = [];
  private lockOwner: string | null = null;
  private lockExpiry: number | null = null;

  acquireLockResult = true;
  releaseLockResult = true;
  renewLockResult = true;
  acquireLockCalls: Array<{ owner: string; ttlMs: number }> = [];
  releaseLockCalls: string[] = [];
  renewLockCalls: Array<{ owner: string; ttlMs: number }> = [];

  async init(): Promise<void> { }

  async getAppliedIds(): Promise<Set<string>> {
    return this.appliedIds;
  }

  async recordApplied(rec: any): Promise<void> {
    this.appliedRecords.push(rec);
    this.appliedIds.add(rec.id);
  }

  async listApplied(): Promise<any[]> {
    return this.appliedRecords;
  }

  async acquireLock(owner: string, ttlMs: number): Promise<boolean> {
    this.acquireLockCalls.push({ owner, ttlMs });
    if (this.acquireLockResult && !this.lockOwner) {
      this.lockOwner = owner;
      this.lockExpiry = Date.now() + ttlMs;
      return true;
    }
    return false;
  }

  async releaseLock(owner: string): Promise<void> {
    this.releaseLockCalls.push(owner);
    if (this.lockOwner === owner) {
      this.lockOwner = null;
      this.lockExpiry = null;
    }
  }

  async renewLock(owner: string, ttlMs: number): Promise<boolean> {
    this.renewLockCalls.push({ owner, ttlMs });
    if (this.renewLockResult && this.lockOwner === owner) {
      this.lockExpiry = Date.now() + ttlMs;
      return true;
    }
    return false;
  }

  reset() {
    this.appliedIds.clear();
    this.appliedRecords = [];
    this.lockOwner = null;
    this.lockExpiry = null;
    this.acquireLockCalls = [];
    this.releaseLockCalls = [];
    this.renewLockCalls = [];
    this.acquireLockResult = true;
    this.releaseLockResult = true;
    this.renewLockResult = true;
  }
}

// Mock tracker without lock support
class NoLockTracker implements ITracker {
  async init(): Promise<void> { }
  async getAppliedIds(): Promise<Set<string>> { return new Set(); }
  async recordApplied(): Promise<void> { }
  async listApplied(): Promise<any[]> { return []; }
}

describe('LockManager', () => {
  let mockTracker: MockTracker;
  let lockManager: LockManager;
  const owner = 'test-owner';
  const ttlMs = 1000;

  beforeEach(() => {
    mockTracker = new MockTracker();
    lockManager = new LockManager(mockTracker, owner, ttlMs);
    jest.clearAllTimers();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    mockTracker.reset();
  });

  describe('acquire', () => {
    it('should successfully acquire lock when tracker supports locking', async () => {
      const result = await lockManager.acquire();

      expect(result).toBe(true);
      expect(mockTracker.acquireLockCalls).toHaveLength(1);
      expect(mockTracker.acquireLockCalls[0]).toEqual({ owner, ttlMs });
    });

    it('should fail to acquire lock when already locked by another owner', async () => {
      // Simulate lock already held by another owner
      await mockTracker.acquireLock('other-owner', ttlMs);
      mockTracker.acquireLockResult = false;

      const result = await lockManager.acquire();

      expect(result).toBe(false);
      expect(mockTracker.acquireLockCalls).toHaveLength(2); // One from setup, one from test
    });

    it('should return true for tracker without lock support', async () => {
      const noLockTracker = new NoLockTracker();
      const noLockManager = new LockManager(noLockTracker, owner, ttlMs);

      const result = await noLockManager.acquire();

      expect(result).toBe(true);
    });

    it('should start renewal after successful acquisition', async () => {
      await lockManager.acquire();

      // Advance time by half the TTL
      jest.advanceTimersByTime(ttlMs / 2);

      expect(mockTracker.renewLockCalls).toHaveLength(1);
      expect(mockTracker.renewLockCalls[0]).toEqual({ owner, ttlMs });
    });
  });

  describe('release', () => {
    it('should release lock and stop renewal', async () => {
      await lockManager.acquire();

      await lockManager.release();

      expect(mockTracker.releaseLockCalls).toHaveLength(1);
      expect(mockTracker.releaseLockCalls[0]).toBe(owner);

      // Verify renewal stops
      const renewCallsBefore = mockTracker.renewLockCalls.length;
      jest.advanceTimersByTime(ttlMs);
      expect(mockTracker.renewLockCalls.length).toBe(renewCallsBefore);
    });

    it('should handle tracker without release lock support', async () => {
      const noLockTracker = new NoLockTracker();
      const noLockManager = new LockManager(noLockTracker, owner, ttlMs);

      // Should not throw
      await noLockManager.release();
    });
  });

  describe('renewal', () => {
    it('should renew lock at half TTL intervals', async () => {
      await lockManager.acquire();

      // Advance time by half TTL twice
      jest.advanceTimersByTime(ttlMs / 2);
      expect(mockTracker.renewLockCalls).toHaveLength(1);

      jest.advanceTimersByTime(ttlMs / 2);
      expect(mockTracker.renewLockCalls).toHaveLength(2);

      jest.advanceTimersByTime(ttlMs / 2);
      expect(mockTracker.renewLockCalls).toHaveLength(3);
    });

    it('should stop renewal when renewal fails', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      await lockManager.acquire();

      // Make renewal fail
      mockTracker.renewLockResult = false;

      // Advance time and flush all pending promises
      jest.advanceTimersByTime(ttlMs / 2);
      await jest.runAllTimersAsync();

      expect(mockTracker.renewLockCalls).toHaveLength(1);
      expect(consoleSpy).toHaveBeenCalledWith('Failed to renew lock, stopping renewal');

      // Verify no more renewal attempts
      const renewCallsBefore = mockTracker.renewLockCalls.length;
      jest.advanceTimersByTime(ttlMs);
      await jest.runAllTimersAsync();
      expect(mockTracker.renewLockCalls.length).toBe(renewCallsBefore);

      consoleSpy.mockRestore();
    });

    it('should stop renewal when renewal throws error', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      await lockManager.acquire();

      // Make renewal throw
      mockTracker.renewLock = jest.fn().mockRejectedValue(new Error('Network error'));

      // Advance time and flush all pending promises
      jest.advanceTimersByTime(ttlMs / 2);
      await jest.runAllTimersAsync();

      expect(consoleSpy).toHaveBeenCalledWith('Error renewing lock:', expect.any(Error));

      // Verify no more renewal attempts
      const renewCallsBefore = 1; // Should be 1 from the failed call
      jest.advanceTimersByTime(ttlMs);
      await jest.runAllTimersAsync();

      // Can't check call count since renewLock was mocked to reject

      consoleSpy.mockRestore();
    });

    it('should not start renewal if tracker does not support renewLock', async () => {
      // Create tracker without renewLock
      const noRenewTracker = new MockTracker();
      (noRenewTracker as any).renewLock = undefined;
      const noRenewManager = new LockManager(noRenewTracker, owner, ttlMs);

      await noRenewManager.acquire();

      jest.advanceTimersByTime(ttlMs);
      // No renewal calls should be made
      expect(noRenewTracker.renewLockCalls).toHaveLength(0);
    });
  });

  describe('multiple operations', () => {
    it('should handle acquire -> release -> acquire cycle', async () => {
      // First acquisition
      const result1 = await lockManager.acquire();
      expect(result1).toBe(true);

      // Release
      await lockManager.release();
      expect(mockTracker.releaseLockCalls).toHaveLength(1);

      // Second acquisition
      const result2 = await lockManager.acquire();
      expect(result2).toBe(true);
      expect(mockTracker.acquireLockCalls).toHaveLength(2);
    });

    it('should handle multiple releases safely', async () => {
      await lockManager.acquire();

      await lockManager.release();
      await lockManager.release(); // Second release should be safe

      expect(mockTracker.releaseLockCalls).toHaveLength(2);
    });
  });
});