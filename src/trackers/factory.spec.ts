import { createTracker } from './factory.js';
import { MongoTracker } from './mongo-tracker/mongo-tracker.js';
import { FileTracker } from './file-tracker/file-tracker.js';
import { PostgreSQLTracker } from './postgresql-tracker/postgresql-tracker.js';
import { ITracker } from '../@interfaces/itracker.interface.js';

describe('tracker factory', () => {
  describe('createTracker', () => {
    it('should create MongoTracker for mongo type', () => {
      const tracker = createTracker('mongo');
      expect(tracker).toBeInstanceOf(MongoTracker);
      expect(tracker).toBeInstanceOf(Object);
      expect(typeof tracker.init).toBe('function');
    });

    it('should create FileTracker for file type', () => {
      const tracker = createTracker('file');
      expect(tracker).toBeInstanceOf(FileTracker);
      expect(tracker).toBeInstanceOf(Object);
      expect(typeof tracker.init).toBe('function');
    });

    it('should create PostgreSQLTracker for postgresql type', () => {
      const tracker = createTracker('postgresql');
      expect(tracker).toBeInstanceOf(PostgreSQLTracker);
      expect(tracker).toBeInstanceOf(Object);
      expect(typeof tracker.init).toBe('function');
    });

    it('should create PostgreSQLTracker for postgres type', () => {
      const tracker = createTracker('postgres');
      expect(tracker).toBeInstanceOf(PostgreSQLTracker);
      expect(tracker).toBeInstanceOf(Object);
      expect(typeof tracker.init).toBe('function');
    });

    it('should implement ITracker interface for mongo tracker', () => {
      const tracker = createTracker('mongo');

      // Check that all required methods exist
      expect(typeof tracker.init).toBe('function');
      expect(typeof tracker.getAppliedIds).toBe('function');
      expect(typeof tracker.recordApplied).toBe('function');
      expect(typeof tracker.listApplied).toBe('function');

      // Check optional lock methods exist for mongo
      expect(typeof (tracker as any).acquireLock).toBe('function');
      expect(typeof (tracker as any).releaseLock).toBe('function');
      expect(typeof (tracker as any).renewLock).toBe('function');
    });

    it('should implement ITracker interface for file tracker', () => {
      const tracker = createTracker('file');

      // Check that all required methods exist
      expect(typeof tracker.init).toBe('function');
      expect(typeof tracker.getAppliedIds).toBe('function');
      expect(typeof tracker.recordApplied).toBe('function');
      expect(typeof tracker.listApplied).toBe('function');

      // Check optional lock methods do not exist for file
      expect((tracker as any).acquireLock).toBeUndefined();
      expect((tracker as any).releaseLock).toBeUndefined();
      expect((tracker as any).renewLock).toBeUndefined();
    });

    it('should implement ITracker interface for postgresql tracker', () => {
      const tracker = createTracker('postgresql');

      // Check that all required methods exist
      expect(typeof tracker.init).toBe('function');
      expect(typeof tracker.getAppliedIds).toBe('function');
      expect(typeof tracker.recordApplied).toBe('function');
      expect(typeof tracker.listApplied).toBe('function');

      // Check optional lock methods exist for postgresql
      expect(typeof (tracker as any).acquireLock).toBe('function');
      expect(typeof (tracker as any).releaseLock).toBe('function');
      expect(typeof (tracker as any).renewLock).toBe('function');
    });

    it('should throw error for unknown tracker type', () => {
      expect(() => createTracker('unknown')).toThrow('Unknown tracker type: unknown');
      expect(() => createTracker('')).toThrow('Unknown tracker type: ');
    });

    it('should handle case sensitivity', () => {
      expect(() => createTracker('Mongo')).toThrow('Unknown tracker type: Mongo');
      expect(() => createTracker('MONGO')).toThrow('Unknown tracker type: MONGO');
      expect(() => createTracker('File')).toThrow('Unknown tracker type: File');
    });

    it('should return different instances for multiple calls', () => {
      const tracker1 = createTracker('mongo');
      const tracker2 = createTracker('mongo');

      expect(tracker1).not.toBe(tracker2);
      expect(tracker1).toBeInstanceOf(MongoTracker);
      expect(tracker2).toBeInstanceOf(MongoTracker);
    });

    it('should return different instances for different types', () => {
      const mongoTracker = createTracker('mongo');
      const fileTracker = createTracker('file');
      const postgresTracker = createTracker('postgresql');

      expect(mongoTracker).not.toBe(fileTracker);
      expect(mongoTracker).not.toBe(postgresTracker);
      expect(fileTracker).not.toBe(postgresTracker);
      expect(mongoTracker).toBeInstanceOf(MongoTracker);
      expect(fileTracker).toBeInstanceOf(FileTracker);
      expect(postgresTracker).toBeInstanceOf(PostgreSQLTracker);
    });
  });
});