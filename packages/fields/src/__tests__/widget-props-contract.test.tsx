/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * `FieldWidgetComponentProps` is a CLOSED contract (objectui#3221).
 *
 * It used to end in `[key: string]: any`, which made every check over it
 * vacuous: a type claiming to have every key can never be reported as missing
 * one (objectstack#4075). Three consequences, one test each below:
 *
 *  1. a key the type does not declare is a compile error, not a silent `any`
 *     — which is what makes the `error` / `errorMessage` divergence
 *     (objectui#3222) decidable by the compiler at all;
 *  2. a MISSPELLED prop (`readOnly` for `readonly`) is rejected;
 *  3. the pass-through keys hosts genuinely forward still type-check, and
 *     still reach the rendered control at runtime — closing the type must not
 *     have been paid for by dropping real behaviour.
 *
 * (1) and (2) are compile-time: a violation fails `pnpm --filter
 * @object-ui/fields type-check`, not this run. `@ts-expect-error` inverts
 * that — the line fails to compile if the error it expects ever STOPS
 * happening, i.e. if the index signature comes back.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { TextField } from '../widgets/TextField';
import { BooleanField } from '../widgets/BooleanField';
import type { FieldWidgetComponentProps } from '../widgets/types';
import type { FieldMetadata } from '@object-ui/types';

type Assert<T extends true> = T;
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Extends<A, B> = [A] extends [B] ? true : false;

const field = { name: 'title', label: 'Title', type: 'text' } as unknown as FieldMetadata;

describe('FieldWidgetComponentProps is closed (objectui#3221)', () => {
  it('has no `[key: string]` index signature', () => {
    // The single assertion the whole change turns on. While the index
    // signature existed this was `true`, and every check below was vacuous.
    type _NotOpen = Assert<Equal<Extends<string, keyof FieldWidgetComponentProps>, false>>;
    expect(true).toBe(true);
  });

  it('rejects keys it does not declare', () => {
    const props = {} as FieldWidgetComponentProps<string>;

    // The spec's `FieldWidgetPropsSchema` declares both; this type declares
    // neither. Reading them used to give `any` and `undefined` forever.
    // Whether to ADD them is objectui#3222 — deliberately not decided here.
    // @ts-expect-error `required` is not part of this contract
    void props.required;
    // @ts-expect-error `error` is not part of this contract — this type's slot is `errorMessage`
    void props.error;

    // …and the class of bug the index signature hid best: a typo.
    // @ts-expect-error the prop is `readonly`, not React's DOM `readOnly`
    void props.readOnly;
    // @ts-expect-error the prop is `onChange`
    void props.onchange;

    expect(true).toBe(true);
  });

  it('still accepts the pass-through keys hosts actually forward', () => {
    // Closing the type is only correct if the real call sites still compile.
    // Each key here has a named producer: the form renderer, the inline-edit
    // host, or the line-item grid. Deleting one from the type breaks this.
    const passThrough: FieldWidgetComponentProps<string> = {
      value: '',
      onChange: () => {},
      field,
      // form renderer (`renderFieldComponent`)
      schema: field,
      dataSource: {},
      dependentValues: { country: 'cn' },
      dependsOn: ['country'],
      emptyHint: 'Select country first',
      name: 'title',
      // inline-edit hosts / line-item grid
      compact: true,
      autoFocus: true,
      onSelectRecord: () => {},
      onCreateNew: () => {},
      // DOM / a11y
      id: 'title-input',
      'aria-label': 'Title',
      'data-testid': 'field-title',
    };
    expect(passThrough.compact).toBe(true);
  });
});

describe('closing the type kept the pass-through behaviour', () => {
  it('forwards a11y and data attributes to the rendered input', () => {
    render(
      <TextField
        value="hello"
        onChange={() => {}}
        field={field}
        aria-label="Title"
        data-testid="title-input"
      />,
    );
    const input = screen.getByTestId('title-input');
    expect(input).toHaveAttribute('aria-label', 'Title');
    expect(input).toHaveValue('hello');
  });

  it('forwards `disabled` — a declared key, not an index-signature accident', () => {
    render(
      <BooleanField
        value={false}
        onChange={() => {}}
        field={{ name: 'active', label: 'Active', type: 'boolean' } as unknown as FieldMetadata}
        disabled
        data-testid="active-switch"
      />,
    );
    expect(screen.getByTestId('active-switch')).toBeDisabled();
  });
});
