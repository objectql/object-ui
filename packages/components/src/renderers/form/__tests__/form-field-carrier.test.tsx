/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * The form renderer delivers field metadata on ONE key — objectui#3233.
 *
 * `renderFieldComponent` used to hand every registered widget the metadata
 * TWICE:
 *
 *     <RegisteredComponent schema={props.field || props.schema || props}
 *                          {...registeredProps} />   // …which also has `field`
 *
 * `props.field` is set unconditionally at the only call site (`field.field ||
 * field`), so the two fallback terms were unreachable and `schema` was always
 * the *same object* as `field`. The cost was not a wrong payload, it was a
 * second spelling: ~30 widgets resolved their config as `field || schema`, and
 * every new widget author had to learn which one their host used.
 *
 * v17 retires `schema` from `FieldWidgetComponentProps`. That is only safe if
 * every payload that used to arrive through `schema` now arrives through
 * `field` UNCHANGED — "swap the key, don't drop the cargo". These tests pin
 * exactly that, by object identity rather than by shape: a structural
 * comparison would still pass if the renderer started handing widgets a
 * reconstructed copy, and a copy breaks the widgets that compare metadata
 * identity across renders.
 *
 * The sibling half of the invariant — the SDUI path through `SchemaRenderer` —
 * is pinned in `packages/fields/src/__tests__/field-carrier-sdui.test.tsx`.
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ComponentRegistry } from '@object-ui/core';
// Module scope, not `beforeAll` — the cold transform must not be billed to
// `hookTimeout`. See object-ui/no-dynamic-import-in-test-hook (objectui#3010).
import '../../../renderers';

/**
 * Props the probe was rendered with, captured per render.
 *
 * A holder object rather than a bare module variable: `react-hooks/globals`
 * forbids REASSIGNING an outer binding from a component body, and mutating a
 * property of a stable object is the repo's usual shape for a probe.
 */
const captured: { props: Record<string, any> | null } = { props: null };

/**
 * Stands in for a registered field widget (`@object-ui/components` tests never
 * load `@object-ui/fields`). It records its props instead of resolving them, so
 * the assertions can talk about the KEY and the object identity — which is what
 * the convergence is about — rather than about rendered output.
 */
function CarrierProbe(props: any) {
  captured.props = props;
  return <input data-testid={`probe-${props.name}`} value={(props.value as string) ?? ''} readOnly />;
}

beforeAll(() => {
  ComponentRegistry.register('carrierprobe', CarrierProbe, { namespace: 'field' });
}, 30000);

beforeEach(() => {
  captured.props = null;
  if (!(Element.prototype as any).scrollIntoView) {
    (Element.prototype as any).scrollIntoView = () => {};
  }
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderForm(fields: any[], defaultValues: Record<string, unknown> = {}) {
  const Form = ComponentRegistry.get('form')!;
  return render(
    <Form
      schema={{
        type: 'form',
        mode: 'create',
        showSubmit: false,
        showCancel: false,
        defaultValues,
        fields,
        onSubmit: () => {},
      }}
    />,
  );
}

describe('form renderer — `field` is the single metadata carrier (objectui#3233)', () => {
  it('delivers the metadata object the widget used to read through `schema`', () => {
    // `.field` is the declared metadata slot (#3090). This object is what
    // `schema={props.field || …}` resolved to before the convergence, so
    // identity here IS the payload-equivalence proof for this path.
    const metadata = {
      name: 'title',
      label: 'Title',
      type: 'carrierprobe',
      placeholder: 'Name the task',
      options: [{ label: 'A', value: 'a' }],
    };

    renderForm([{ name: 'title', label: 'Title', type: 'carrierprobe', field: metadata }], {
      title: 'hi',
    });

    expect(screen.getByTestId('probe-title')).toBeInTheDocument();
    expect(captured.props).not.toBeNull();
    // Same object, not a reconstruction.
    expect(captured.props!.field).toBe(metadata);
  });

  it('falls back to the form-field config itself when no `.field` metadata was stashed', () => {
    // Standalone forms author the config inline. The old producer resolved
    // `props.field` to `field.field || field` — the config object — and passed
    // THAT as `schema`. It must now arrive as `field`, same object.
    const config: Record<string, any> = {
      name: 'nickname',
      label: 'Nickname',
      type: 'carrierprobe',
      placeholder: 'What do we call you?',
    };

    renderForm([config], { nickname: '' });

    expect(captured.props).not.toBeNull();
    expect(captured.props!.field).toBe(config);
    expect(captured.props!.field.placeholder).toBe('What do we call you?');
  });

  it('does not pass a `schema` key at all', () => {
    // Key ABSENCE, not `undefined`: a widget must not be able to resolve
    // `field || schema` and get anything, or the second contract survives in
    // practice while the type claims it is gone.
    renderForm([{ name: 'title', label: 'Title', type: 'carrierprobe' }], { title: '' });

    expect(captured.props).not.toBeNull();
    expect('schema' in captured.props!).toBe(false);
  });

  it('cannot have the carrier resurrected by an authored `schema` key on the field', () => {
    // A form field carrying its own `schema` key must not reach the widget:
    // that would re-create the second carrier through metadata rather than
    // through code, and (because widgets spread leftovers onto the DOM) spill
    // an object into the markup.
    const decoy = { name: 'decoy', label: 'Decoy', type: 'carrierprobe' };

    renderForm(
      [{ name: 'title', label: 'Title', type: 'carrierprobe', schema: decoy }],
      { title: '' },
    );

    expect(captured.props).not.toBeNull();
    expect('schema' in captured.props!).toBe(false);
    expect(captured.props!.field).not.toBe(decoy);
    expect(captured.props!.field.name).toBe('title');
  });
});

describe('form renderer — retiring the carrier did NOT touch the SDUI `schema` contract', () => {
  it('still passes `schema` to a plain component reached by the bare-name fallback', () => {
    // The load-bearing distinction, and the one a "just delete `schema`"
    // refactor gets wrong: `renderFieldComponent`'s registry lookup can answer
    // with two different KINDS of component.
    //
    //  - a `field:<type>` entry is a field widget — `field` only, since v17;
    //  - the bare-name fallback is an ordinary SDUI component (the display
    //    `text` widget, `alert`, `badge` …), whose contract is the universal
    //    `schema` node. That key is NOT retired, and dropping it here rendered
    //    `undefined.className` for every form field that resolves this way
    //    (caught by `form-write-error-message.test.tsx`, whose fields are
    //    `type: 'text'` with `@object-ui/fields` not loaded).
    //
    // So this asserts the INVERSE of the tests above, on purpose.
    ComponentRegistry.register('plaindisplay', CarrierProbe);

    renderForm([{ name: 'note', label: 'Note', type: 'plaindisplay' }], { note: '' });

    expect(captured.props).not.toBeNull();
    expect(captured.props!.schema).toBeTruthy();
    expect(captured.props!.schema.name).toBe('note');
  });
});
