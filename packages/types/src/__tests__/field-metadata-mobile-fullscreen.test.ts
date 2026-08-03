/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * `mobile_fullscreen` has exactly ONE legal carrier: the field metadata
 * (objectui#3245).
 *
 * The flag is a projection of the form-level
 * `ObjectFormSchema.mobile.fullscreenLongText` setting, produced by `ObjectForm`
 * (`@object-ui/plugin-form`) and read by `TextAreaField` (`@object-ui/fields`)
 * off `FieldWidgetComponentProps.field` — whose type is the `FieldMetadata`
 * union pinned below. It is deliberately NOT an `@objectstack/spec` property:
 * nobody authors it on an object's field definition, the form runtime stamps it.
 *
 * Declaring it is the point. While it was undeclared, the producer stamped it
 * onto the FormField through an `as FormField` cast and the consumer read it
 * through an `as any` — two untyped ends that could not disagree out loud, and
 * for the whole of the feature's life they DID disagree: the form renderer
 * forwards `field: field.field || field`, so an auto-generated field handed the
 * widget its raw metadata (flag-free) while `stripRegisteredFieldProps` dropped
 * the prop copy. Every generated form silently lost the affordance, and no type
 * anywhere could report it.
 *
 * The compile-time pins are the load-bearing part: `tsc -p tsconfig.test.json`
 * (chained off this package's `type-check`) is what runs them. Deleting the
 * declaration — or moving it off the base every `FieldMetadata` member extends —
 * is a compile error, not a silently passing test.
 */

import { describe, it, expect } from 'vitest';
import type { BaseFieldMetadata, FieldMetadata, TextareaFieldMetadata } from '../index';

/* -------------------------------------------------------------------------- */
/* Compile-time pins — compiled by tsconfig.test.json, chained off type-check. */
/* -------------------------------------------------------------------------- */

type Assert<T extends true> = T;
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type IsAny<T> = 0 extends 1 & T ? true : false;

describe('FieldMetadata.mobile_fullscreen (objectui#3245)', () => {
  it('is declared on the metadata base as an optional boolean', () => {
    // Keeps the pins below from passing vacuously: an `any`-typed property
    // would satisfy nothing while looking green.
    type _NotAny = Assert<Equal<IsAny<BaseFieldMetadata['mobile_fullscreen']>, false>>;

    // Optional boolean — never required (no form is obliged to project it) and
    // never widened.
    type _OptionalBoolean = Assert<
      Equal<BaseFieldMetadata['mobile_fullscreen'], boolean | undefined>
    >;

    expect(true).toBe(true);
  });

  it('is readable off the FieldMetadata union without narrowing first', () => {
    // `FieldMetadata` is what `FieldWidgetComponentProps.field` resolves to,
    // and `TextAreaField` reads the flag there. Declaring it on a single union
    // member instead would make that read a compile error and push the next
    // author straight back to the `as any` this issue exists to remove.
    type _ReadableOffTheUnion = Assert<
      Equal<FieldMetadata['mobile_fullscreen'], boolean | undefined>
    >;

    // The long-text members inherit it like any other base property.
    type _TextareaInheritsIt = Assert<
      Equal<TextareaFieldMetadata['mobile_fullscreen'], boolean | undefined>
    >;

    expect(true).toBe(true);
  });

  it('is assignable on a long-text field metadata object', () => {
    // The exact shape `ObjectForm` produces: the stashed object-field metadata
    // with the projected flag folded in.
    const stamped: TextareaFieldMetadata = {
      name: 'body',
      type: 'textarea',
      label: 'Body',
      mobile_fullscreen: true,
    };

    expect(stamped.mobile_fullscreen).toBe(true);
  });

  it('is absent, not false, when the form did not opt in', () => {
    const plain: TextareaFieldMetadata = { name: 'body', type: 'textarea' };

    expect(plain.mobile_fullscreen).toBeUndefined();
    expect('mobile_fullscreen' in plain).toBe(false);
  });
});
