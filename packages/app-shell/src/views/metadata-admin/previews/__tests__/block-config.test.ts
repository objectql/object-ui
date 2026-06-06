import { describe, it, expect } from 'vitest';
import { BLOCK_CONFIG, blockHasConfig } from '../block-config';

describe('block-config', () => {
  it('exposes a configurable panel for the minimal SDUI block set', () => {
    for (const type of ['element:text', 'element:image', 'page:header', 'page:card', 'record:related_list']) {
      expect(blockHasConfig(type)).toBe(true);
      expect(BLOCK_CONFIG[type].length).toBeGreaterThan(0);
    }
  });

  it('returns false for blocks without a config schema (and for undefined)', () => {
    expect(blockHasConfig('page:section')).toBe(false);
    expect(blockHasConfig('nav:menu')).toBe(false);
    expect(blockHasConfig(undefined)).toBe(false);
  });

  it('every field has a name, label and a valid kind', () => {
    const kinds = new Set(['text', 'number', 'boolean', 'select']);
    for (const [type, fields] of Object.entries(BLOCK_CONFIG)) {
      for (const f of fields) {
        expect(f.name, `${type}.name`).toBeTruthy();
        expect(f.label, `${type}.label`).toBeTruthy();
        expect(kinds.has(f.kind), `${type}.${f.name} kind=${f.kind}`).toBe(true);
        if (f.kind === 'select') {
          expect(Array.isArray(f.options) && f.options.length > 0).toBe(true);
        }
      }
    }
  });
});
