import { PostgreSQLTracker } from './postgresql-tracker.js';
import { AppliedRecord } from '../tracker.js';

// Mock pg module
jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue({
      query: jest.fn(),
      release: jest.fn()
    }),
    end: jest.fn().mockResolvedValue(undefined)
  }))
}));

describe('PostgreSQLTracker', () => {
  let tracker: PostgreSQLTracker;
  let mockPool: any;
  let mockClient: any;

  beforeEach(() => {
    const { Pool } = require('pg');
    mockClient = {
      query: jest.fn(),
      release: jest.fn()
    };
    mockPool = {
      connect: jest.fn().mockResolvedValue(mockClient),
      end: jest.fn().mockResolvedValue(undefined)
    };
    (Pool as jest.Mock).mockReturnValue(mockPool);

    tracker = new PostgreSQLTracker();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('init', () => {
    it('should initialize with connection string', async () => {
      const config = {
        connectionString: 'postgresql://user:pass@localhost:5432/testdb',
        ssl: true
      };

      await tracker.init(config);

      const { Pool } = require('pg');
      expect(Pool).toHaveBeenCalledWith({
        connectionString: 'postgresql://user:pass@localhost:5432/testdb',
        ssl: { rejectUnauthorized: false }
      });

      // Verify table creation queries were called
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS public.runce_applied')
      );
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS public.runce_lock')
      );
    });

    it('should initialize with individual connection parameters', async () => {
      const config = {
        host: 'localhost',
        port: 5432,
        database: 'testdb',
        username: 'user',
        password: 'pass',
        appliedTable: 'custom_applied',
        lockTable: 'custom_lock',
        schema: 'custom'
      };

      await tracker.init(config);

      const { Pool } = require('pg');
      expect(Pool).toHaveBeenCalledWith({
        host: 'localhost',
        port: 5432,
        database: 'testdb',
        user: 'user',
        password: 'pass',
        ssl: false
      });

      // Verify custom table names are used
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS custom.custom_applied')
      );
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS custom.custom_lock')
      );
    });
  });

  describe('getAppliedIds', () => {
    it('should return set of applied task ids', async () => {
      const mockRows = [
        { id: 'task1' },
        { id: 'task2' },
        { id: 'task3' }
      ];
      mockClient.query.mockResolvedValue({ rows: mockRows });

      await tracker.init({});
      const result = await tracker.getAppliedIds();

      expect(result).toEqual(new Set(['task1', 'task2', 'task3']));
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining("SELECT id FROM public.runce_applied WHERE status = 'success'")
      );
    });

    it('should return empty set when no applied tasks', async () => {
      mockClient.query.mockResolvedValue({ rows: [] });

      await tracker.init({});
      const result = await tracker.getAppliedIds();

      expect(result).toEqual(new Set());
    });
  });

  describe('recordApplied', () => {
    it('should insert applied record', async () => {
      const record: AppliedRecord = {
        id: 'test-task',
        name: 'Test Task',
        checksum: 'abc123',
        appliedAt: new Date('2023-01-01T10:00:00Z'),
        durationMs: 1000,
        status: 'success'
      };

      await tracker.init({});
      await tracker.recordApplied(record);

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO public.runce_applied'),
        [
          'test-task',
          'Test Task',
          'abc123',
          record.appliedAt,
          1000,
          'success',
          null
        ]
      );
    });

    it('should insert applied record with error', async () => {
      const record: AppliedRecord = {
        id: 'failed-task',
        name: 'Failed Task',
        checksum: 'def456',
        appliedAt: new Date('2023-01-01T10:00:00Z'),
        durationMs: 500,
        status: 'failed',
        error: 'Something went wrong'
      };

      await tracker.init({});
      await tracker.recordApplied(record);

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO public.runce_applied'),
        [
          'failed-task',
          'Failed Task',
          'def456',
          record.appliedAt,
          500,
          'failed',
          'Something went wrong'
        ]
      );
    });
  });

  describe('listApplied', () => {
    it('should return list of applied records', async () => {
      const mockRows = [
        {
          id: 'task1',
          name: 'Task 1',
          checksum: 'abc123',
          applied_at: '2023-01-01T10:00:00Z',
          duration_ms: 1000,
          status: 'success',
          error: null
        },
        {
          id: 'task2',
          name: 'Task 2',
          checksum: 'def456',
          applied_at: '2023-01-01T11:00:00Z',
          duration_ms: 500,
          status: 'failed',
          error: 'Task failed'
        }
      ];
      mockClient.query.mockResolvedValue({ rows: mockRows });

      await tracker.init({});
      const result = await tracker.listApplied();

      expect(result).toEqual([
        {
          id: 'task1',
          name: 'Task 1',
          checksum: 'abc123',
          appliedAt: new Date('2023-01-01T10:00:00Z'),
          durationMs: 1000,
          status: 'success'
        },
        {
          id: 'task2',
          name: 'Task 2',
          checksum: 'def456',
          appliedAt: new Date('2023-01-01T11:00:00Z'),
          durationMs: 500,
          status: 'failed',
          error: 'Task failed'
        }
      ]);
    });
  });

  describe('lock operations', () => {
    beforeEach(async () => {
      // Reset the mock calls count
      jest.clearAllMocks();

      // Set up the mock responses for table creation during init
      mockClient.query
        .mockResolvedValueOnce({}) // CREATE TABLE applied
        .mockResolvedValueOnce({}) // CREATE TABLE lock
        .mockResolvedValueOnce({}) // CREATE INDEX status
        .mockResolvedValueOnce({}); // CREATE INDEX applied_at

      await tracker.init({});

      // Clear the mock calls again after init so tests only see their own calls
      jest.clearAllMocks();
    });

    describe('acquireLock', () => {
      it('should acquire lock successfully', async () => {
        mockClient.query.mockResolvedValue({ rows: [{ name: 'global' }] });

        const result = await tracker.acquireLock('owner1', 5000);

        expect(result).toBe(true);
        expect(mockClient.query).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO public.runce_lock'),
          [expect.any(Date), 'owner1']
        );
      });

      it('should fail to acquire lock when already held', async () => {
        mockClient.query.mockResolvedValue({ rows: [] });

        const result = await tracker.acquireLock('owner1', 5000);

        expect(result).toBe(false);
      });

      it('should handle database errors', async () => {
        mockClient.query.mockRejectedValue(new Error('Database error'));

        const result = await tracker.acquireLock('owner1', 5000);

        expect(result).toBe(false);
      });
    });

    describe('renewLock', () => {
      it('should renew lock successfully', async () => {
        mockClient.query.mockResolvedValue({ rows: [{ name: 'global' }] });

        const result = await tracker.renewLock('owner1', 5000);

        expect(result).toBe(true);
        expect(mockClient.query).toHaveBeenCalledWith(
          expect.stringContaining('UPDATE public.runce_lock'),
          expect.arrayContaining([expect.any(Date), 'owner1'])
        );
      });

      it('should fail to renew lock for different owner', async () => {
        mockClient.query.mockResolvedValue({ rows: [] });

        const result = await tracker.renewLock('owner2', 5000);

        expect(result).toBe(false);
      });
    });

    describe('releaseLock', () => {
      it('should release lock', async () => {
        await tracker.releaseLock('owner1');

        expect(mockClient.query).toHaveBeenCalledWith(
          expect.stringContaining('DELETE FROM public.runce_lock'),
          ['owner1']
        );
      });
    });
  });

  describe('close', () => {
    it('should close connection pool', async () => {
      await tracker.init({});
      await tracker.close();

      expect(mockPool.end).toHaveBeenCalled();
    });
  });
});