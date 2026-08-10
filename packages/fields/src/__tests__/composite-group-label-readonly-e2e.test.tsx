/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * End-to-end: a group-labelled field's visible label names the widget's surface
 * in EVERY state it renders — not only the editable one (objectui#3990).
 *
 * The residual of objectui#3961 / #3975. Those two moved the association from an
 * inert `<label for>` to the WAI-ARIA group pattern (the label publishes its own
 * `id`, the widget answers with `aria-labelledby` + a role that can carry a
 * name), and pinned it in `composite-group-label-e2e.test.tsx` — entirely on
 * EDITABLE samples. Every one of these widgets also returns EARLY, before the
 * container that consumes that IDREF, for a field-level `readonly: true` and for
 * an option list that resolved to zero offered options. Measured on
 * `origin/main` with a real form + the same bare registration this file uses,
 * counting the elements that reference the host label's published id:
 *
 * ```
 *                              consumers  byLabelText  namedByRole
 * multiselect  readonly+value      0           0          []
 * multiselect  readonly+empty      0           0          []
 * multiselect  zeroOptions         0           0          []
 * multiselect  editable            1           1          [group:1]     ← #3975
 * ```
 *
 * All seven types measured identically, in every readonly state. Both `for`-less
 * halves of the association were dropped by those returns, so the visible label
 * was the accessible name of NOTHING — the same user-visible outcome #3961
 * fixed, in the states its probe never sampled. It is not a regression of either
 * PR: before #3961 the same states rendered a `for` pointing at an id no element
 * carried, which named nothing either. The shape changed; the defect did not.
 *
 * ## Why the role is `group` here even where the editable branch says otherwise
 *
 * `aria-labelledby` on a role-less `div` / `span` names nothing (`generic`
 * prohibits an author name), so the readonly surface needs a role that supports
 * naming, and `group` is the only one that does not lie about interactivity:
 *
 *  - `radio` answers `radiogroup` while editable, but its readonly branch renders
 *    the CHOSEN option's label as text — there is not one radio left in it;
 *  - `file` answers `button` while editable (the dropzone is its single control),
 *    but readonly there is no dropzone, only the file names.
 *
 * So the roles this file expects deliberately differ from `HOSTED` in the
 * editable e2e for exactly those two, and the last describe block pins that the
 * editable answers are untouched.
 *
 * The widgets are registered raw rather than through `registerAllFields()`, whose
 * `React.lazy` loaders put an unbounded module load inside a bounded `findBy`
 * window — this repo's known flake generator (AGENTS.md 测试纪律, objectui#3010).
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ComponentRegistry } from '@object-ui/core';
// Module scope: pulls in the form renderer's registration side effect.
import '@object-ui/components';

import { AddressField } from '../widgets/AddressField';
import { GeolocationField } from '../widgets/GeolocationField';
import { CheckboxesField } from '../widgets/CheckboxesField';
import { RadioField } from '../widgets/RadioField';
import { RatingField } from '../widgets/RatingField';
import { FileField } from '../widgets/FileField';
import { MultiSelectField } from '../widgets/MultiSelectField';
import { SelectField } from '../widgets/SelectField';

const WIDGETS: Record<string, any> = {
  address: AddressField,
  geolocation: GeolocationField,
  checkboxes: CheckboxesField,
  radio: RadioField,
  rating: RatingField,
  file: FileField,
  multiselect: MultiSelectField,
};

/** The option widgets — the only ones with a zero-option state to measure. */
const OPTION_TYPES = ['checkboxes', 'radio', 'multiselect'] as const;

/**
 * Where the placeholder sits when a readonly field has no value. Three real
 * shapes, so the assertion is per-widget rather than one presumed form:
 *
 *  - `'is-placeholder'`: the whole surface IS `EmptyValue`, which therefore
 *    carries the group props itself;
 *  - `'contains-placeholder'`: `geolocation` keeps its icon row and renders the
 *    placeholder inside it, so the row is the named group;
 *  - `'no-placeholder'`: `rating` has no empty state at all — an unset rating
 *    renders the same "0 / max" star row.
 */
const EMPTY_SHAPE: Record<string, 'is-placeholder' | 'contains-placeholder' | 'no-placeholder'> = {
  address: 'is-placeholder',
  checkboxes: 'is-placeholder',
  radio: 'is-placeholder',
  file: 'is-placeholder',
  multiselect: 'is-placeholder',
  geolocation: 'contains-placeholder',
  rating: 'no-placeholder',
};

const OPTIONS = [
  { label: 'Alpha', value: 'a' },
  { label: 'Beta', value: 'b' },
];

/** A stored value per type, so the readonly branch renders its filled shape. */
const VALUES: Record<string, unknown> = {
  address: { street: '1 Main St', city: 'Springfield' },
  geolocation: { latitude: 1.5, longitude: 2.5 },
  checkboxes: ['a'],
  radio: 'a',
  rating: 3,
  file: { id: 'f1', name: 'report.pdf' },
  multiselect: ['a'],
};

/** The role the EDITABLE branch answers with — unchanged by this issue. */
const EDITABLE_ROLE: Record<string, string> = {
  address: 'group',
  geolocation: 'group',
  checkboxes: 'group',
  radio: 'radiogroup',
  rating: 'group',
  file: 'button',
  multiselect: 'group',
};

const TYPES = Object.keys(WIDGETS);

beforeAll(() => {
  for (const [type, Component] of Object.entries(WIDGETS)) {
    ComponentRegistry.register(type, Component as any, {
      namespace: 'field',
      skipFallback: true,
      // The declaration under test, mirroring `FIELD_TYPES_GROUP_LABELLED`.
      labelling: 'group',
    });
  }
}, 30000);

beforeEach(() => {
  if (!(Element.prototype as any).scrollIntoView) {
    (Element.prototype as any).scrollIntoView = () => {};
  }
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** HTML's labelable elements — the only ones a `<label for>` can address. */
const LABELABLE = new Set(['button', 'input', 'meter', 'output', 'progress', 'select', 'textarea']);

function labelTargets(): Array<{ forId: string; resolves: boolean; labelable: boolean }> {
  return Array.from(document.querySelectorAll('label'))
    .map((el) => {
      const forId = el.getAttribute('for') ?? '';
      const target = forId ? document.getElementById(forId) : null;
      return {
        forId,
        resolves: !!target,
        labelable: !!target && LABELABLE.has(target.tagName.toLowerCase()),
      };
    })
    .filter((l) => l.forId !== '');
}

function fieldConfig(
  type: string,
  opts: { readonly?: boolean; zeroOptions?: boolean } = {},
): Record<string, unknown> {
  const config: any = { name: `f_${type}`, label: `Group Label ${type}`, type };
  if ((OPTION_TYPES as readonly string[]).includes(type)) {
    config.options = opts.zeroOptions ? [] : OPTIONS;
  }
  // Field-level readonly — the state this issue is about. NOT the form-level
  // `mode: 'view'`, which renders a different (detail) path and was already
  // naming its group correctly.
  if (opts.readonly) config.readonly = true;
  return config;
}

/** The real form renderer hosting one field — the #3990 reproduction. */
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
      }}
    />,
  );
}

const hostLabelOf = (name: string): HTMLLabelElement => {
  const el = document.querySelector(`[data-field="${name}"] > label`);
  if (!el) throw new Error(`no host label rendered for field "${name}"`);
  return el as HTMLLabelElement;
};

describe('a READONLY group-labelled field is named by its host label (objectui#3990)', () => {
  it.each(TYPES)('%s: the host label names the readonly surface', (type) => {
    renderForm([fieldConfig(type, { readonly: true })], { [`f_${type}`]: VALUES[type] });

    // 0 before this fix, 1 after — for all seven, whatever their readonly shape.
    const named = screen.getAllByRole('group', { name: `Group Label ${type}` });
    expect(named).toHaveLength(1);
    // The same association read from the other side.
    expect(screen.getAllByLabelText(`Group Label ${type}`)).toEqual(named);
  });

  it.each(TYPES)('%s: the readonly surface is the element the host handed its id to', (type) => {
    // The name and the host id must land on the SAME element, as in the editable
    // path: the readonly branches dropped BOTH, so the `…-form-item` id existed
    // on no element in the document.
    renderForm([fieldConfig(type, { readonly: true })], { [`f_${type}`]: VALUES[type] });

    const named = screen.getByRole('group', { name: `Group Label ${type}` });
    expect(named.getAttribute('id')).toMatch(/-form-item$/);
  });

  it.each(TYPES)('%s: readonly with NO value names the placeholder surface', (type) => {
    renderForm([fieldConfig(type, { readonly: true })]);

    const named = screen.getByRole('group', { name: `Group Label ${type}` });
    const shape = EMPTY_SHAPE[type];
    if (shape === 'is-placeholder') {
      // `EmptyValue` itself is the field's whole surface here. Its own
      // `aria-label` ("No value") stays in the markup and is outranked by
      // `aria-labelledby` per accname — on the `generic` role it carried before
      // this change, that author name was not exposed at all.
      expect(named).toHaveAttribute('data-slot', 'empty-value');
      expect(named).toHaveAccessibleName(`Group Label ${type}`);
    } else if (shape === 'contains-placeholder') {
      expect(named.querySelector('[data-slot="empty-value"]')).not.toBeNull();
    } else {
      // `rating` has no empty state: an unset rating is the same star row.
      expect(named.querySelector('[data-slot="empty-value"]')).toBeNull();
      expect(named.textContent).toContain('0 / 5');
    }
  });

  it.each(TYPES)('%s: the host label still emits an id and no `for` when readonly', (type) => {
    renderForm([fieldConfig(type, { readonly: true })], { [`f_${type}`]: VALUES[type] });

    const label = hostLabelOf(`f_${type}`);
    expect(label).not.toHaveAttribute('for');
    expect(label.id).not.toBe('');
    // A dangling IDREF fails silently, which reads exactly like success.
    expect(document.getElementById(label.id)).toBe(label);
    // And no OTHER label in the field is left with an inert/dangling `for`.
    expect(labelTargets().filter((l) => !l.resolves || !l.labelable)).toEqual([]);
  });

  it.each(TYPES)('%s: the readonly surface takes the two whole-field keys ONLY', (type) => {
    // The narrow pair is deliberate (`toHostGroupProps`): a readonly display has
    // no focusable control, so control-only plumbing must not ride along. `name`
    // is the one that would be a DOM leak of the objectui#3291 class — it is
    // legal on form controls only, and these surfaces are `div` / `span`.
    renderForm([{ ...fieldConfig(type, { readonly: true }), description: 'Some help' }], {
      [`f_${type}`]: VALUES[type],
    });

    const named = screen.getByRole('group', { name: `Group Label ${type}` });
    expect(named).not.toHaveAttribute('name');
    expect(named).not.toHaveAttribute('aria-invalid');
  });

  it('all seven readonly in ONE form: each is named exactly once', () => {
    const fields = TYPES.map((type) => fieldConfig(type, { readonly: true }));
    const values = Object.fromEntries(TYPES.map((type) => [`f_${type}`, VALUES[type]]));
    renderForm(fields, values);

    for (const type of TYPES) {
      expect(screen.getAllByRole('group', { name: `Group Label ${type}` })).toHaveLength(1);
    }
    expect(labelTargets().filter((l) => !l.resolves || !l.labelable)).toEqual([]);
  });
});

describe('a ZERO-OPTION group-labelled field is named by its host label (objectui#3990)', () => {
  it.each(OPTION_TYPES)('%s: the unfillable-options box is the named group', (type) => {
    renderForm([fieldConfig(type, { zeroOptions: true })]);

    const named = screen.getAllByRole('group', { name: `Group Label ${type}` });
    expect(named).toHaveLength(1);
    // The named element is the shared `OptionsEmptyState` box, not some ancestor:
    // in this state it is the only thing the widget renders.
    expect(named[0]).toBe(screen.getByTestId(`${type}-empty-f_${type}`));
    expect(named[0].getAttribute('id')).toMatch(/-form-item$/);
    expect(screen.getAllByLabelText(`Group Label ${type}`)).toEqual(named);
  });

  it.each(OPTION_TYPES)('%s: readonly wins over zero options, and is still named', (type) => {
    // Both early returns at once. The readonly branch comes first, so the
    // measured surface is the readonly one — and it must still be named.
    renderForm([fieldConfig(type, { readonly: true, zeroOptions: true })], {
      [`f_${type}`]: VALUES[type],
    });

    expect(screen.getAllByRole('group', { name: `Group Label ${type}` })).toHaveLength(1);
    expect(screen.queryByTestId(`${type}-empty-f_${type}`)).toBeNull();
  });
});

describe('the editable answers are untouched (objectui#3961 / #3975 regression)', () => {
  it.each(TYPES)('%s: editable keeps its own role, readonly answers `group`', (type) => {
    // The drift pin: one widget, two surfaces, both named. `radio` and `file`
    // deliberately answer with DIFFERENT roles in the two states, so a future
    // "unify the roles" edit has to come here and say which it broke.
    renderForm([fieldConfig(type)], { [`f_${type}`]: VALUES[type] });
    expect(
      screen.getAllByRole(EDITABLE_ROLE[type], { name: `Group Label ${type}` }),
    ).toHaveLength(1);
    cleanup();

    renderForm([fieldConfig(type, { readonly: true })], { [`f_${type}`]: VALUES[type] });
    expect(screen.getAllByRole('group', { name: `Group Label ${type}` })).toHaveLength(1);
  });
});

describe('STANDALONE readonly widgets are unchanged (objectui#3990)', () => {
  // `FieldEditWidget` (the grid's inline cell editor) and bare SDUI nodes hand
  // down no id and no host label, so there is nothing to associate and nothing
  // may be emitted: an unnamed `role="group"` announces a container with no name
  // to give, and an id nobody asked for can collide with the page's own.

  it.each(TYPES)('%s: no role, no IDREF, no id', (type) => {
    const Widget = WIDGETS[type];
    render(
      <Widget
        value={VALUES[type]}
        onChange={() => {}}
        readonly
        field={{
          name: type,
          label: `Group Label ${type}`,
          type,
          ...((OPTION_TYPES as readonly string[]).includes(type) ? { options: OPTIONS } : null),
        }}
      />,
    );

    expect(screen.queryAllByRole('group')).toHaveLength(0);
    expect(document.querySelector('[aria-labelledby]')).toBeNull();
    expect(document.querySelector('[id]')).toBeNull();
  });

  it.each(TYPES)('%s: no value, still nothing emitted', (type) => {
    const Widget = WIDGETS[type];
    render(
      <Widget
        value={undefined}
        onChange={() => {}}
        readonly
        field={{
          name: type,
          label: `Group Label ${type}`,
          type,
          ...((OPTION_TYPES as readonly string[]).includes(type) ? { options: OPTIONS } : null),
        }}
      />,
    );

    expect(screen.queryAllByRole('group')).toHaveLength(0);
    expect(document.querySelector('[aria-labelledby]')).toBeNull();
    // The placeholder keeps its own name and gains no role it was not given.
    const placeholder = document.querySelector('[data-slot="empty-value"]');
    if (placeholder) expect(placeholder).not.toHaveAttribute('role');
  });

  it('the shared options-empty box emits nothing for a widget that is not group-labelled', () => {
    // The positive control for `OptionsEmptyState`'s new prop. The single
    // `SelectField` is NOT in `FIELD_TYPES_GROUP_LABELLED` — its label keeps a
    // plain, working `for` — so the shared box must stay attribute-for-attribute
    // what it was: no `role`, no IDREF, no host id.
    render(
      <SelectField
        value={undefined}
        onChange={() => {}}
        field={{ name: 'stage', label: 'Stage', type: 'select', options: [] } as any}
      />,
    );

    const box = screen.getByTestId('select-empty-stage');
    expect(box).not.toHaveAttribute('role');
    expect(box).not.toHaveAttribute('aria-labelledby');
    expect(box).not.toHaveAttribute('id');
  });
});
