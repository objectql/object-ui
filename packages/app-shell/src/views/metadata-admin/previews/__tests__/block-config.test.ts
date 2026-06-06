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

  it('also exposes the array-valued blocks', () => {
    for (const type of ['page:tabs', 'record:details', 'record:highlights']) {
      expect(blockHasConfig(type)).toBe(true);
    }
  });

  it('every field (incl. nested array items) has a name, label and valid kind', () => {
    const kinds = new Set(['text', 'number', 'boolean', 'select', 'string-list', 'array']);
    const check = (f: any, path: string) => {
      expect(f.name, `${path}.name`).toBeTruthy();
      expect(f.label, `${path}.label`).toBeTruthy();
      expect(kinds.has(f.kind), `${path}.${f.name} kind=${f.kind}`).toBe(true);
      if (f.kind === 'select') expect(Array.isArray(f.options) && f.options.length > 0).toBe(true);
      if (f.kind === 'array') {
        expect(Array.isArray(f.itemFields) && f.itemFields.length > 0).toBe(true);
        for (const itf of f.itemFields) check(itf, `${path}.${f.name}[]`);
      }
    };
    for (const [type, fields] of Object.entries(BLOCK_CONFIG)) {
      for (const f of fields) check(f, type);
    }
  });
});
