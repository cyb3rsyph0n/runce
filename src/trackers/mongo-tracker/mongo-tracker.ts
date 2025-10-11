import { ITracker, AppliedRecord, TrackerInit } from '../tracker.js';
import { MongoClient, Collection, Db } from 'mongodb';

export class MongoTracker implements ITracker {
  private client!: MongoClient;
  private db!: Db;
  private applied!: Collection<AppliedRecord>;
  private lock!: Collection<{ _id: string; leaseUntil: Date; owner: string }>;

  async init(cfg: TrackerInit) {
    const {
      uri,
      db,
      appliedCollection = 'runce.applied',
      lockCollection = 'runce.lock'
    } = cfg as {
      uri: string;
      db: string;
      appliedCollection?: string;
      lockCollection?: string;
    };

    this.client = new MongoClient(uri);
    await this.client.connect();
    this.db = this.client.db(db);
    this.applied = this.db.collection(appliedCollection);
    this.lock = this.db.collection(lockCollection);

    // Create indexes
    await this.applied.createIndex({ id: 1 }, { unique: true });
    // _id is already unique by default, no need to add index
  }

  async getAppliedIds(): Promise<Set<string>> {
    const records = await this.applied
      .find({ status: 'success' }, { projection: { id: 1 } })
      .toArray();
    return new Set(records.map(r => r.id));
  }

  async recordApplied(rec: AppliedRecord): Promise<void> {
    await this.applied.updateOne(
      { id: rec.id },
      { $set: rec },
      { upsert: true }
    );
  }

  async listApplied(): Promise<AppliedRecord[]> {
    return this.applied.find().sort({ appliedAt: 1 }).toArray();
  }

  async acquireLock(owner: string, ttlMs: number): Promise<boolean> {
    const leaseUntil = new Date(Date.now() + ttlMs);
    try {
      const result = await this.lock.findOneAndUpdate(
        {
          _id: 'global',
          $or: [
            { leaseUntil: { $lt: new Date() } },
            { leaseUntil: { $exists: false } }
          ]
        },
        {
          $set: { _id: 'global', leaseUntil, owner }
        },
        { upsert: true, returnDocument: 'after' }
      );
      return result !== null;
    } catch (error) {
      // If we get a duplicate key error, another process got the lock
      return false;
    }
  }

  async renewLock(owner: string, ttlMs: number): Promise<boolean> {
    const leaseUntil = new Date(Date.now() + ttlMs);
    const result = await this.lock.updateOne(
      { _id: 'global', owner },
      { $set: { leaseUntil } }
    );
    return result.matchedCount > 0;
  }

  async releaseLock(owner: string): Promise<void> {
    await this.lock.deleteOne({ _id: 'global', owner });
  }

  async close(): Promise<void> {
    await this.client.close();
  }
}