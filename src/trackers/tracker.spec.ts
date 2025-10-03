describe('tracker interfaces', () => {
  it('should export tracker interfaces from index', () => {
    // This is a basic test to ensure the interface exports are working
    const trackerModule = require('./tracker.js');

    // The tracker.ts file exports interfaces, not runtime values
    // So we test that the exports don't throw errors
    expect(() => require('./tracker.js')).not.toThrow();
  });

  it('should be importable as ES modules', async () => {
    // Test that the interfaces can be imported as ES modules
    const trackerModule = await import('./tracker.js');
    expect(trackerModule).toBeDefined();
  });

  // Note: Interface files primarily provide TypeScript types at compile time
  // They don't have runtime behavior to test beyond ensuring they're importable
  // The actual interface implementations are tested in the concrete classes
  // that implement them (MongoTracker, FileTracker, etc.)
});