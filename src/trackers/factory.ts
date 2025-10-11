import { ITracker } from './tracker.js';
import { MongoTracker } from './mongo-tracker/mongo-tracker.js';
import { FileTracker } from './file-tracker/file-tracker.js';
import { PostgreSQLTracker } from './postgresql-tracker/postgresql-tracker.js';

export function createTracker(type: string): ITracker {
  switch (type) {
    case 'mongo':
      return new MongoTracker();
    case 'file':
      return new FileTracker();
    case 'postgresql':
    case 'postgres':
      return new PostgreSQLTracker();
    default:
      throw new Error(`Unknown tracker type: ${type}`);
  }
}