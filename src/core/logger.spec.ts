import { createLogger } from './logger.js';

describe('logger', () => {
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('createLogger', () => {
    it('should create a logger function without prefix', () => {
      const logger = createLogger();
      expect(typeof logger).toBe('function');

      logger('test message');

      expect(consoleSpy).toHaveBeenCalledTimes(1);
      const allArgs = consoleSpy.mock.calls[0];

      // The logger combines timestamp and prefix into first argument
      expect(allArgs[0]).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z $/);
      expect(allArgs.slice(1)).toEqual(['test message']);
    });

    it('should create a logger function with prefix', () => {
      const logger = createLogger('TEST');
      expect(typeof logger).toBe('function');

      logger('test message', 'additional arg');

      expect(consoleSpy).toHaveBeenCalledTimes(1);
      const allArgs = consoleSpy.mock.calls[0];

      expect(allArgs[0]).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z \[TEST\]$/);
      expect(allArgs.slice(1)).toEqual(['test message', 'additional arg']);
    });

    it('should handle multiple arguments', () => {
      const logger = createLogger('MULTI');

      logger('arg1', 42, { test: true }, ['array']);

      expect(consoleSpy).toHaveBeenCalledTimes(1);
      const allArgs = consoleSpy.mock.calls[0];

      expect(allArgs[0]).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z \[MULTI\]$/);
      expect(allArgs.slice(1)).toEqual(['arg1', 42, { test: true }, ['array']]);
    });

    it('should handle no arguments', () => {
      const logger = createLogger('EMPTY');

      logger();

      expect(consoleSpy).toHaveBeenCalledTimes(1);
      const allArgs = consoleSpy.mock.calls[0];

      expect(allArgs[0]).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z \[EMPTY\]$/);
      expect(allArgs.slice(1)).toEqual([]);
    });

    it('should create different timestamps for different calls', async () => {
      const logger = createLogger();

      logger('first');
      await new Promise(resolve => setTimeout(resolve, 2)); // Small delay
      logger('second');

      expect(consoleSpy).toHaveBeenCalledTimes(2);
      const firstTimestamp = consoleSpy.mock.calls[0][0];
      const secondTimestamp = consoleSpy.mock.calls[1][0];
      expect(firstTimestamp).not.toBe(secondTimestamp);
    });
  });
});