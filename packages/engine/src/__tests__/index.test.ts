import { describe, it, expect } from 'vitest';
import { version } from '../index';

describe('@object-ui/engine', () => {
  describe('version', () => {
    it('should export a version string', () => {
      expect(version).toBeDefined();
      expect(typeof version).toBe('string');
    });

    it('should match semantic versioning pattern', () => {
      const semverPattern = /^\d+\.\d+\.\d+$/;
      expect(version).toMatch(semverPattern);
    });

    it('should be version 0.1.0', () => {
      expect(version).toBe('0.1.0');
    });
  });
});
