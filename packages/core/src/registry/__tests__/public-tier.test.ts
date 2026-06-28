import { describe, expect, it } from 'vitest';
import { Registry } from '../Registry.js';
import { PUBLIC_BLOCKS, PUBLIC_BLOCK_SET } from '../public-blocks.js';

const C = () => null;

describe('getPublicConfigs — ADR-0080 curated public tier (capability ≠ contract)', () => {
  it('returns registered curated blocks + tier:public opt-ins, keyed by bare tag, deduped', () => {
    const r = new Registry();
    r.register('flex', C, { namespace: 'ui' });                  // curated
    r.register('object-grid', C, { namespace: 'plugin-grid' });  // curated, dual-key
    r.register('studio-admin', C, { namespace: 'app-shell' });   // capability only
    r.register('my-widget', C, { namespace: 'x', tier: 'public' }); // explicit opt-in

    const types = r.getPublicConfigs().map((c) => c.type).sort();
    expect(types).toContain('flex');
    expect(types).toContain('object-grid');
    expect(types).toContain('my-widget');        // opt-in surfaces
    expect(types).not.toContain('studio-admin'); // capability, not contract
    // bare tag, not namespaced; no duplicates from dual-key registration
    expect(types.filter((t) => t === 'object-grid')).toHaveLength(1);
    expect(types.some((t) => t.includes(':'))).toBe(false);
  });

  it('skips curated tags that are not registered (aspirational-safe list)', () => {
    const r = new Registry();
    r.register('card', C, { namespace: 'ui' });
    expect(r.getPublicConfigs().map((c) => c.type)).toEqual(['card']);
  });

  it('PUBLIC_BLOCKS is duplicate-free and matches its set', () => {
    expect(new Set(PUBLIC_BLOCKS).size).toBe(PUBLIC_BLOCKS.length);
    expect(PUBLIC_BLOCK_SET.size).toBe(PUBLIC_BLOCKS.length);
  });
});
