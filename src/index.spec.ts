describe('index', () => {
  describe('exports', () => {
    it('should export all required functions and types', async () => {
      const indexModule = await import('./index.js');

      // Check function exports
      expect(typeof indexModule.runWithConfig).toBe('function');
      expect(typeof indexModule.runWithConfigObject).toBe('function');
      expect(typeof indexModule.listApplied).toBe('function');
      expect(typeof indexModule.listAppliedWithConfig).toBe('function');
      expect(typeof indexModule.loadTasks).toBe('function');
      expect(typeof indexModule.runTasks).toBe('function');
      expect(typeof indexModule.createLogger).toBe('function');
      expect(typeof indexModule.defineConfig).toBe('function');

      // Check type/interface exports exist (they won't have runtime values)
      // These are compile-time checks that the types are properly exported
      expect(indexModule.runWithConfig).toBeDefined();
      expect(indexModule.runWithConfigObject).toBeDefined();
      expect(indexModule.listApplied).toBeDefined();
      expect(indexModule.listAppliedWithConfig).toBeDefined();
    });
  });

  describe('integration points', () => {
    it('should provide the main API surface for runce', () => {
      // This test ensures that the index module provides a coherent API
      // The actual functionality is tested in individual component specs

      // runWithConfig and listApplied are the main entry points for the library
      // They integrate all the other components (loader, runner, trackers, etc.)
      expect(typeof require('./index.js').runWithConfig).toBe('function');
      expect(typeof require('./index.js').runWithConfigObject).toBe('function');
      expect(typeof require('./index.js').listApplied).toBe('function');
      expect(typeof require('./index.js').listAppliedWithConfig).toBe('function');
    });

    // Note: Full integration testing of runWithConfig and listApplied would require:
    // 1. Creating real config files with dynamic imports
    // 2. Managing test file cleanup and module resolution
    // 3. Testing across different tracker types
    // 4. Handling TypeScript compilation in test environment

    // These functions are complex integration points that combine:
    // - Config loading (dynamic imports)
    // - Task loading (dynamic imports) 
    // - Tracker initialization
    // - Task execution

    // The individual components are well tested, and these integration
    // functions primarily orchestrate those tested components.
  });
});