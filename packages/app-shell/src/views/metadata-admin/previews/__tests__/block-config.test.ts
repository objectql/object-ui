import { describe, it, expect } from 'vitest';
import { PageComponentType, RecordDetailsProps } from '@objectstack/spec/ui';
import { BLOCK_CONFIG, blockHasConfig, type PlaceholderSpec } from '../block-config';
import { BLOCK_TYPE_META, PALETTE_EXCLUSIONS } from '../block-types';
import { t } from '../../i18n';

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
 * `record:details.sections` ↔ the spec's own section-entry shape (#3819).
 *
 * The designer offered `label` / `columns` / `fields` and silently omitted
 * `name` — which the spec describes as the section's i18n ANCHOR ("resolves
 * `objects.<object>._sections.<name>.label`; a nameless section renders its
 * authored label in every locale") and which the renderer really reads
 * (`record-details.tsx`: `s.name && objectName ? sectionLabel(objectName,
 * s.name, …)`). Every section Studio produced was therefore untranslatable by
 * construction, and carried an upstream `translation-section-name-missing`
 * diagnostic no designer control could clear.
 *
 * The coverage half is DERIVED from `RecordDetailsProps`, not hand-listed, for
 * the reason the palette suite below states: a hand-written
 * `expect(name).toBeDefined()` pins today's gap closed but stays green the next
 * time the spec grows a section key the inspector never learns to author.
 */
describe('record:details sections ↔ spec section-entry coverage (#3819)', () => {
  /** The spec's authorable keys for one `sections[]` entry, read off the Zod shape. */
  const specSectionKeys: string[] = (() => {
    const props = RecordDetailsProps as unknown as { shape?: Record<string, unknown> };
    const sections = props.shape?.sections as { _def?: Record<string, any> } | undefined;
    // sections: ZodOptional< ZodArray< ZodObject > > — unwrap to the element object.
    let node: any = sections;
    for (let i = 0; i < 6 && node; i++) {
      const def = node._def ?? {};
      if (def.innerType) { node = def.innerType; continue; }
      if (def.element) { node = def.element; continue; }
      break;
    }
    const shape = node?.shape;
    return shape ? Object.keys(shape) : [];
  })();

  /** The inspector's item editors for one section. */
  const sectionsField = BLOCK_CONFIG['record:details'].find((f) => f.name === 'sections') as
    | {
        kind: 'array';
        itemFields: Array<{ name: string; label: string; kind: string; placeholder?: PlaceholderSpec }>;
      }
    | undefined;

  it('reads a non-empty section-entry shape from the spec', () => {
    // Guards the derivation itself: a spec refactor that moves the shape must
    // fail here loudly rather than turn the coverage assertion into a no-op
    // that passes over an empty list.
    expect(specSectionKeys, 'could not read RecordDetailsProps.sections[] shape').not.toEqual([]);
    expect(specSectionKeys).toContain('name');
  });

  it('exposes an editor for every key the spec declares on a section', () => {
    expect(sectionsField?.kind).toBe('array');
    const authored = (sectionsField?.itemFields ?? []).map((f) => f.name);
    const missing = specSectionKeys.filter((k) => !authored.includes(k));
    // If this fails: the spec declares a section key the block designer gives
    // authors no way to write. Add the itemField — a key that only source-mode
    // editing can reach is a key Studio-built pages structurally cannot carry.
    expect(missing, 'section keys with no designer control').toEqual([]);
  });

  it('the `name` editor is a text box carrying the snake_case convention', () => {
    const nameField = sectionsField?.itemFields.find((f) => f.name === 'name');
    expect(nameField, 'record:details sections must expose the i18n anchor `name`').toBeDefined();
    expect(nameField!.kind).toBe('text');
    // `BlockPropField` has no description/pattern affordance, so the
    // placeholder is the only place the snake_case convention can be stated —
    // the same argument the json-placeholder test below makes.
    //
    // Asserted on the RESOLVED hint in both locales, for the same reason the
    // label assertion below is: since #3979 the placeholder holds a translation
    // key, and matching /snake_case/ against the KEY would pass on the key's
    // spelling while a zh-CN author read whatever the table happens to say. The
    // convention has to survive translation — `snake_case` is a literal token
    // both locales must keep verbatim, not a word to render as 「蛇形命名」.
    const namePlaceholder = nameField!.placeholder;
    expect(namePlaceholder?.key, '`name`s placeholder must be a translation key (#3979)').toBeTruthy();
    expect(t(namePlaceholder!.key!, 'en-US'), 'en hint must state snake_case').toMatch(/snake_case/);
    expect(t(namePlaceholder!.key!, 'zh-CN'), 'zh hint must state snake_case').toMatch(/snake_case/);
    // The label must say what the box is FOR. A bare "Name" next to "Label"
    // reads as a second display string, which is how an author ends up typing
    // a heading into the anchor.
    //
    // Asserted on the RESOLVED label, in both locales, because `label` now
    // holds a translation key (#3913). Matching /i18n/i against the key itself
    // would be a claim about the key's spelling, not about the words an author
    // reads — and it would pass or fail for reasons unrelated to the wording
    // this case exists to protect.
    expect(t(nameField!.label, 'en-US')).toMatch(/i18n/i);
    expect(t(nameField!.label, 'zh-CN')).toMatch(/i18n/i);
  });

  it('lists `name` before `label` — the entry identity comes first', () => {
    // Matches `page:tabs` (`key`) and `page:accordion` (`value`), where the
    // stable identifier precedes the human label.
    const order = (sectionsField?.itemFields ?? []).map((f) => f.name);
    expect(order.indexOf('name')).toBeGreaterThanOrEqual(0);
    expect(order.indexOf('name')).toBeLessThan(order.indexOf('label'));
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
    const jsonFields = Object.entries(BLOCK_CONFIG).flatMap(([type, fields]) =>
      fields
        .filter((f) => f.kind === 'json')
        .map((f) => ({ where: `${type}.${f.name}`, spec: (f as { placeholder?: PlaceholderSpec }).placeholder })),
    );
    expect(jsonFields.length, 'no json field found — the filter is vacuous').toBeGreaterThan(0);
    expect(jsonFields.filter((f) => !f.spec).map((f) => f.where)).toEqual([]);
    // …and it stays a LITERAL (#3979). A JSON sample is the text the author
    // copies: a "translated" `"type"` / `"target"` yields metadata
    // `InlineActionSchema` rejects, so this is the one placeholder kind where
    // going through `t()` would be the bug rather than the fix.
    expect(jsonFields.filter((f) => f.spec?.key !== undefined).map((f) => f.where)).toEqual([]);
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
