const task = {
  id: '20251003T120000.init-example',
  title: 'Initialize example setup',
  async run({ log }) {
    log('Starting example initialization task');
    
    // Simulate some work
    await new Promise(resolve => setTimeout(resolve, 100));
    
    log('Created example configuration');
    log('Task completed successfully');
  },
  
  // Optional: check if task is already done
  async alreadyDone({ log }) {
    log('Checking if example setup is already done...');
    // In a real scenario, you might check if some resource exists
    return false;
  },
};

export default task;