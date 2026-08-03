/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * `TextAreaField`'s fullscreen affordance has ONE source (objectui#3232).
 *
 * It used to be read from four places with a `??` chain — a `mobileFullscreen`
 * (camelCase) prop, `field.mobile_fullscreen`, a `mobile_fullscreen` prop, and
 * `schema.mobile_fullscreen`. Only the field-metadata flag was ever produced:
 * `ObjectForm` stamps it on long-text fields from
 * `ObjectFormSchema.mobile.fullscreenLongText`. The camelCase prop had no
 * producer anywhere in the repo, and the snake_case prop could not arrive
 * because `stripRegisteredFieldProps` (components/src/renderers/form/form.tsx)
 * removes it from what registered widgets are forwarded.
 *
 * So this file pins both halves of that convergence:
 *
 *  1. **The live path still works.** The metadata flag drives the affordance
 *     end to end — button, dialog, and the committed edit. Deleting the dead
 *     reads must not have cost the working behaviour, and this is the test
 *     that fails if a future refactor drops the real read too.
 *  2. **The retired prop spellings are gone**, at compile time (they are not
 *     on the closed `FieldWidgetComponentProps`, objectui#3221) and at runtime
 *     (a host that passes one anyway gets no affordance). Convergence means a
 *     misspelled flag is now inert and loud, not silently absorbed.
 *
 * Note the built-in (unregistered) `textarea` branch in `form.tsx` reads
 * `mobile_fullscreen || fullscreen` off the form-field props and renders its
 * own `FullscreenTextarea`. That is a separate, live path and is untouched
 * here — this file is about the registered `field:textarea` widget only.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

import { TextAreaField } from '../TextAreaField';
import type { FieldWidgetComponentProps } from '../types';
import type { FieldMetadata } from '@object-ui/types';

const fieldMeta = (extra: Record<string, unknown> = {}) =>
  ({
    name: 'description',
    label: 'Description',
    type: 'textarea',
    ...extra,
  }) as unknown as FieldMetadata;

describe('TextAreaField mobile fullscreen — the metadata flag is the only source', () => {
  it('renders the expand affordance when the field metadata sets mobile_fullscreen', () => {
    render(
      <TextAreaField
        value="hello"
        onChange={() => {}}
        field={fieldMeta({ mobile_fullscreen: true })}
      />,
    );

    expect(screen.getByTestId('textarea-fullscreen-toggle')).toBeInTheDocument();
  });

  it('opens the fullscreen dialog and commits the edited draft', () => {
    const onChange = vi.fn();
    render(
      <TextAreaField
        value="hello"
        onChange={onChange}
        field={fieldMeta({ mobile_fullscreen: true })}
      />,
    );

    // Closed until the affordance is used — the dialog is not just mounted.
    expect(screen.queryByTestId('textarea-fullscreen-dialog')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('textarea-fullscreen-toggle'));
    expect(screen.getByTestId('textarea-fullscreen-dialog')).toBeInTheDocument();

    const dialogInput = screen.getByTestId('textarea-fullscreen-input');
    expect(dialogInput).toHaveValue('hello');

    fireEvent.change(dialogInput, { target: { value: 'hello from fullscreen' } });
    // The draft is local until "Done" — the host is not notified per keystroke.
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('textarea-fullscreen-save'));
    expect(onChange).toHaveBeenCalledWith('hello from fullscreen');
  });

  it('reads the flag off `schema` when the host supplies no `field`', () => {
    // `SchemaRenderer` passes the authored node as `schema`; the widget
    // resolves its config as `field || schema`, which is why deleting the
    // separate `schema.mobile_fullscreen` read lost nothing. `field` is
    // required by the type, so the cast reproduces the runtime shape only.
    render(
      <TextAreaField
        value=""
        onChange={() => {}}
        field={undefined as unknown as FieldMetadata}
        schema={fieldMeta({ mobile_fullscreen: true })}
      />,
    );

    expect(screen.getByTestId('textarea-fullscreen-toggle')).toBeInTheDocument();
  });

  it('renders no affordance when the metadata does not opt in', () => {
    render(<TextAreaField value="hello" onChange={() => {}} field={fieldMeta()} />);

    expect(screen.queryByTestId('textarea-fullscreen-toggle')).not.toBeInTheDocument();
    expect(screen.queryByTestId('textarea-fullscreen-dialog')).not.toBeInTheDocument();
  });
});

describe('TextAreaField mobile fullscreen — the retired prop spellings', () => {
  it('does not declare them on the widget contract', () => {
    const props = {} as FieldWidgetComponentProps<string>;

    // Both were read by the widget and written by no host. With the closed
    // props type (objectui#3221) they are now compile errors, so a future
    // author reaches for the metadata flag instead of a silently ignored prop.
    // @ts-expect-error `mobileFullscreen` is not part of this contract
    void props.mobileFullscreen;
    // @ts-expect-error `mobile_fullscreen` is a metadata key, not a widget prop
    void props.mobile_fullscreen;

    expect(true).toBe(true);
  });

  it('ignores them at runtime when a host passes them anyway', () => {
    // Untyped hosts (plain JS, `as any` spreads) can still get these onto the
    // element. They must not resurrect the affordance: the metadata flag is
    // the contract. Unknown props land on the DOM spread, so React's unknown
    // -attribute warnings are expected noise here and are suppressed.
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const hostProps = {
        mobileFullscreen: true,
        mobile_fullscreen: true,
      } as unknown as Partial<FieldWidgetComponentProps<string>>;

      render(
        <TextAreaField
          value="hello"
          onChange={() => {}}
          field={fieldMeta()}
          {...hostProps}
        />,
      );

      expect(screen.queryByTestId('textarea-fullscreen-toggle')).not.toBeInTheDocument();
    } finally {
      consoleError.mockRestore();
    }
  });
});
