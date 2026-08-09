/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * The group-labelling DECLARATION, at the registration boundary (objectui#3961).
 *
 * A widget whose labelled surface is not a labelable HTML element cannot be
 * reached by a host's `<label for>` — the association has to go by IDREF
 * (`aria-labelledby`). Which widgets those are is a fact only the widget package
 * knows, so it is DECLARED (`ComponentMeta.labelling`) rather than guessed by the
 * form renderer from whatever DOM a widget happens to render.
 *
 * This file pins the declaration itself, separately from the rendered outcome
 * (`composite-group-label-e2e.test.tsx`), because the two can fail apart:
 *
 *   • declared but not rendered → the widget's container never answers with a
 *     role, so the name lands on a bare `div` (the e2e file catches that);
 *   • rendered but not declared → the host keeps emitting `for`, the widget never
 *     receives an `aria-labelledby`, and the group semantics are dead code. THIS
 *     file is what fails then — an omission from the set is otherwise invisible,
 *     since a missing declaration degrades silently to the single-control path.
 *
 * Nothing renders here, so `registerField`'s `React.lazy` wrapper is never
 * resolved: this reads metadata only.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { ComponentRegistry } from '@object-ui/core';
import { registerAllFields } from '../index';

/**
 * Every field type whose host label must be associated by IDREF. Two shapes, one
 * declaration — see `FIELD_TYPES_GROUP_LABELLED` in `../index`:
 * real composites, plus `file`, whose single control is a `div[role="button"]`.
 */
const GROUP_LABELLED = ['address', 'geolocation', 'checkboxes', 'radio', 'rating', 'file'] as const;

/**
 * Single-control widgets: the host's `<label for>` reaches a real labelable
 * element, so they must NOT be declared — that is the default path, and a stray
 * `labelling: 'group'` here would take a working `for` association away from a
 * control that needs it and hand it an `aria-labelledby` its markup ignores.
 */
const CONTROL_LABELLED = [
  'text',
  'textarea',
  'number',
  'boolean',
  'date',
  'datetime',
  'email',
  'phone',
  'url',
  'currency',
  'percent',
  'password',
  'tags',
  'color',
  'code',
  'user',
  'lookup',
  'select',
] as const;

beforeAll(() => {
  registerAllFields();
});

describe('field widgets declare how their label must be associated (objectui#3961)', () => {
  it.each(GROUP_LABELLED)('%s declares labelling: "group"', (type) => {
    expect(ComponentRegistry.getMeta(type, 'field')?.labelling).toBe('group');
  });

  it.each(CONTROL_LABELLED)('%s leaves labelling undeclared (⇒ "control")', (type) => {
    // Absent, not `'control'`: one spelling of the default, and the form
    // renderer reads any non-`'group'` value as the single-control path.
    expect(ComponentRegistry.getMeta(type, 'field')?.labelling).toBeUndefined();
  });

  it('declares group labelling for exactly the audited set — no more', () => {
    // A widget added to `fieldWidgetMap` later inherits the single-control path,
    // which is the safe default; if it is in fact a composite, the e2e pins
    // (objectui#3952's "every label resolves to a real control") go red rather
    // than this list quietly growing. This assertion is the other direction: it
    // fails if someone declares a widget `group` without an audited group
    // container to carry the name.
    const declared = ComponentRegistry.getKnownTypes()
      .filter((key) => key.startsWith('field:'))
      .filter((key) => ComponentRegistry.getMeta(key.slice('field:'.length), 'field')?.labelling === 'group')
      .map((key) => key.slice('field:'.length))
      .sort();

    expect(declared).toEqual([...GROUP_LABELLED].sort());
  });
});
