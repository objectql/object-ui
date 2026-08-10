/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * A CREATE form seeds the object schema's declared `defaultValue`s (#4047).
 *
 * `ObjectForm` has always done this; the four sectioned/overlay containers
 * (Modal / Drawer / Tabbed / Split) and the wizard did not — their create
 * branch set the form data to `initialData || initialValues || {}` and never
 * looked at the object schema. The console's create dialog IS the global
 * `<ModalForm>`, so a field declared `required: true, defaultValue: 'draft'`
 * opened with an empty select and a required marker: the user had to pick a
 * value the system already knew, and every neighbouring option (some with side
 * effects) was one click away.
 *
 * Four directions are pinned here, because "seed the defaults" is wrong in
 * three of them:
 *
 *   1. create + declared default        → preselected AND submittable
 *   2. create + no default              → still empty (no invention)
 *   3. edit                             → the STORED record wins; a default is
 *      never folded in over a persisted row (an edit form must not silently
 *      rewrite a column the user never touched)
 *   4. create + a RUNTIME default       → left empty for the server. `NOW()` /
 *      `current_user` (`DEFAULT_VALUE_TOKENS`) and CEL Expression envelopes are
 *      instructions, not values: seeding them literally would put the text
 *      `NOW()` into a datetime input and submit it as the field's value, which
 *      is strictly worse than today's empty control. The engine resolves them
 *      at insert time for exactly the omitted-field case.
 *
 * Caller-supplied `initialData` / `initialValues` outrank a schema default in
 * every case — they are the more specific instruction (a lookup prefill, a
 * "duplicate this record" seed).
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { registerAllFields } from '@object-ui/fields';
import { ObjectForm } from './ObjectForm';
import { ModalForm } from './ModalForm';
import { DrawerForm } from './DrawerForm';
import { TabbedForm } from './TabbedForm';
import { SplitForm } from './SplitForm';

registerAllFields();

const STATUS_OPTIONS = [
  { label: 'Draft', value: 'draft', default: true },
  { label: 'Pending Approval', value: 'pending' },
  { label: 'Approved', value: 'approved' },
  { label: 'Rejected', value: 'rejected' },
];

/** The reported object: a required select carrying a field-level default. */
const OBJECT_SCHEMA = {
  name: 'rating',
  fields: {
    title: { type: 'text', label: 'Title' },
    // The reported field — both spellings present, as in the issue.
    status: { type: 'select', label: 'Status', required: true, defaultValue: 'draft', options: STATUS_OPTIONS },
    // No default at all: must stay untouched.
    stage: { type: 'select', label: 'Stage', options: [{ label: 'A', value: 'a' }, { label: 'B', value: 'b' }] },
  },
};

const makeDS = (objectSchema: any = OBJECT_SCHEMA, record?: any) =>
  ({
    getObjectSchema: vi.fn().mockResolvedValue(objectSchema),
    create: vi.fn().mockResolvedValue({ id: 'r1' }),
    update: vi.fn().mockResolvedValue({ id: 'r1' }),
    findOne: vi.fn().mockResolvedValue(record ?? { id: 'r1' }),
  }) as any;

const SECTIONS = [{ name: 'basics', label: 'Basics', fields: ['title', 'status', 'stage'] }];

/** The label a select trigger currently displays (placeholder when unset). */
const triggerText = (field: string) =>
  document.body.querySelector(`[data-testid="select-trigger-${field}"]`)?.textContent ?? '';

const submit = () => {
  const form = document.body.querySelector('form') as HTMLFormElement;
  fireEvent.submit(form);
};

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

/**
 * The four sectioned containers share one create branch, so they are pinned as
 * one table. `ObjectForm` (the flat container) is covered separately below —
 * it already seeded, and the point there is that it still does.
 */
const CONTAINERS: Array<[string, React.ComponentType<any>, string]> = [
  ['ModalForm', ModalForm as any, 'modal'],
  ['DrawerForm', DrawerForm as any, 'drawer'],
  ['TabbedForm', TabbedForm as any, 'tabbed'],
  ['SplitForm', SplitForm as any, 'split'],
];

describe.each(CONTAINERS)('%s — create-mode default seeding (#4047)', (_name, Container, formType) => {
  const renderCreate = (ds: any, extra: Record<string, unknown> = {}) =>
    render(
      <Container
        schema={{
          type: 'object-form',
          formType,
          objectName: 'rating',
          mode: 'create',
          open: true,
          sections: SECTIONS,
          ...extra,
        } as any}
        dataSource={ds}
      />,
    );

  it('preselects a declared `defaultValue` and submits it without a manual choice', async () => {
    const ds = makeDS();
    renderCreate(ds);

    await waitFor(() => expect(triggerText('status')).toContain('Draft'));

    submit();
    await waitFor(() => expect(ds.create).toHaveBeenCalled());
    expect(ds.create.mock.calls[0][1]).toMatchObject({ status: 'draft' });
  });

  it('leaves a field with no declared default empty', async () => {
    const ds = makeDS();
    renderCreate(ds);

    await waitFor(() => expect(triggerText('status')).toContain('Draft'));
    expect(triggerText('stage')).not.toContain('A');
    expect(triggerText('stage')).not.toContain('B');
  });

  it('lets caller-supplied initial values outrank the schema default', async () => {
    const ds = makeDS();
    renderCreate(ds, { initialData: { status: 'pending' } });

    await waitFor(() => expect(triggerText('status')).toContain('Pending Approval'));
  });

  it('does not seed a runtime default token — the server resolves it at insert', async () => {
    const ds = makeDS({
      name: 'rating',
      fields: {
        title: { type: 'text', label: 'Title' },
        remind_at: { type: 'datetime', label: 'Remind at', defaultValue: 'NOW()' },
        assignee: { type: 'text', label: 'Assignee', defaultValue: 'current_user' },
        note: { type: 'text', label: 'Note', defaultValue: { dialect: 'cel', source: 'today()' } },
      },
    });
    render(
      <Container
        schema={{
          type: 'object-form',
          formType,
          objectName: 'rating',
          mode: 'create',
          open: true,
          sections: [{ name: 'basics', label: 'Basics', fields: ['title', 'remind_at', 'assignee', 'note'] }],
        } as any}
        dataSource={ds}
      />,
    );

    const assigneeInput = await waitFor(() => {
      const el = document.body.querySelector<HTMLInputElement>('[data-field="assignee"] input');
      if (!el) throw new Error('assignee input not rendered');
      return el;
    });
    expect(assigneeInput.value).toBe('');
    expect(
      document.body.querySelector<HTMLInputElement>('[data-field="note"] input')?.value ?? '',
    ).toBe('');
    expect(document.body.textContent).not.toContain('NOW()');
  });

  it('does not fold a schema default into an EDIT form over the stored record', async () => {
    // The stored row does not carry `status` AT ALL — the sharp case. A row
    // carrying `status: null` would hide a seeding bug behind the spread (the
    // explicit null overwrites the default either way), so it proves nothing;
    // an ABSENT key is what a leaking default actually shows up on. An edit
    // form must show the row as the server holds it — seeding `draft` here
    // would arm a silent write of a value the user never chose, the moment
    // they save some unrelated field.
    const ds = makeDS(OBJECT_SCHEMA, { id: 'r1', title: 'Acme' });
    render(
      <Container
        schema={{
          type: 'object-form',
          formType,
          objectName: 'rating',
          mode: 'edit',
          recordId: 'r1',
          open: true,
          sections: SECTIONS,
        } as any}
        dataSource={ds}
      />,
    );

    await waitFor(() => expect(ds.findOne).toHaveBeenCalled());
    await waitFor(() => {
      const el = document.body.querySelector<HTMLInputElement>('[data-field="title"] input');
      if (el?.value !== 'Acme') throw new Error('record not loaded yet');
    });
    expect(triggerText('status')).not.toContain('Draft');
  });
});

describe('ObjectForm — create-mode default seeding stays put (#4047)', () => {
  it('preselects a declared `defaultValue` on create', async () => {
    const ds = makeDS();
    render(
      <ObjectForm
        schema={{ type: 'object-form', objectName: 'rating', mode: 'create' } as any}
        dataSource={ds}
      />,
    );

    await waitFor(() => expect(triggerText('status')).toContain('Draft'));
    submit();
    await waitFor(() => expect(ds.create).toHaveBeenCalled());
    expect(ds.create.mock.calls[0][1]).toMatchObject({ status: 'draft' });
  });

  it('does not seed a runtime default token on create', async () => {
    const ds = makeDS({
      name: 'rating',
      fields: {
        title: { type: 'text', label: 'Title' },
        assignee: { type: 'text', label: 'Assignee', defaultValue: 'current_user' },
      },
    });
    render(
      <ObjectForm
        schema={{ type: 'object-form', objectName: 'rating', mode: 'create' } as any}
        dataSource={ds}
      />,
    );

    const assigneeInput = await waitFor(() => {
      const el = document.body.querySelector<HTMLInputElement>('[data-field="assignee"] input');
      if (!el) throw new Error('assignee input not rendered');
      return el;
    });
    expect(assigneeInput.value).toBe('');
  });

  it('does not fold a schema default into an EDIT form over the stored record', async () => {
    // Absent key, not `status: null` — see the sectioned suite above for why
    // the null variant cannot fail. This is the assertion that goes red if the
    // create-only gate on the seeding pass is removed.
    const ds = makeDS(OBJECT_SCHEMA, { id: 'r1', title: 'Acme' });
    render(
      <ObjectForm
        schema={{ type: 'object-form', objectName: 'rating', mode: 'edit', recordId: 'r1' } as any}
        dataSource={ds}
      />,
    );

    await waitFor(() => expect(ds.findOne).toHaveBeenCalled());
    await waitFor(() => {
      const el = document.body.querySelector<HTMLInputElement>('[data-field="title"] input');
      if (el?.value !== 'Acme') throw new Error('record not loaded yet');
    });
    expect(triggerText('status')).not.toContain('Draft');
  });
});
