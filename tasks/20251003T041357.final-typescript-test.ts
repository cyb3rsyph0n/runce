import { RunceTask } from '@nurv/runce';

const task: RunceTask = {
  id: '20251003T041357.final-typescript-test',
  title: 'Final TypeScript test',
  async run({ log }) {
    log('Starting task: Final TypeScript test');
    
    // TODO: Implement your one-time logic here
    // Examples:
    // - Create database indexes
    // - Initialize S3 buckets
    // - Seed data
    // - Call external APIs
    
    log('Task completed successfully');
  },
  
  // Optional: check if task is already done
  // async alreadyDone({ log }) {
  //   log('Checking if task is already done...');
  //   // Return true if task should be skipped
  //   return false;
  // },
};

export default task;
