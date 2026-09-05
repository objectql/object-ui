import { describe, it, expect } from 'vitest';
import {
  ACTION_LOCATIONS,
  PageAccordionProps,
  PageComponentType,
  PageHeaderProps,
  RecordDetailsProps,
} from '@objectstack/spec/ui';
import {
  arrayElementSchema,
  enumOptions,
  isShapeKeyTombstoned,
  listedShapeKeys,
  resolvePropsShape,
  shapeMemberTypeName,
} from '@object-ui/test-support';
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
  /**
   * The spec's authorable keys for one `sections[]` entry, read off the Zod shape.
   *
   * `sections` is `ZodOptional< ZodArray< ZodObject > >`, so this needs both a
   * wrapper walk and an array-element read. Both are `@object-ui/test-support`'s
   * (objectui#5872 class (2)); the six-iteration `_def.innerType` / `_def.element`
   * loop that used to stand here was one of the three disagreeing copies that
   * card censused. `arrayElementSchema` answers `undefined` for a non-array,
   * which `listedShapeKeys` turns into `[]` — the case the non-vacuity
   * assertion below exists to catch.
   */
  const specSectionKeys: string[] = listedShapeKeys(
    arrayElementSchema(resolvePropsShape(RecordDetailsProps)?.sections),
  );

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

  /**
   * Section keys the spec declares that this designer does NOT yet expose an
   * editor for — every one of them arriving with `@objectstack/spec` 17.3.0,
   * which grew the section entry from four member keys to twelve (measured:
   * gained set exactly these eight, lost set empty).
   *
   * ⛔ This is a DEFERRAL, not a dismissal, and it is deliberately a hand-kept
   * list rather than a loosened assertion. Eight new inspector controls is a
   * feature, and the bump that revealed the gap is not the place to build it
   * (maintainer ruling on objectui#7122, 2026-09-05, ruled item 5: "推迟,单开
   * feature 卡 —— 8 个新控件是功能,不是 bump 的尾巴"). Six of the eight are
   * already HONOURED by the renderer through `DetailSection` (`icon`,
   * `description`, `collapsible`, `defaultCollapsed`, `showBorder`,
   * `headerColor`), so the gap is genuinely the control and not the capability;
   * `group` is unimplemented here, and `hideEmpty` is retired on purpose
   * (objectui#7129). All eight are documented on the `sections` input's
   * description, which the sibling `recordDetailsInputs.spec-parity.test.ts`
   * enforces — so they are discoverable in source mode today.
   *
   * The assertion below keeps its full force for everything else: a NINTH key
   * landing upstream still fails here, and so does any entry of this list that
   * stops being a spec key (a stale deferral) or that quietly gains a control
   * without being removed from the list.
   */
  const DEFERRED_SECTION_CONTROLS = [
    'group',
    'hideEmpty',
    'collapsible',
    'showBorder',
    'defaultCollapsed',
    'icon',
    'description',
    'headerColor',
  ];

  it('exposes an editor for every key the spec declares on a section, bar the deferred eight', () => {
    expect(sectionsField?.kind).toBe('array');
    const authored = (sectionsField?.itemFields ?? []).map((f) => f.name);
    const missing = specSectionKeys.filter(
      (k) => !authored.includes(k) && !DEFERRED_SECTION_CONTROLS.includes(k),
    );
    // If this fails: the spec declares a section key the block designer gives
    // authors no way to write, and that is not one of the eight consciously
    // deferred above. Add the itemField — a key that only source-mode editing
    // can reach is a key Studio-built pages structurally cannot carry.
    expect(missing, 'section keys with no designer control').toEqual([]);
  });

  it('the deferral list is neither stale nor a cover for a control that now exists', () => {
    // The two ways the exemption above could rot, both closed here rather than
    // left to a reader's diligence. Without this the list would be a permanent
    // hole: a key removed upstream, or one that later gained a control, would
    // sit in it forever and quietly shrink what the coverage assertion checks.
    const authored = (sectionsField?.itemFields ?? []).map((f) => f.name);
    expect(
      DEFERRED_SECTION_CONTROLS.filter((k) => !specSectionKeys.includes(k)),
      'deferred key the spec no longer declares — drop it from the list',
    ).toEqual([]);
    expect(
      DEFERRED_SECTION_CONTROLS.filter((k) => authored.includes(k)),
      'deferred key that now HAS a designer control — drop it from the list',
    ).toEqual([]);
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
    // Matches `page:tabs` (`key`), where the stable identifier precedes the
    // human label. `page:accordion` items no longer have an identifier field
    // to compare against — its `value` was removed as dead input (#5212): the
    // renderer derives the panel id and never reads what was authored.
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
  const specNames: string[] = enumOptions(PageComponentType);

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

  describe("record:quick_actions `location` — the designer's action-location dropdown", () => {
    const locationField = () =>
      BLOCK_CONFIG['record:quick_actions'].find((f) => f.name === 'location') as
        | { options?: Array<{ value: string }> }
        | undefined;

    // POSITIVE half. Without it the negative pin below passes on an empty
    // option list, which is how a deleted dropdown reads as a passing test.
    it('offers exactly the locations the spec declares', () => {
      const offered = (locationField()?.options ?? []).map((o) => o.value);
      expect([...offered].sort()).toEqual([...ACTION_LOCATIONS].sort());
    });

    // NEGATIVE pin, converted from the coverage the removed option used to
    // carry. `global_nav` was retired from `ACTION_LOCATIONS` in
    // @objectstack/spec 17.0.0-rc.6 (objectstack#6888, maintainer ruling
    // 2026-08-09 direction 2): no running-app surface ever rendered it, and the
    // console's ⌘K palette reads no action metadata at all. An option the
    // schema now rejects by name must not be offerable, or the designer teaches
    // authors — and every AI copying this corpus — to write metadata that fails
    // to parse.
    it('does NOT offer the retired global_nav location', () => {
      const offered = (locationField()?.options ?? []).map((o) => o.value);
      expect(offered.length, 'option list is empty — the pin would be vacuous').toBeGreaterThan(0);
      expect(offered).not.toContain('global_nav');
      expect(ACTION_LOCATIONS as readonly string[]).not.toContain('global_nav');
    });

    // The i18n side of the same removal: an option key kept past its option is
    // dead vocabulary the next author reads as a live surface, so BOTH locale
    // tables lost `…option.location.global_nav`. `t()` returns the key
    // unchanged on a miss, which is exactly "this locale has no translation".
    it('has no leftover translation for the retired option in either locale', () => {
      const key = 'engine.inspector.pageBlock.option.location.global_nav';
      expect(t(key, 'en-US')).toBe(key);
      expect(t(key, 'zh-CN')).toBe(key);
    });
  });
});

/**
 * `page:header.icon` — the designer field that outlived the spec key (#3829).
 *
 * The same shape as the `global_nav` removal above, and it is here because
 * BLOCK_CONFIG is a PUBLISH FACE with no parity gate of its own: nothing in
 * this repo diffs the designer's field set against `ComponentPropsMap`, so a
 * field can go on offering a key the contract has retired and every derived
 * check stays green. This file is the substitute, per key.
 *
 * What was wrong: `PageHeaderProps.icon` was retired in @objectstack/spec
 * 17.0.0 (objectstack#6946 / PR objectstack#7115, ADR-0087 D2, maintainer
 * ruling 2026-08-09 route (c)) because no renderer ever read it — the canonical
 * `page:header` draws its identity from the record chrome (`recordChrome`) and
 * per-action `icon`s. The retirement's own prescription said "zero producers",
 * and for `page:card.actions` that was true; for this key it was not. The
 * designer kept offering an icon box for the canonical `page:header`, so an
 * author (an AI author especially) filled it in and the platform — which used
 * to drop the value silently — now rejects the whole node BY NAME. A retirement
 * that leaves its producer standing makes the failure worse, not better.
 *
 * The `layout:page-header` ALIAS keeps its own `icon` input, deliberately: that
 * is a different renderer with a real read point, and it is guarded separately
 * in `packages/layout/src/__tests__/page-header-authorable-keys.test.tsx`. The
 * two are opposite read facts about two renderers, not an inconsistency.
 */
describe('page:header `icon` — the designer field retired with the spec key (#3829)', () => {
  const fieldNames = () => BLOCK_CONFIG['page:header'].map((f) => f.name);

  // POSITIVE half, for the reason the location dropdown states: without it the
  // negative pin below passes just as happily on a deleted panel.
  it('still offers the canonical header fields the renderer does implement', () => {
    expect(fieldNames()).toEqual(['title', 'subtitle', 'breadcrumb']);
  });

  it('does NOT offer the retired `icon` field', () => {
    expect(fieldNames().length, 'field list is empty — the pin would be vacuous').toBeGreaterThan(0);
    expect(fieldNames()).not.toContain('icon');
  });

  // Why `Object.keys(shape)` cannot be the test, and why this pin exists at all.
  // ADR-0087 D2 retirement REPLACES the member with `z.never()` rather than
  // deleting it, so `icon` is STILL a key of the shape: every "is it declared?"
  // check reads green while the parser rejects every value by name. The
  // criterion is `@object-ui/test-support`'s shared judge (objectui#3809,
  // converged here by objectui#4947), which OR-s the structural channel this
  // block used to spell out by hand with the `[REMOVED]` description channel.
  it('the spec tombstones `icon` rather than deleting it', () => {
    expect(listedShapeKeys(PageHeaderProps)).toContain('icon');
    expect(isShapeKeyTombstoned(PageHeaderProps, 'icon')).toBe(true);
    // Non-vacuity for the probe itself: a Zod-internals change that made every
    // member read `'never'` would make the line above meaningless, and a live
    // key is the only thing that can tell the difference.
    expect(isShapeKeyTombstoned(PageHeaderProps, 'title')).toBe(false);
    expect(shapeMemberTypeName(PageHeaderProps, 'title')).toBeTruthy();
  });

  // The i18n side, exactly as the retired option above: a key kept past its
  // field is dead vocabulary the next author reads as a live surface, so BOTH
  // locale tables lost the label and its placeholder. `t()` returns the key
  // unchanged on a miss, which is precisely "this locale has no translation".
  it('has no leftover translation for the retired field in either locale', () => {
    for (const key of [
      'engine.inspector.pageBlock.field.page:header.icon',
      'engine.inspector.pageBlock.placeholder.page:header.icon',
    ]) {
      expect(t(key, 'en-US')).toBe(key);
      expect(t(key, 'zh-CN')).toBe(key);
    }
  });
});

/**
 * `page:accordion` `title` / items `value` — designer inputs no renderer
 * reads (#5212).
 *
 * Same PUBLISH-FACE-with-no-parity-gate reasoning as the `page:header.icon`
 * describe above: nothing diffs the designer's field set against
 * `ComponentPropsMap`, so a field can go on offering a key nothing on the
 * render path honours and every derived check stays green.
 *
 * What was wrong, verified against the CURRENT tree (the card that reported
 * this was six days stale and one of its three findings had already been
 * fixed elsewhere — objectui#3829 / PR #4794 dropped `page:header.icon`
 * before this issue was even filed):
 *   - `title`: `PageAccordionRenderer` (`renderers/layout/containers.tsx`)
 *     reads `items`, `allowMultiple`, `variant` — never `schema.title`, and
 *     there is no accordion-level heading in the rendered output.
 *     `PageAccordionProps` never declared a `title` member either, so this
 *     was dead on BOTH sides, not merely unread by one renderer.
 *   - items `value`: the renderer OVERWRITES it — `itemsWithValue =
 *     items.map((it, idx) => ({ ...it, value: `panel-${idx}` }))` — so an
 *     authored value never reaches the Radix item. `PageAccordionProps.items[]`
 *     deliberately does not declare `value` either, and carries a `guidance`
 *     prescription (added with the #5212 spec-side half) telling an author
 *     who writes it by hand to remove the key.
 *
 * Neither is symmetric with `page:tabs`: one component over, an authored
 * `items[].value` (designer field name `key`) IS read, with a `tab-${idx}`
 * fallback only when absent (`itemsWithValue` for `page:tabs`, same file).
 * `PageTabsProps.items[].value` is a real, declared schema member. The
 * accordion's panel id is unconditionally derived; the tabs one is genuinely
 * live — this suite touches the accordion only.
 */
describe('page:accordion `title` / items `value` — dead designer inputs (#5212)', () => {
  const fieldNames = () => BLOCK_CONFIG['page:accordion'].map((f) => f.name);
  const itemsField = () =>
    BLOCK_CONFIG['page:accordion'].find((f) => f.name === 'items') as
      | { kind: 'array'; itemFields: Array<{ name: string }> }
      | undefined;

  // POSITIVE half: without it the negative pins below would pass just as
  // happily on a designer panel that lost ALL of its fields.
  it('still offers the item fields the renderer does implement', () => {
    expect(fieldNames()).toEqual(['items']);
    expect(itemsField()?.itemFields.map((f) => f.name)).toEqual(['label']);
  });

  it('does NOT offer the accordion-level `title` field', () => {
    expect(fieldNames().length, 'field list is empty — the pin would be vacuous').toBeGreaterThan(0);
    expect(fieldNames()).not.toContain('title');
  });

  it('does NOT offer an item `value` field', () => {
    const names = itemsField()?.itemFields.map((f) => f.name) ?? [];
    expect(names.length, 'item field list is empty — the pin would be vacuous').toBeGreaterThan(0);
    expect(names).not.toContain('value');
  });

  // The spec side: unlike `page:header.icon` (a tombstoned `z.never()`
  // member — the key still exists on the shape), `title` and items `value`
  // were never declared at all, so a strict-object rejection is the right
  // envelope to assert (same `unrecognized_keys` pattern as
  // `text-input-inputs-spec-parity.test.ts`), not a tombstone-type probe.
  it('the spec rejects an authored `title` — not a member of PageAccordionProps', () => {
    const result = PageAccordionProps.safeParse({
      title: 'Section heading',
      items: [{ label: 'One', children: [] }],
    });
    expect(result.success).toBe(false);
    const codes = result.success ? [] : result.error.issues.map((i) => i.code);
    expect(codes).toContain('unrecognized_keys');
    const refused = result.success
      ? []
      : result.error.issues.flatMap((i) => (i as unknown as { keys?: string[] }).keys ?? []);
    expect(refused).toContain('title');
  });

  it('the spec rejects an authored item `value` — not a member of the item shape', () => {
    const result = PageAccordionProps.safeParse({
      items: [{ label: 'One', value: 'panel-custom', children: [] }],
    });
    expect(result.success).toBe(false);
    const codes = result.success ? [] : result.error.issues.map((i) => i.code);
    expect(codes).toContain('unrecognized_keys');
    const refused = result.success
      ? []
      : result.error.issues.flatMap((i) => (i as unknown as { keys?: string[] }).keys ?? []);
    expect(refused).toContain('value');
  });

  // Non-vacuity for both safeParse probes above: a base accordion with only
  // the declared keys must parse clean, or the rejections above could be
  // attributable to something other than the extra key under test.
  it('a base accordion with only declared keys parses clean', () => {
    const result = PageAccordionProps.safeParse({
      items: [{ label: 'One', children: [] }],
      allowMultiple: true,
      variant: 'card',
    });
    expect(result.success).toBe(true);
  });

  // The i18n side, exactly as the `page:header.icon` removal above: a key
  // kept past its field is dead vocabulary the next author reads as a live
  // surface, so BOTH locale tables lost these two keys.
  it('has no leftover translation for the retired fields in either locale', () => {
    for (const key of [
      'engine.inspector.pageBlock.field.page:accordion.title',
      'engine.inspector.pageBlock.field.page:accordion.items.value',
    ]) {
      expect(t(key, 'en-US')).toBe(key);
      expect(t(key, 'zh-CN')).toBe(key);
    }
  });
});
