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
  RadioGroupSchema,
  ToastSchema,
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
