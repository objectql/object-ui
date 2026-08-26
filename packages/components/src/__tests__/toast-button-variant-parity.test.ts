/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * `ToastSchema['buttonVariant']` ↔ Button vocabulary parity (objectui#6496).
 *
 * objectui#6496 declared `buttonLabel` / `buttonVariant` on `ToastSchema`, and
 * the shape of the second one was the card's whole judgement call. The sibling
 * it was told to copy disagrees with ITSELF — `SonnerSchema` spells
 * `buttonVariant` as `z.string()` in the zod mirror and as a six-member union
 * in TS — so "match the sibling" picks nothing. The ground truth is what the
 * value REACHES: `renderers/feedback/toast.tsx:30` passes it straight into
 * `<Button variant={…}>`, so `ButtonProps['variant']` is the authority.
 *
 * `@object-ui/types` has zero deps and cannot import the Button, so the
 * declaration there is necessarily a hand-copied list. THIS file is what stops
 * that list being a copy: it lives where both are visible and compares them.
 * Add a seventh variant to `buttonVariants` and the type-level half below goes
 * red naming the gap, instead of the schema quietly refusing a real look.
 *
 * The runtime half measures the thing that makes an open `string` wrong. `cva`
 * contributes NO variant class for an unrecognised key, and falls back to
 * `defaultVariants` only when the value is ABSENT — so a string outside the six
 * does not render "some other style", it renders a button with no background
 * and no text colour. That is the concrete cost the enum buys out, and it is
 * measured here rather than asserted in prose.
 */

import { describe, it, expect } from 'vitest';
import type { ToastSchema } from '@object-ui/types';
import { buttonVariants, type ButtonProps } from '../ui/button';

/** The six as `ToastSchema` declares them. */
const DECLARED = ['default', 'secondary', 'destructive', 'outline', 'ghost', 'link'] as const;

/**
 * What `buttonVariants` emits for a value it does not recognise: the base
 * classes and nothing else. Every "this is not a real variant" assertion below
 * is measured against this string rather than against a hand-written class list.
 */
const NO_VARIANT_CLASSES = buttonVariants({ variant: '__not-a-variant__' as never });

describe('the declared `buttonVariant` vocabulary is the Button’s own', () => {
  it('every declared value is a real Button variant (it contributes a class)', () => {
    const inert = DECLARED.filter((v) => buttonVariants({ variant: v }) === NO_VARIANT_CLASSES);
    expect(inert, 'declared, but the Button draws nothing for them').toEqual([]);
  });

  it('every declared value is DISTINCT — no two collapse to the same look', () => {
    const rendered = DECLARED.map((v) => buttonVariants({ variant: v }));
    expect(new Set(rendered).size).toBe(DECLARED.length);
  });

  it('the declared list matches `ButtonProps["variant"]` in BOTH directions', () => {
    // The exhaustiveness pin, and the one that cannot be satisfied by copying.
    // `NonNullable` strips the `null | undefined` that `VariantProps` adds.
    //   - `declaredIsAccepted` fails if the schema declares a value the Button
    //     does not accept (the schema would invite a look that renders blank);
    //   - `acceptedIsDeclared` fails if the Button accepts a value the schema
    //     does not declare (a real look the schema refuses — what a seventh
    //     variant would cause).
    type Accepted = NonNullable<ButtonProps['variant']>;
    type Declared = NonNullable<ToastSchema['buttonVariant']>;

    const declaredIsAccepted: Accepted = null as unknown as Declared;
    const acceptedIsDeclared: Declared = null as unknown as Accepted;

    expect([declaredIsAccepted, acceptedIsDeclared]).toHaveLength(2);
  });

  it('the runtime list and the declared TYPE are the same six', () => {
    // Guards the array literal above against drifting from the type it claims
    // to enumerate — the array is what the runtime assertions iterate.
    const typed: NonNullable<ToastSchema['buttonVariant']>[] = [...DECLARED];
    expect(typed).toHaveLength(6);
  });
});

describe('why the mirror is an enum and not `z.string()`', () => {
  it('an unrecognised variant renders NO colour — it is not merely unusual', () => {
    // `primary` is the likeliest wrong spelling: the DEFAULT variant's own class
    // is `bg-primary`, so the name reads correct and produces a blank button.
    for (const bogus of ['primary', 'danger', 'warning', 'Default']) {
      expect(buttonVariants({ variant: bogus as never }), bogus).toBe(NO_VARIANT_CLASSES);
    }
    expect(NO_VARIANT_CLASSES).not.toContain('bg-primary');
  });

  it('an EMPTY variant is silently reinterpreted as `default` — cva’s falsy fallback', () => {
    // Measured, and worth its own pin because it is the one wrong value that
    // does NOT look wrong. `cva` resolves
    // `falsyToString(props.variant) || falsyToString(defaultVariants.variant)`,
    // so `''` never reaches the variant table: it takes the default look. Under
    // an open `z.string()` an author could write `buttonVariant: ''`, see a
    // correctly styled button, and never learn the value meant nothing. The
    // enum refuses it instead — pinned on the mirror side in
    // `types/src/__tests__/toast-button-keys.test.ts`.
    expect(buttonVariants({ variant: '' as never })).toBe(buttonVariants({ variant: 'default' }));
    expect(buttonVariants({ variant: '' as never })).not.toBe(NO_VARIANT_CLASSES);
  });

  it('an ABSENT variant still gets the default look — so optional stays safe', () => {
    // This is why both keys are declared OPTIONAL rather than defaulted in the
    // schema: omission already has a defined, styled outcome downstream.
    expect(buttonVariants({ variant: undefined })).toBe(buttonVariants({ variant: 'default' }));
    expect(buttonVariants({ variant: undefined })).not.toBe(NO_VARIANT_CLASSES);
  });
});
