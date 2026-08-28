/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * objectui#6157 — the live `SchemaExample` fixtures on three component docs
 * pages taught keys and values the shipped `@object-ui/types` surface does not
 * declare. #6143 round 2 had just corrected the PROSE on those same pages; the
 * demo rendered beside the prose still contradicted it, and a reader copies the
 * demo more readily than an interface block.
 *
 * ## Why this file exists rather than "the gates went green"
 *
 * Nothing in CI reads these files as schemas. `check-doc-component-types` reads
 * `type` literals out of docs code blocks; `check-doc-snippet-types` compiles
 * `ts`/`tsx` fences. A JSON fixture key that no gate parses goes green whatever
 * it says — objectui#5250 records exactly that hole. So a green CI run after
 * #6157 means "nothing else broke", NOT "the corrections are right". This file
 * is what makes the corrections measurable, and it is deliberately written so
 * that each assertion is paired with a counter-probe that proves the assertion
 * can still fail.
 *
 * ## The three rejection classes are NOT the same class
 *
 * Measured on the built `packages/types/dist` (2026-08-25):
 *
 *   1. **Value rejection** — the toast action payload's `variant`. `'destructive'`
 *      is refused by `ToastSchema` (`z.enum`, `zod/feedback.zod.js:59`) and by
 *      `feedback.d.ts:123`. A full `safeParse` is therefore the right probe.
 *   2. **Key rejection, TypeScript only** — `shortcut` on a `CommandItem`.
 *      `CommandItemSchema` is a bare `z.object`, so zod SILENTLY STRIPS the key
 *      and reports success; only `form.d.ts:1329` refuses it (TS2353). The probe
 *      is therefore round-trip equality, not `.success`.
 *   3. **Declared-elsewhere, refused by neither** — `direction` on a
 *      `radio-group`. `BaseSchema` is `.passthrough()` (`zod/base.zod.js:171`)
 *      AND carries `[key: string]: any` (`base.d.ts`), so zod and tsc both
 *      ACCEPT the key. The authority is that `RadioGroupSchema` declares
 *      `orientation` (`form.d.ts:377`, `zod/form.zod.js:263`) and nothing reads
 *      `direction`. The probe must be structural — asserting `.success` here
 *      would assert nothing at all.
 *
 * ## SUPERSEDED by objectui#6250 — where the toast fixtures went
 *
 * The two toast fixtures used to be `{ "type": "button", …, "onClick": { action:
 * 'toast', … } }`, and the block that used to head this file asserted that the
 * **top-level** `"variant": "destructive"` — a genuine `ButtonSchema` member —
 * survived any correction to the nested payload.
 *
 * #6250 removed the envelope that fact was about. `ButtonSchema.onClick` is
 * `z.function()`, so all fourteen `components-feedback-toast/*` and
 * `components-feedback-sonner/*` fixtures were a RED `safeParse` on the
 * ENVELOPE, and nothing anywhere read a handler key as an action object — the
 * demos are now the registered `type: 'toast'` / `type: 'sonner'` nodes their
 * own renderers execute. There is no button schema left to carry a button
 * variant, so that block is REPLACED rather than reworded: what #6157 actually
 * established — that the toast variant VALUE is a declared `ToastSchema`
 * member, with `destructive` refused — is carried forward below against the
 * top-level `variant` those nodes now declare, counter-probe and all.
 *
 * `toast-demo-dispatch-6250.test.tsx` carries the other half: that clicking
 * each corrected demo raises a real toast, which no parse can see.
 *
 * ## What this file deliberately does not assert
 *
 * The radio-group correction is INERT until objectui#6158 teaches the renderer
 * to read `orientation` — on this tree the renderer reads neither key, so the
 * vertical and horizontal demos render identically. That the two demos' markup
 * DIVERGES is assertable only once #6158 and this card have both landed;
 * neither PR can assert it alone and neither fakes it.
 */

import { describe, it, expect } from 'vitest';
import {
  ButtonSchema,
  CommandItemSchema,
  MenuItemSchema,
  RadioGroupSchema,
  ToastSchema,
  ToasterSchema,
} from '@object-ui/types/zod';
import { allExamples, getExample } from '../src/index.js';

type Json = Record<string, unknown>;

const schemaOf = (id: string): Json => getExample(id).schema as unknown as Json;

/**
 * Read the literal members off a shipped zod field, unwrapping the
 * `.optional()` / `.default()` layers the generator emits. Pinning to the
 * SHIPPED enum rather than to a hand-copied string list is the point: if the
 * platform ever adds or drops a member, this file follows it instead of
 * asserting yesterday's vocabulary.
 */
function enumOptionsOf(field: unknown): readonly string[] {
  let node = field as { options?: readonly string[]; unwrap?: () => unknown };
  for (let i = 0; i < 4 && node && !node.options; i += 1) {
    node = node.unwrap?.() as typeof node;
  }
  if (!node?.options) throw new Error('not an enum-bearing field');
  return node.options;
}

const TOAST_FIXTURES = [
  'components-feedback-toast/destructive',
  'components-feedback-toast/error-toast',
] as const;

describe('toast fixtures: the registered spelling, not an action object off `onClick` (objectui#6250)', () => {
  it.each(TOAST_FIXTURES)('%s is a `toast` node that parses green under ToastSchema', (id) => {
    const fixture = schemaOf(id);
    expect(fixture.type).toBe('toast');
    expect(fixture).not.toHaveProperty('onClick');
    const result = ToastSchema.safeParse(fixture);
    expect(result.error?.issues ?? []).toEqual([]);
    expect(result.success).toBe(true);
  });

  it('counter-probe: the retired envelope is still RED under ButtonSchema, so the block above bites', () => {
    const retired = {
      type: 'button',
      label: 'Destructive Toast',
      variant: 'destructive',
      onClick: {
        action: 'toast',
        variant: 'error',
        title: 'Error',
        description: 'Something went wrong.',
      },
    };
    const result = ButtonSchema.safeParse(retired);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['onClick']);
    expect(result.error?.issues[0]?.message).toContain('expected function, received object');
  });
});

describe('toast fixtures: the variant value is a declared member (objectui#6157, carried forward)', () => {
  const toastVariants = enumOptionsOf(ToastSchema.shape.variant);

  it('ToastSchema declares `error` and refuses `destructive` — the control for this block', () => {
    expect(toastVariants).toContain('error');
    expect(toastVariants).not.toContain('destructive');
  });

  it.each(TOAST_FIXTURES)('%s declares a variant ToastSchema knows', (id) => {
    const fixture = schemaOf(id);
    expect(fixture.variant).toBe('error');
    expect(toastVariants).toContain(fixture.variant as string);
  });

  it.each(TOAST_FIXTURES)(
    '%s counter-probe: the pre-#6157 value is still refused, so the assertion above bites',
    (id) => {
      const payload = { ...schemaOf(id), variant: 'destructive' };
      const result = ToastSchema.safeParse(payload);
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.path).toEqual(['variant']);
    },
  );
});

describe('command palette fixture: every item key survives a CommandItem parse', () => {
  /**
   * `CommandItemSchema` is a bare `z.object`, so an undeclared key is STRIPPED
   * and `.success` stays true. Round-trip equality is what detects it.
   */
  const items = (
    (schemaOf('components-form-command/command-palette-with-shortcuts')
      .groups as Json[])[0].items as Json[]
  );

  it('the fixture still has the three items it is on the page to show', () => {
    expect(items).toHaveLength(3);
  });

  it.each([0, 1, 2])('item %i loses no authored key when parsed', (i) => {
    expect(CommandItemSchema.parse(items[i])).toEqual(items[i]);
  });

  it('counter-probe: an item carrying the removed `shortcut` key fails this same check', () => {
    const withInventedKey = { ...items[0], shortcut: ['Ctrl', 'N'] };
    expect(CommandItemSchema.safeParse(withInventedKey).success).toBe(true);
    expect(CommandItemSchema.parse(withInventedKey)).not.toEqual(withInventedKey);
  });
});

describe('radio-group fixtures: the layout key is the declared one', () => {
  const RADIO_FIXTURES = [
    ['components-form-radio-group/vertical-layout', 'vertical'],
    ['components-form-radio-group/horizontal-layout', 'horizontal'],
  ] as const;

  const declaredKeys = Object.keys(
    (RadioGroupSchema as unknown as { shape: Record<string, unknown> }).shape,
  );

  it('`orientation` is declared and `direction` is not — the control for this block', () => {
    expect(declaredKeys).toContain('orientation');
    expect(declaredKeys).not.toContain('direction');
  });

  it('passthrough is why `.success` cannot be the probe here', () => {
    const accepted = RadioGroupSchema.safeParse({
      type: 'radio-group',
      direction: 'vertical',
      options: [{ value: 'sm', label: 'Small' }],
    });
    expect(accepted.success).toBe(true);
  });

  it.each(RADIO_FIXTURES)('%s declares orientation=%s and no direction', (id, value) => {
    const fixture = schemaOf(id);
    expect(fixture).not.toHaveProperty('direction');
    expect(fixture.orientation).toBe(value);
    expect(enumOptionsOf(RadioGroupSchema.shape.orientation)).toContain(value);
    expect(RadioGroupSchema.safeParse(fixture).success).toBe(true);
  });
});

/**
 * objectui#6250, generalized past the two pages that reported it.
 *
 * The card's shape is "an action object hung off a handler key", and a grep for
 * one literal (`"action": "toast"`) under-counts it by construction — the sonner
 * half spells the same shape `{ action: 'sonner', … }`, and one fixture spells
 * it `{ action: { label, onClick } }`. So the sweep is over the SHAPE: every key
 * that reads as a handler slot, at every depth, in every entry.
 *
 * What it deliberately does NOT cover: a handler key holding a STRING. That is
 * the handler-EXPRESSION dialect — whether an expression is a supported handler
 * form is objectui#6182's open decision, not this card's — and the corpus still
 * has exactly one, which is what the positive control below pins. A sweep that
 * banned handler keys outright would be answering #6182 by accident.
 */
describe('catalog corpus: no fixture hangs an action object off a handler key (objectui#6250)', () => {
  type Handler = { where: string; value: unknown };

  const isHandlerKey = (key: string) => /^on[A-Z]/.test(key) || key === 'events';

  function collect(node: unknown, where: string, acc: Handler[] = []): Handler[] {
    if (Array.isArray(node)) {
      node.forEach((n, i) => collect(n, `${where}[${i}]`, acc));
      return acc;
    }
    if (!node || typeof node !== 'object') return acc;
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if (isHandlerKey(key)) acc.push({ where: `${where}.${key}`, value });
      collect(value, `${where}.${key}`, acc);
    }
    return acc;
  }

  const entries = allExamples();
  const handlers = entries.flatMap((e) => collect(e.schema, e.id));

  it('the walker descends into nested children — positive control', () => {
    // A zero result from a walker that never descends is an untested tool, not
    // a measurement. This hit is two levels down, inside `children`, and it is
    // the handler-EXPRESSION case #6182 owns.
    expect(handlers.map((h) => h.where)).toContain(
      'components-feedback-toaster/with-toast-trigger.children[0].onClick',
    );
    expect(entries.length).toBeGreaterThan(400);
  });

  it('every handler value in the corpus is a string expression, never an action object', () => {
    const objectValued = handlers
      .filter((h) => h.value !== null && typeof h.value === 'object')
      .map((h) => `${h.where} = ${JSON.stringify(h.value)}`);
    expect(objectValued).toEqual([]);
  });
});


/**
 * objectui#6494 — the same charter as #6250 ("docs teach only what runs"), one
 * component over and one shape across.
 *
 * `provider` was authored by four toaster fixtures and taught by five sites on
 * `components/feedback/toaster.mdx`, and `ToasterSchema` declares no such key.
 * The renderer (`renderers/feedback/toaster.tsx`) reads exactly `position` and
 * `limit` and mounts sonner unconditionally, so the page's "ObjectUI supports
 * two toast providers" claim was false on the tree that shipped it: the two
 * provider demos rendered byte-identically.
 *
 * ## Why this sweep is over toaster NODES and not over the two demo files
 *
 * The card was filed naming two fixtures. A premise re-verification on merged
 * `main` corrected it to three — by SWAPPING one nested hit for another rather
 * than adding it. The tree actually carried FOUR, because BOTH nested nodes had
 * the key: `custom-position-limit.children[0]` and
 * `with-toast-trigger.children[1]`. Two successive demo-shaped censuses each
 * saw one of the two and reported a complete face.
 *
 * That is the lesson the block above already wrote down — a sweep written for
 * one shape is blind to another in the same file — and the hit it missed sat in
 * the very file that block pins as its own positive control. So this block is
 * structural and depth-first over the corpus: every node whose `type` is
 * `toaster`, wherever it sits, must carry only keys the shipped `ToasterSchema`
 * declares. A per-file or root-only assertion would re-inherit the exact
 * blindness that produced the undercount twice.
 *
 * ## Why `.success` is not the probe here, and neither is round-trip equality
 *
 * This is the file's class 3 (declared-elsewhere, refused by neither), and it is
 * strictly worse than the radio-group case. `BaseSchema` is `.passthrough()`, so
 * zod does not merely ACCEPT `provider` — it PRESERVES it. Measured on the built
 * dist: `ToasterSchema.safeParse({ type: 'toaster', provider: 'sonner' })`
 * returns success with `provider` still on `.data`. So the class-2 probe —
 * round-trip equality, which is what catches the stripped `shortcut` key above —
 * is blind here too. Only a structural key-subset assertion bites, and the
 * counter-probe below pins both blindnesses so this block cannot be "simplified"
 * into a parse.
 */
describe('catalog corpus: no toaster node carries a key ToasterSchema does not declare (objectui#6494)', () => {
  type ToasterNode = { where: string; node: Json };

  function collectToasters(node: unknown, where: string, acc: ToasterNode[] = []): ToasterNode[] {
    if (Array.isArray(node)) {
      node.forEach((n, i) => collectToasters(n, `${where}[${i}]`, acc));
      return acc;
    }
    if (!node || typeof node !== 'object') return acc;
    const record = node as Json;
    if (record.type === 'toaster') acc.push({ where, node: record });
    for (const [key, value] of Object.entries(record)) {
      collectToasters(value, `${where}.${key}`, acc);
    }
    return acc;
  }

  const declaredKeys = Object.keys(
    (ToasterSchema as unknown as { shape: Record<string, unknown> }).shape,
  );
  const toasters = allExamples().flatMap((e) => collectToasters(e.schema, e.id));

  it('`position` and `limit` are declared and `provider` is not — the control for this block', () => {
    expect(declaredKeys).toContain('position');
    expect(declaredKeys).toContain('limit');
    expect(declaredKeys).not.toContain('provider');
  });

  it('counter-probe: passthrough ACCEPTS and PRESERVES `provider`, so no parse can be the probe', () => {
    const authored = { type: 'toaster', provider: 'sonner' };
    const result = ToasterSchema.safeParse(authored);
    expect(result.success).toBe(true);
    // ...and unlike the stripped `shortcut` key above, round-trip equality holds.
    expect(result.data).toEqual(authored);
  });

  it('the walker reaches NESTED toaster nodes — positive control', () => {
    // Both of these sit inside `children`, and both carried `provider` before
    // this card. A census that only read root-level nodes would report a clean
    // sweep of the two named demos and miss exactly these two.
    expect(toasters.map((t) => t.where)).toEqual(
      expect.arrayContaining([
        'components-feedback-toaster/custom-position-limit.children[0]',
        'components-feedback-toaster/with-toast-trigger.children[1]',
      ]),
    );
  });

  it('every toaster node in the corpus carries only declared keys', () => {
    const undeclared = toasters.flatMap(({ where, node }) =>
      Object.keys(node)
        .filter((key) => !declaredKeys.includes(key))
        .map((key) => `${where}.${key}`),
    );
    expect(undeclared).toEqual([]);
  });
});


/**
 * objectui#6249 — the live menubar demo, one component over from #6494 and
 * under the same charter ("docs teach what runs").
 *
 * `content/docs/components/overlay/menubar.mdx` renders
 * `components-overlay-menubar/application-menubar` through `SchemaExample`, and
 * that fixture authored two spellings the shipped `MenuItem` does not have:
 *
 *   1. **A wrong-typed declared key.** `shortcut` was an ARRAY on ten items.
 *      `MenuItem.shortcut` is `string` (`overlay.ts`, mirrored as
 *      `z.string().optional()`). Unlike #6157's `CommandItem.shortcut`, the key
 *      here is REAL — only the value type diverged.
 *   2. **An undeclared key standing in for a declared one.** Two entries were
 *      `{ "type": "separator" }`, while `MenuItem` declares `separator?:
 *      boolean` and `renderers/overlay/menubar.tsx:33` branches on
 *      `item.separator`. The truthiness test failed, so both entries fell
 *      through to the `MenubarItem` branch and drew an EMPTY MENU ROW where the
 *      divider belongs. That half was live on the published page.
 *
 * The `shortcut` keys are removed rather than restrung as `"Ctrl+T"`: the
 * menubar renderer reads `separator`, `children`, `disabled` and `label` and
 * never `shortcut`, so any spelling of it is an affordance this page cannot
 * draw. (Triage ruled this; ⛔ widening `MenuItem.shortcut` to `string |
 * string[]` and teaching the renderer to draw it was ruled OUT as a capability
 * expansion, and is not what this block pins.)
 *
 * ## UPDATE (objectui#6523, maintainer ruling 2026-08-27) — the split this
 * section used to describe is now fixed, and the counter-probe below changed
 * shape as a direct result
 *
 * Both paragraphs immediately below are historical: they describe the corpus
 * as it stood before objectui#6523 landed. `dropdown-menu.tsx` and
 * `context-menu.tsx` now branch on the DECLARED `item.separator`, exactly
 * like `menubar.tsx` always did, and `MenuItem` is a discriminated union (a
 * command item with a required `label`, or `{ separator: true }` with none) —
 * see `../../packages/types/src/overlay.ts`. The retired `{ type: 'separator'
 * }` dialect is now a TOMBSTONE (`type?: never` / `z.never().optional()`),
 * refused at parse time rather than silently stripped, on all three
 * containers at once (they share the one `MenuItem` type). The two catalog
 * fixtures that used to author it —
 * `components-overlay-dropdown-menu/basic-dropdown-menu.json` and
 * `components-overlay-context-menu/basic-context-menu.json` — were migrated
 * to `{ "separator": true }` in the same change.
 *
 * ## Why this sweep is STILL scoped to `menubar` nodes, not widened to the family
 *
 * The renderer split that used to block a family-wide sweep is gone, but the
 * sweep below stays `menubar`-only anyway: `collectMenubarItems` walks one
 * node shape (`{ type: 'menubar', menus: [{ items }] }`), and widening it to
 * also match `dropdown-menu`/`context-menu` nodes is a separate verification
 * surface this fix does not need — the counter-probes further down already
 * exercise the shared `MenuItemSchema` directly, which covers the retired
 * dialect for all three containers without walking their corpora at all. The
 * `dropdown-menu`/`context-menu` catalog fixtures ARE checked, just not by
 * this walker: `context-menu-item-icon.test.tsx` renders
 * `basic-context-menu.json`'s items directly, and the icon-resolution suites
 * next to it exercise `basic-dropdown-menu.json`'s.
 *
 * (Historical, pre-#6523:) It would have been one line to sweep every
 * `MenuItem`-shaped container. That would have been WRONG then:
 * `dropdown-menu.tsx:46` and `context-menu.tsx:44` used to branch on
 * `item.type === 'separator'` — the undeclared spelling — so their fixtures'
 * `{ "type": "separator" }` entries drew real dividers on THOSE containers
 * while failing the assertions below, which are `menubar`-shaped. A
 * family-wide sweep would have either failed on fixtures outside that card's
 * fence, or forced the renderer change objectui#6249's triage explicitly
 * declined to make (that renderer change is what objectui#6523 later ruled).
 *
 * ## Why `.success` was not the probe before this fix, in BOTH directions —
 * and is now the probe in both, because both directions changed
 *
 * (Historical, pre-#6523:) `MenuItemSchema` was a bare `z.object`, so it
 * stripped an undeclared key and reported success — the class-2 blindness
 * this file already records for `CommandItem`. And the declared separator
 * spelling did not parse green either, because `MenuItem.label` was REQUIRED
 * with no way to omit it for a divider.
 *
 * Both of those were the SAME defect (declared ≠ enforced) pointing opposite
 * ways, and objectui#6523 corrected both ends at once: `MenuItem` became a
 * union so the declared divider spelling parses green, and `type` became a
 * declared `never` tombstone so the undeclared spelling is REFUSED rather
 * than stripped. The counter-probe below now asserts `.success` in both
 * directions on purpose — it is the fixed, not the "cannot be simplified",
 * shape. What must not be re-simplified is the STRUCTURAL sweep above this
 * block: it still walks the actual corpus, which a `.success` probe never
 * substitutes for.
 */
describe('catalog corpus: every menubar item uses the declared MenuItem spellings (objectui#6249)', () => {
  type Located = { where: string; item: Json };

  /**
   * Read the declared key set BEHAVIOURALLY rather than off `.shape`.
   * `MenuItemSchema` sits behind a `z.lazy`, whose inner object zod 4 does not
   * expose under any stable public name — and an introspection helper that
   * silently resolved to the wrong node would report a confident, wrong
   * vocabulary. Feeding the schema every candidate key and reading back what
   * SURVIVES uses the strip behaviour itself as the instrument, so this control
   * measures the shipped schema instead of the shape of zod's internals.
   */
  function declaredKeysOf(schema: { parse: (v: unknown) => unknown }, probe: Json): string[] {
    return Object.keys(schema.parse(probe) as Json).sort();
  }

  /** Depth-first over an items array, descending through submenu `children`. */
  function collectItems(items: unknown, where: string, acc: Located[]): void {
    if (!Array.isArray(items)) return;
    items.forEach((raw, i) => {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return;
      const item = raw as Json;
      acc.push({ where: `${where}[${i}]`, item });
      collectItems(item.children, `${where}[${i}].children`, acc);
    });
  }

  /** Every item of every `menubar` node in the corpus, at any nesting depth. */
  function collectMenubarItems(node: unknown, where: string, acc: Located[] = []): Located[] {
    if (Array.isArray(node)) {
      node.forEach((n, i) => collectMenubarItems(n, `${where}[${i}]`, acc));
      return acc;
    }
    if (!node || typeof node !== 'object') return acc;
    const record = node as Json;
    if (record.type === 'menubar' && Array.isArray(record.menus)) {
      (record.menus as Json[]).forEach((menu, m) => {
        collectItems((menu as Json)?.items, `${where}.menus[${m}].items`, acc);
      });
    }
    for (const [key, value] of Object.entries(record)) {
      collectMenubarItems(value, `${where}.${key}`, acc);
    }
    return acc;
  }

  // Two calibration probes, not one combined object (objectui#6523): `MenuItem`
  // is now a union of a command arm and a divider arm that DISAGREE on
  // `separator` (`false | undefined` vs `true`), so a single object carrying
  // both a `label` AND `separator: true` matches neither arm cleanly and is
  // not a meaningful "declared keys" instrument any more. `type` is no longer
  // part of this probe at all — see the dedicated refusal pins below, which
  // is where it moved (a hard refusal, not a strip, can't be read back by
  // `declaredKeysOf`'s "call `.parse` and see what survives" method, since a
  // refusal never returns a value to read keys off).
  const declaredCommandKeys = declaredKeysOf(MenuItemSchema, {
    label: 'probe',
    icon: 'file',
    disabled: false,
    shortcut: 'Ctrl+T',
    value: 'probe',
  });
  const declaredDividerKeys = declaredKeysOf(MenuItemSchema, {
    separator: true,
    value: 'probe',
  });
  const items = allExamples().flatMap((e) => collectMenubarItems(e.schema, e.id));

  it('label/icon/disabled/shortcut survive on the command arm; the unknown `value` key does not — the control', () => {
    expect(declaredCommandKeys.sort()).toEqual(['disabled', 'icon', 'label', 'shortcut'].sort());
  });

  it('`separator` survives on the divider arm; the unknown `value` key does not — the control', () => {
    expect(declaredDividerKeys).toEqual(['separator']);
  });

  it('the sweep reaches the published demo and every one of its items — non-vacuity', () => {
    expect(items.map((i) => i.where)).toEqual(
      expect.arrayContaining([
        'components-overlay-menubar/application-menubar.menus[0].items[2]',
        'components-overlay-menubar/application-menubar.menus[1].items[2]',
      ]),
    );
    expect(items).toHaveLength(13);
    expect(allExamples().length).toBeGreaterThan(400);
  });

  it('the walker descends into submenu `children` — synthetic positive control', () => {
    // No menubar fixture in the corpus authors a submenu today, so the corpus
    // cannot exercise the descent. objectui#6494 was undercounted TWICE by
    // censuses whose descent was never proven, so it is pinned here instead of
    // assumed.
    const synthetic = {
      type: 'menubar',
      menus: [
        {
          label: 'File',
          items: [{ label: 'Recent', children: [{ label: 'a.txt', shortcut: ['Ctrl', '1'] }] }],
        },
      ],
    };
    const found = collectMenubarItems(synthetic, 'synthetic');
    expect(found.map((f) => f.where)).toEqual([
      'synthetic.menus[0].items[0]',
      'synthetic.menus[0].items[0].children[0]',
    ]);
    expect(found.filter((f) => Array.isArray(f.item.shortcut))).toHaveLength(1);
  });

  it('no menubar item carries an array-valued `shortcut`', () => {
    const arrayValued = items
      .filter(({ item }) => Array.isArray(item.shortcut))
      .map(({ where }) => `${where}.shortcut`);
    expect(arrayValued).toEqual([]);
  });

  it('no menubar item spells a divider as the undeclared `type: "separator"`', () => {
    const undeclaredSpelling = items
      .filter(({ item }) => item.type === 'separator')
      .map(({ where }) => where);
    expect(undeclaredSpelling).toEqual([]);
  });

  it('every divider uses the declared boolean spelling the renderer branches on', () => {
    const dividers = items.filter(({ item }) => 'separator' in item);
    expect(dividers.map((d) => d.where)).toEqual([
      'components-overlay-menubar/application-menubar.menus[0].items[2]',
      'components-overlay-menubar/application-menubar.menus[1].items[2]',
    ]);
    for (const { where, item } of dividers) {
      expect(item.separator, where).toBe(true);
    }
  });

  /**
   * `MenuItem` being a UNION (objectui#6523) means a failed `.safeParse`'s
   * top issue is `{ code: 'invalid_union', path: [], errors: [...] }` — one
   * error array PER union member, not a single flat `path` any more. This
   * reads the field name(s) named across every member's errors, so a
   * counter-probe can still assert "the failure is about key X" without
   * hard-coding which union member zod tried first.
   */
  function unionFailurePathKeys(result: { success: boolean; error?: unknown }): string[] {
    if (result.success) return [];
    const issues = (result.error as { issues: Array<Record<string, unknown>> }).issues;
    return issues.flatMap((issue) => {
      const branches = issue.errors as Array<Array<{ path: unknown[] }>> | undefined;
      if (!branches) return [String((issue.path as unknown[])[0])];
      return branches.flatMap((branch) => branch.map((e) => String(e.path[0])));
    });
  }

  it('counter-probe: the pre-#6249 array `shortcut` is REFUSED, so the sweep above bites', () => {
    const authored = { label: 'New Tab', shortcut: ['Ctrl', 'T'] };
    const result = MenuItemSchema.safeParse(authored);
    expect(result.success).toBe(false);
    expect(unionFailurePathKeys(result)).toContain('shortcut');
    // ...and the corrected item, with the key gone, parses green.
    expect(MenuItemSchema.safeParse({ label: 'New Tab' }).success).toBe(true);
  });

  it('counter-probe: the separator defect is now visible to a plain `.safeParse` in BOTH directions (objectui#6523, fixed)', () => {
    // Historical shape of this probe (pre-#6523): the undeclared `type`
    // spelling was SILENTLY STRIPPED by the bare `z.object`, so a labelled
    // item carrying it parsed green and round-tripped lossily — a `.success`
    // probe was blind to exactly the defect this block exists to catch. That
    // is why the STRUCTURAL sweep above this describe block exists at all:
    // before this fix, no `.safeParse` call could have stood in for it.
    //
    // `type` is now a declared `z.never()` refusal, not an absence, so the
    // same call fails outright instead of stripping and succeeding.
    const undeclared = MenuItemSchema.safeParse({ label: 'x', type: 'separator' });
    expect(undeclared.success).toBe(false);
    expect(unionFailurePathKeys(undeclared)).toContain('type');

    // And the DECLARED spelling now parses green FOR THE FIRST TIME:
    // `MenuItem` became a discriminated union (objectui#6523) specifically so
    // a label-less divider is representable — before this fix,
    // `MenuItem.label` was required with no way to omit it, so this EXACT
    // value — the menubar renderer's own `defaultProps` divider
    // (`menubar.tsx`) — failed a strict parse against the shipped type. The
    // shipped default not satisfying the shipped type was the contract gap;
    // this is the fix.
    const declared = MenuItemSchema.safeParse({ separator: true });
    expect(declared.success).toBe(true);
    expect(declared.success ? declared.data : undefined).toEqual({ separator: true });
  });

  it('counter-probe: `type` refuses BOTH its retired values, not just the one this file had a fixture for', () => {
    // `type` has no partial refusal — a `z.never()` tombstone cannot admit
    // one string and reject another. `dropdown-menu`/`context-menu` also used
    // to branch on `item.type === 'label'` (a section-heading spelling no
    // fixture in this corpus ever authored), and retiring the declared
    // divider's impostor necessarily retired this one too.
    expect(MenuItemSchema.safeParse({ label: 'Section', type: 'label' }).success).toBe(false);
  });
});
