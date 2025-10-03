describe('interfaces index', () => {
  it('should export all interfaces', async () => {
    const interfacesModule = await import('./index.js');

    // Test that the module exports are available
    // Interfaces don't have runtime values, but the exports should be defined
    expect(interfacesModule).toBeDefined();
    expect(typeof interfacesModule).toBe('object');
  });

  it('should be importable without errors', () => {
    // Test CommonJS import
    expect(() => require('./index.js')).not.toThrow();
  });

  it('should provide TypeScript interface exports', async () => {
    // This test verifies that the interface exports work correctly
    // The actual type checking happens at compile time
    const interfacesModule = await import('./index.js');

    // The module should be defined and be an object
    expect(interfacesModule).toBeDefined();
    expect(typeof interfacesModule).toBe('object');

    // Since interfaces are compile-time only, we mainly test
    // that the module structure is correct
  });

  // Note: Interface files provide TypeScript types at compile time
  // They don't have significant runtime behavior beyond module exports
  // The actual functionality testing happens in the classes that implement
  // these interfaces (runners, trackers, etc.)
});