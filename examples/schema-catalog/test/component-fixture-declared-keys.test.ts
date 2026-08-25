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
 * ## The one key on these fixtures that is CORRECT and must stay
 *
 * Both toast fixtures ALSO carry a **top-level** `"variant": "destructive"`.
 * That one is a genuine `ButtonSchema` member (`form.d.ts:30`,
 * `zod/form.zod.js:153`) — the demo's button really is destructive-styled. Only
 * the occurrence nested inside the `onClick` toast payload was invented. A
 * blanket find-and-replace over `destructive` in these two files breaks two
 * working buttons; the first `describe` block below exists to make that
 * mistake turn this file red.
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
  RadioGroupSchema,
  ToastSchema,
} from '@object-ui/types/zod';
import { getExample } from '../src/index.js';

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

describe('toast fixtures: the top-level button variant is CORRECT and stays (objectui#6157 rider)', () => {
  const buttonVariants = enumOptionsOf(ButtonSchema.shape.variant);

  it('ButtonSchema really does declare `destructive` — the control for this whole block', () => {
    expect(buttonVariants).toContain('destructive');
  });

  it.each(TOAST_FIXTURES)('%s keeps a top-level destructive button', (id) => {
    const fixture = schemaOf(id);
    expect(fixture.type).toBe('button');
    expect(fixture.variant).toBe('destructive');
    expect(buttonVariants).toContain(fixture.variant as string);
  });
});

describe('toast fixtures: the nested onClick payload uses a declared toast variant', () => {
  /**
   * The payload is `{ action: 'toast', ... }` hung off `onClick`. The shipped
   * surface declares `ButtonSchema.onClick` as a FUNCTION, so this action-object
   * idiom has no declared type of its own — `ToastSchema` is the nearest
   * governing declaration, and it is unambiguous here: the payload's other keys
   * (`title`, `description`, `duration`) are exactly ToastSchema's.
   */
  const asToast = (fixture: Json): Json => {
    const { action, ...rest } = fixture.onClick as Json;
    expect(action).toBe('toast');
    return { type: 'toast', ...rest };
  };

  it.each(TOAST_FIXTURES)('%s payload parses green under ToastSchema', (id) => {
    const result = ToastSchema.safeParse(asToast(schemaOf(id)));
    expect(result.error?.issues ?? []).toEqual([]);
    expect(result.success).toBe(true);
  });

  it.each(TOAST_FIXTURES)(
    '%s counter-probe: the pre-#6157 value is still refused, so the assertion above bites',
    (id) => {
      const payload = { ...asToast(schemaOf(id)), variant: 'destructive' };
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
