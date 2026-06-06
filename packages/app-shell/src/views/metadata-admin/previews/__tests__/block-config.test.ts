import { describe, it, expect } from 'vitest';
import { BLOCK_CONFIG, blockHasConfig } from '../block-config';
import { BLOCK_TYPE_META } from '../block-types';

describe('block-config', () => {
  it('exposes a configurable panel for every content block with authorable props', () => {
    for (const type of [
      'element:text', 'element:image', 'element:number', 'element:button',
      'page:header', 'page:card', 'page:tabs', 'page:accordion',
      'record:related_list', 'record:highlights', 'record:details', 'record:alert',
      'record:path', 'record:quick_actions', 'ai:chat_window', 'ai:input',
    ]) {
      expect(blockHasConfig(type), type).toBe(true);
      expect(BLOCK_CONFIG[type].length).toBeGreaterThan(0);
    }
  });

  it('returns false for pure-container blocks without scalar props (and undefined)', () => {
    expect(blockHasConfig('page:section')).toBe(false);
    expect(blockHasConfig('element:divider')).toBe(false);
    expect(blockHasConfig(undefined)).toBe(false);
  });

  it('prunes shell-singleton blocks from the page palette', () => {
    for (const type of ['app:launcher', 'global:notifications', 'user:profile']) {
      expect((BLOCK_TYPE_META as any)[type]).toBeUndefined();
    }
    // page-content navigation stays
    expect((BLOCK_TYPE_META as any)['nav:menu']).toBeTruthy();
  });

  it('also exposes the array-valued blocks', () => {
    for (const type of ['page:tabs', 'record:details', 'record:highlights']) {
      expect(blockHasConfig(type)).toBe(true);
    }
  });

  it('every field (incl. nested array items) has a name, label and valid kind', () => {
    const kinds = new Set([
      'text', 'number', 'boolean', 'select', 'string-list', 'array',
      'object-picker', 'field-picker', 'field-list',
    ]);
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
