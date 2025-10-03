import { defineConfig } from './types.js';
import { Config } from './@interfaces/config.interface.js';

describe('types', () => {
  describe('defineConfig', () => {
    it('should return the same config object passed to it', () => {
      const config: Config = {
        tasksDir: './tasks',
        tracker: {
          type: 'file',
          options: {
            path: './.runce.json',
          },
        },
        lock: {
          enabled: false,
          ttlMs: 60000,
          owner: 'test-owner',
        },
        dryRun: false,
      };

      const result = defineConfig(config);
      expect(result).toBe(config);
      expect(result).toEqual(config);
    });

    it('should work with minimal config', () => {
      const config: Config = {
        tasksDir: './minimal',
        tracker: {
          type: 'mongo',
          options: {},
        },
      };

      const result = defineConfig(config);
      expect(result).toBe(config);
      expect(result.lock).toBeUndefined();
      expect(result.dryRun).toBeUndefined();
    });

    it('should work with all optional fields', () => {
      const config: Config = {
        tasksDir: './full',
        tracker: {
          type: 'postgres',
          options: {
            connectionString: 'postgres://localhost:5432/test',
          },
        },
        lock: {
          enabled: true,
          ttlMs: 120000,
          owner: 'full-test-owner',
        },
        dryRun: true,
      };

      const result = defineConfig(config);
      expect(result).toBe(config);
      expect(result.lock?.enabled).toBe(true);
      expect(result.dryRun).toBe(true);
    });
  });
});