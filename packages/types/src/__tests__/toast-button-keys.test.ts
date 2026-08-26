/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Declaration pin — the two trigger-button keys the `toast` renderer reads that
 * `ToastSchema` did not declare (objectui#6496).
 *
 * ## What was wrong
 *
 * `renderers/feedback/toast.tsx` renders a `<Button>` that raises the toast:
 * `variant={schema.buttonVariant}` on :30, `{schema.buttonLabel || 'Show Toast'}`
 * on :31. The registration's own `inputs` offered `buttonLabel` as an authoring
 * control (with `defaultValue: 'Show Toast'`), and `ToastSchema` declared
 * NEITHER key — on the TS face or in the zod mirror. So the designer offered a
 * control for a key the shipped type did not have, and `buttonVariant` was read
 * by the renderer and named by nothing at all.
 *
 * `SonnerSchema` — the sibling component with the same trigger mechanism —
 * declared both all along. This card is the declare-what-runs half only;
 * `action` / `onDismiss` (declared-but-unread, the other direction the finding
 * recorded) are deliberately untouched here and stay with the objectui#6124 /
 * objectui#6182 handler-dialect family.
 *
 * ## Why `buttonVariant` is an enum and not `z.string()`
 *
 * The two faces of `SonnerSchema` disagree — `z.string()` in the mirror,
 * a six-member union in TS — so "match the sibling" does not pick a shape. The
 * ground truth is what the value REACHES: the renderer passes it straight to
 * `<Button variant={…}>`, whose prop type is
 * `VariantProps<typeof buttonVariants>['variant']`. Measured, `cva` contributes
 * NO variant class for an unrecognised key and falls back to `defaultVariants`
 * only when the value is ABSENT:
 *
 *     buttonVariants({ variant: undefined }) -> "base … bg-primary …"
 *     buttonVariants({ variant: 'ghost'   }) -> "base … hover:bg-accent …"
 *     buttonVariants({ variant: 'primary' }) -> "base …"          (no colour)
 *
 * So an open `string` does not merely under-validate — it admits values that
 * render a button with no background and no text colour, silently. The TS face
 * is the correct one and both faces here carry it. That the six ARE exactly the
 * Button's own vocabulary is pinned where the Button is visible, in
 * `components/src/__tests__/toast-button-variant-parity.test.ts`; this package
 * has zero deps and cannot see it.
 *
 * ## What this pin has teeth against, and what it does not
 *
 * Same ceiling as objectui#6170's timeline pin and objectui#5903's gantt pin.
 * `BaseSchema` is `.passthrough()` on the zod side and carries `[key: string]:
 * any` on the TS side, so:
 *
 *   - an UNDECLARED key is still ACCEPTED by both halves. Declaring these two
 *     did not buy rejection of a misspelling, and the pin below says so;
 *   - a DECLARED key IS validated. `buttonVariant: 'primary'` parsed green
 *     before this card and is refused now — that narrowing is the whole change.
 *
 * That asymmetry is also what makes this file a real reverse-verification and
 * not a round-trip that would have passed anyway: a pin asserting `safeParse`
 * SUCCEEDS on `{ buttonLabel, buttonVariant }` passes against the undeclared
 * tree too, because passthrough keeps the keys rather than refusing them. The
 * assertions with teeth are the REFUSALS (`itRefuses…`) and the
 * `@ts-expect-error` block; both were run against the undeclared tree and both
 * fail there. See the PR for the recorded red.
 */

import { describe, it, expect } from 'vitest';
import { ToastSchema } from '../zod/feedback.zod.js';
import type { ToastSchema as ToastSchemaTS } from '../feedback';

const MINIMAL = { type: 'toast' } as const;

/** The six the Button accepts, in the order `SonnerSchema`'s TS face spells them. */
const BUTTON_VARIANTS = ['default', 'secondary', 'destructive', 'outline', 'ghost', 'link'] as const;

/** Each declared key with a value its declared type refuses. */
const DECLARED: ReadonlyArray<readonly [string, unknown]> = [
  ['buttonLabel', 42],
  ['buttonVariant', 'primary'],
];

describe('ToastSchema — the two trigger-button keys are declared (objectui#6496)', () => {
  it('the mirror declares both of them', () => {
    const shape = Object.keys(ToastSchema.shape);
    for (const [key] of DECLARED) expect(shape, `mirror is missing ${key}`).toContain(key);
  });

  it('declares them OPTIONAL — a bare `{ type: "toast" }` still parses', () => {
    // Requiredness is the half the zod-mirror-parity ratchet compares against
    // `../feedback.ts`, where both are `?:`. A mirror that required one would
    // reject every toast already published, including the seven fixtures in
    // `examples/schema-catalog/src/schemas/components-feedback-toast/`.
    const result = ToastSchema.safeParse(MINIMAL);
    expect(result.success ? null : result.error.issues).toBe(null);
  });

  it('materialises NO defaults — an omitted key stays absent after parse', () => {
    // `buttonLabel` defaults IN THE RENDERER, by `||` (`schema.buttonLabel ||
    // 'Show Toast'`), and `buttonVariant` defaults inside `cva`. A `.default()`
    // here would arrive downstream as an explicit author choice; the spellings
    // are not interchangeable.
    const result = ToastSchema.safeParse(MINIMAL);
    expect(result.success).toBe(true);
    if (!result.success) return;
    for (const [key] of DECLARED) expect(key in result.data, `${key} must stay absent`).toBe(false);
  });

  it('refuses a wrong-typed value on each declared key (declared-key validation under passthrough)', () => {
    // ⚠️ THE reverse-verifiable assertion. Against the undeclared tree both keys
    // are stripped by passthrough and `.success` stays `true`, so this block is
    // red there and green here.
    for (const [key, bad] of DECLARED) {
      const result = ToastSchema.safeParse({ ...MINIMAL, [key]: bad });
      expect(result.success, `${key} accepted ${JSON.stringify(bad)}`).toBe(false);
      if (result.success) continue;
      const issue = result.error.issues.find((i) => i.path[0] === key);
      expect(issue, `${key} failed, but not on the ${key} path`).toBeTruthy();
    }
  });

  it('accepts a well-typed value on each declared key', () => {
    // Counter-probe for the assertion above: it must be the VALUE being refused,
    // not the key. A pin that only ever sees red proves nothing.
    const result = ToastSchema.safeParse({ ...MINIMAL, buttonLabel: 'Undo', buttonVariant: 'outline' });
    expect(result.success ? null : result.error.issues).toBe(null);
  });

  it('`buttonVariant` accepts exactly the Button vocabulary and nothing else', () => {
    for (const value of BUTTON_VARIANTS) {
      const result = ToastSchema.safeParse({ ...MINIMAL, buttonVariant: value });
      expect(result.success, `refused real Button variant '${value}'`).toBe(true);
    }
    // Plausible misspellings. `primary` is the likeliest — the default variant's
    // own class is `bg-primary`, so the name reads correct and is not; it and
    // the next three render an UNSTYLED button today. `''` is the one that does
    // not look wrong: `cva`'s falsy fallback silently resolves it to `default`,
    // so under an open `z.string()` it would render correctly and mean nothing.
    // Both behaviours are measured in the components parity pin.
    for (const value of ['primary', 'danger', 'warning', 'Default', '']) {
      const result = ToastSchema.safeParse({ ...MINIMAL, buttonVariant: value });
      expect(result.success, `accepted non-variant '${value}'`).toBe(false);
    }
  });

  it('is NOT `z.string()` — the shape `SonnerSchema`’s mirror uses for the same key', () => {
    // Stated as a pin because the obvious way to write this card was to copy the
    // sibling mirror verbatim. Sonner's two faces disagree with each other
    // (`z.string()` vs the six-member union); that disagreement is filed as
    // objectui#6541 and deliberately NOT resolved here.
    expect(ToastSchema.safeParse({ ...MINIMAL, buttonVariant: 'anything-at-all' }).success).toBe(false);
  });

  it('does NOT reject an undeclared key — objectui#5155’s ceiling, measured not assumed', () => {
    // Declaring the two bought validation of DECLARED keys, not rejection of
    // undeclared ones: `BaseSchema` is `.passthrough()`. Anyone reading this
    // card as "misspellings now fail" is reading it wrong, and this pin says so
    // in the one place that cannot rot.
    const misspelled = ToastSchema.safeParse({ ...MINIMAL, buttonlabel: 'Undo', buttonVarient: 'ghost' });
    expect(misspelled.success).toBe(true);
  });
});

describe('ToastSchema (TS) — compile-time pin on the same keys', () => {
  it('accepts the authoring form the renderer has always supported', () => {
    const toastSchema: ToastSchemaTS = {
      type: 'toast',
      title: 'Saved',
      variant: 'success',
      buttonLabel: 'Save record',
      buttonVariant: 'outline',
    };
    expect(toastSchema.buttonLabel).toBe('Save record');
  });

  it('refuses a wrong-typed value on every declared key', () => {
    // Each directive below fails the build (TS2578, "unused '@ts-expect-error'")
    // the moment its key stops being declared, because the member then resolves
    // to `any` through `BaseSchema`'s index signature and the assignment starts
    // succeeding. That failure is the signal this card exists to create, and it
    // is real enforcement rather than decoration because `tsconfig.test.json`
    // compiles this file (objectui#3009).

    // @ts-expect-error — `buttonLabel` is declared `string | undefined`.
    const buttonLabel: ToastSchemaTS['buttonLabel'] = 42;
    // @ts-expect-error — `buttonVariant` is declared as the six Button variants.
    const buttonVariant: ToastSchemaTS['buttonVariant'] = 'primary';

    expect([buttonLabel, buttonVariant]).toHaveLength(2);
  });

  it('accepts the well-typed value on every declared key', () => {
    // Counter-probe for the directives above: without this, a declaration
    // narrowed to `never` would satisfy both of them.
    const buttonLabel: ToastSchemaTS['buttonLabel'] = 'Show Toast';
    const buttonVariant: ToastSchemaTS['buttonVariant'] = 'ghost';
    expect([buttonLabel, buttonVariant]).toEqual(['Show Toast', 'ghost']);
  });

  it('offers every one of the six, and only those six', () => {
    const every: NonNullable<ToastSchemaTS['buttonVariant']>[] = [...BUTTON_VARIANTS];
    // @ts-expect-error — the type is closed; a seventh look is not authorable.
    const extra: ToastSchemaTS['buttonVariant'] = 'primary';
    expect([...every, extra]).toHaveLength(7);
  });
});
