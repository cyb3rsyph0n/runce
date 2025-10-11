import { ITracker, AppliedRecord, TrackerInit } from '../tracker.js';
import { Client, Pool } from 'pg';

export class PostgreSQLTracker implements ITracker {
  private pool!: Pool;
  private appliedTable!: string;
  private lockTable!: string;

  async init(cfg: TrackerInit): Promise<void> {
    const {
      connectionString,
      host,
      port = 5432,
      database,
      username,
      password,
      appliedTable = 'runce_applied',
      lockTable = 'runce_lock',
      ssl = false,
      schema = 'public'
    } = cfg as {
      connectionString?: string;
      host?: string;
      port?: number;
      database?: string;
      username?: string;
      password?: string;
      appliedTable?: string;
      lockTable?: string;
      ssl?: boolean;
      schema?: string;
    };

    // Configure connection
    const config = connectionString ? {
      connectionString,
      ssl: ssl ? { rejectUnauthorized: false } : false
    } : {
      host,
      port,
      database,
      user: username,
      password,
      ssl: ssl ? { rejectUnauthorized: false } : false
    };

    this.pool = new Pool(config);
    this.appliedTable = `${schema}.${appliedTable}`;
    this.lockTable = `${schema}.${lockTable}`;

    // Create tables if they don't exist
    await this.createTables();
  }

  private async createTables(): Promise<void> {
    const client = await this.pool.connect();
    try {
      // Create applied records table
      await client.query(`
        CREATE TABLE IF NOT EXISTS ${this.appliedTable} (
          id VARCHAR(255) PRIMARY KEY,
          name VARCHAR(500) NOT NULL,
          checksum VARCHAR(64) NOT NULL,
          applied_at TIMESTAMP WITH TIME ZONE NOT NULL,
          duration_ms INTEGER NOT NULL,
          status VARCHAR(20) NOT NULL CHECK (status IN ('success', 'failed')),
          error TEXT
        )
      `);

      // Create lock table
      await client.query(`
        CREATE TABLE IF NOT EXISTS ${this.lockTable} (
          name VARCHAR(255) PRIMARY KEY,
          lease_until TIMESTAMP WITH TIME ZONE NOT NULL,
          owner VARCHAR(255) NOT NULL
        )
      `);

      // Create indexes
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_${this.appliedTable.split('.')[1]}_status 
        ON ${this.appliedTable} (status)
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_${this.appliedTable.split('.')[1]}_applied_at 
        ON ${this.appliedTable} (applied_at)
      `);
    } finally {
      client.release();
    }
  }

  async getAppliedIds(): Promise<Set<string>> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        `SELECT id FROM ${this.appliedTable} WHERE status = 'success'`
      );
      return new Set(result.rows.map(row => row.id));
    } finally {
      client.release();
    }
  }

  async recordApplied(rec: AppliedRecord): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query(`
        INSERT INTO ${this.appliedTable} (id, name, checksum, applied_at, duration_ms, status, error)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          checksum = EXCLUDED.checksum,
          applied_at = EXCLUDED.applied_at,
          duration_ms = EXCLUDED.duration_ms,
          status = EXCLUDED.status,
          error = EXCLUDED.error
      `, [
        rec.id,
        rec.name,
        rec.checksum,
        rec.appliedAt,
        rec.durationMs,
        rec.status,
        rec.error || null
      ]);
    } finally {
      client.release();
    }
  }

  async listApplied(): Promise<AppliedRecord[]> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(`
        SELECT id, name, checksum, applied_at, duration_ms, status, error
        FROM ${this.appliedTable}
        ORDER BY applied_at ASC
      `);

      return result.rows.map(row => ({
        id: row.id,
        name: row.name,
        checksum: row.checksum,
        appliedAt: new Date(row.applied_at),
        durationMs: row.duration_ms,
        status: row.status,
        error: row.error || undefined
      }));
    } finally {
      client.release();
    }
  }

  async acquireLock(owner: string, ttlMs: number): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      const leaseUntil = new Date(Date.now() + ttlMs);

      // Try to acquire lock by inserting or updating if expired
      const result = await client.query(`
        INSERT INTO ${this.lockTable} (name, lease_until, owner)
        VALUES ('global', $1, $2)
        ON CONFLICT (name) DO UPDATE SET
          lease_until = EXCLUDED.lease_until,
          owner = EXCLUDED.owner
        WHERE ${this.lockTable}.lease_until < NOW()
        RETURNING name
      `, [leaseUntil, owner]);

      return result.rows.length > 0;
    } catch (error) {
      // Lock already held by another owner
      return false;
    } finally {
      client.release();
    }
  }

  async renewLock(owner: string, ttlMs: number): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      const leaseUntil = new Date(Date.now() + ttlMs);

      const result = await client.query(`
        UPDATE ${this.lockTable}
        SET lease_until = $1
        WHERE name = 'global' AND owner = $2
        RETURNING name
      `, [leaseUntil, owner]);

      return result.rows.length > 0;
    } finally {
      client.release();
    }
  }

  async releaseLock(owner: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query(`
        DELETE FROM ${this.lockTable}
        WHERE name = 'global' AND owner = $1
      `, [owner]);
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}