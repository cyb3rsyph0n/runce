import { ITracker } from '../trackers/tracker.js';
import { MongoTracker } from '../trackers/mongo-tracker.js';
import { FileTracker } from '../trackers/file-tracker.js';

export function createTracker(type: string): ITracker {
  switch (type) {
    case 'mongo':
      return new MongoTracker();
    case 'file':
      return new FileTracker();
    default:
      throw new Error(`Unknown tracker type: ${type}`);
  }
}