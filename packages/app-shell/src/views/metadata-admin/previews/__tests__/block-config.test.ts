import { describe, it, expect } from 'vitest';
import { PageComponentType } from '@objectstack/spec/ui';
import { BLOCK_CONFIG, blockHasConfig } from '../block-config';
import { BLOCK_TYPE_META, PALETTE_EXCLUSIONS } from '../block-types';

describe('block-config', () => {
  it('exposes a configurable panel for every content block with authorable props', () => {
    for (const type of [
      'element:text', 'element:image', 'element:number', 'element:button',
      'page:header', 'page:card', 'page:tabs', 'page:accordion',
      'record:related_list', 'record:highlights', 'record:details', 'record:alert',
      'record:path', 'record:quick_actions', 'ai:input',
      'element:definition-list', 'element:repeater',
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

  it('also exposes the array-valued blocks', () => {
    for (const type of ['page:tabs', 'record:details', 'record:highlights']) {
      expect(blockHasConfig(type)).toBe(true);
    }
  });

  it('every field (incl. nested array items) has a name, label and valid kind', () => {
    const kinds = new Set([
      'text', 'number', 'boolean', 'select', 'string-list', 'array', 'json',
      'object-picker', 'field-picker', 'field-list', 'color',
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

/**
 * Palette coverage ↔ spec `PageComponentType` (#2943).
 *
 * The previous version of this suite hand-asserted a handful of palette
 * EXCLUSIONS (`expect(BLOCK_TYPE_META['element:form']).toBeUndefined()`), which
 * locks drift in rather than detecting it: a new spec block type could land and
 * simply never reach the palette, with nothing failing. These derive coverage
 * from the enum instead, so every value must be an explicit decision —
 * offered, or excluded with a documented reason.
 */
describe('page palette ↔ spec PageComponentType coverage', () => {
  const specNames: string[] = (() => {
    const raw = (PageComponentType as unknown as { options?: readonly string[] }).options;
    return Array.isArray(raw) ? [...raw] : [];
  })();

  it('reads a non-empty enum from the spec', () => {
    expect(specNames, 'could not read PageComponentType.options from the spec').not.toEqual([]);
  });

  it('every spec block type is either offered or explicitly excluded', () => {
    const undecided = specNames.filter(
      (t) => !(t in (BLOCK_TYPE_META as Record<string, unknown>)) && !(t in PALETTE_EXCLUSIONS),
    );
    // If this fails: a spec page-block type has no palette decision. Either add
    // it to BLOCK_TYPE_META (offered — it needs a renderer!) or to
    // PALETTE_EXCLUSIONS with the reason it is unauthorable.
    expect(undecided).toEqual([]);
  });

  it('no type is both offered and excluded', () => {
    const both = Object.keys(PALETTE_EXCLUSIONS).filter(
      (t) => t in (BLOCK_TYPE_META as Record<string, unknown>),
    );
    expect(both, 'a block cannot be offered and excluded at once').toEqual([]);
  });

  it('every exclusion names a real spec type and carries a reason', () => {
    for (const [type, reason] of Object.entries(PALETTE_EXCLUSIONS)) {
      expect(specNames, `'${type}' is not a spec PageComponentType — stale exclusion`).toContain(type);
      expect(reason.length, `'${type}' needs a reason`).toBeGreaterThan(10);
    }
  });

  it('ai:chat_window is not offered — it has no inline renderer', () => {
    // The palette used to offer it WITH a config panel while
    // `components/renderers/placeholders.tsx` deliberately excluded it to force
    // a loud error: an author dragged a block Studio advertised and got a red
    // "Unknown component type" box.
    expect((BLOCK_TYPE_META as any)['ai:chat_window']).toBeUndefined();
    expect(blockHasConfig('ai:chat_window')).toBe(false);
    expect(PALETTE_EXCLUSIONS['ai:chat_window']).toBeTruthy();
  });

  it('element:button offers an action editor — without it the button is inert', () => {
    // The generic "Advanced" section enumerates keys the block ALREADY has
    // (`Object.keys(blockProps)`), so it can edit an existing `action` but can
    // never add one. A button created in Studio therefore had no path to
    // becoming interactive at all. The spec declares the prop as
    // `InlineActionSchema` (objectstack#4135).
    const action = BLOCK_CONFIG['element:button'].find((f) => f.name === 'action');
    expect(action, 'element:button must expose an `action` field').toBeDefined();
    expect(action!.kind).toBe('json');
  });

  it('every json field carries a placeholder showing the expected shape', () => {
    // An empty JSON textarea tells an author nothing. The placeholder is the
    // only affordance a raw-JSON editor has, so a json field without one is a
    // blank box.
    const missing = Object.entries(BLOCK_CONFIG).flatMap(([type, fields]) =>
      fields
        .filter((f) => f.kind === 'json' && !(f as { placeholder?: string }).placeholder)
        .map((f) => `${type}.${f.name}`),
    );
    expect(missing).toEqual([]);
  });

  it('a block with a config panel is a block the palette offers', () => {
    // A panel for an unauthorable block is how the ai:chat_window
    // contradiction stayed invisible. Non-spec objectui blocks (`object-grid`,
    // `grid`, …) are exempt — they are palette-native, not PageComponentType.
    const orphanPanels = Object.keys(BLOCK_CONFIG).filter(
      (t) => specNames.includes(t) && !(t in (BLOCK_TYPE_META as Record<string, unknown>)),
    );
    expect(orphanPanels, 'these expose a config panel but cannot be authored').toEqual([]);
  });
});
