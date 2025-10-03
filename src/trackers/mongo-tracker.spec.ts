import { MongoTracker } from './mongo-tracker.js';
import { MongoMemoryServer } from 'mongodb-memory-server';

describe('MongoTracker', () => {
  let mongoServer: MongoMemoryServer;
  let tracker: MongoTracker;
  let mongoUri: string;

  beforeEach(async () => {
    mongoServer = await MongoMemoryServer.create();
    mongoUri = mongoServer.getUri();

    tracker = new MongoTracker();
    await tracker.init({
      uri: mongoUri,
      db: 'test',
    });
  });

  afterEach(async () => {
    await tracker.close();
    await mongoServer.stop();
  });

  it('should track applied tasks', async () => {
    const record = {
      id: 'test-task',
      name: 'Test Task',
      checksum: 'abc123',
      appliedAt: new Date(),
      durationMs: 100,
      status: 'success' as const,
    };

    await tracker.recordApplied(record);
    const appliedIds = await tracker.getAppliedIds();

    expect(appliedIds.has('test-task')).toBe(true);
  });

  it('should handle locking', async () => {
    const acquired1 = await tracker.acquireLock('owner1', 10000);
    expect(acquired1).toBe(true);

    const acquired2 = await tracker.acquireLock('owner2', 10000);
    expect(acquired2).toBe(false);

    await tracker.releaseLock('owner1');
    const acquired3 = await tracker.acquireLock('owner2', 10000);
    expect(acquired3).toBe(true);
  });
});