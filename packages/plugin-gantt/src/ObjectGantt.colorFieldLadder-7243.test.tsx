/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * objectui#7243 — `gantt.colorField` used to be passed RAW into the bar's
 * `backgroundColor`.
 *
 * Pointing the documented key at a select field therefore produced
 * `backgroundColor: "open"` — not a colour, so the browser dropped the
 * declaration and every bar rendered identically. OMITTING the key was
 * strictly better: the absent-key branch derived a real colour per status.
 *
 * The ladder this file pins (the triage ruling on #7243, shared with
 * `plugin-timeline` and `plugin-calendar` through
 * `@object-ui/core#createFieldColorResolver`):
 *
 *   1. the field's own option `color` for the record's value;
 *   2. else the value when it already IS a colour literal (#hex / rgb / hsl);
 *   3. else the existing semantic-token derivation — never a raw value.
 *
 * The assertions read the `tasks` prop `ObjectGantt` hands `GanttView` rather
 * than the painted bar: that prop IS the colour contract between the two
 * (`GanttView` writes `backgroundColor: task.color || '#3b82f6'` at four
 * sites), and reading it keeps the fixture from depending on which of those
 * four sites a given row happens to take.
 *
 * REVERSE VERIFICATION — direction predicted before running: on the
 * unmodified tree the first case reports `color: 'open'` instead of the
 * authored `#7c3aed`, and the palette-token case reports `'red'` instead of
 * that palette's hex. Both are the pre-fix values, not a crash.
 */

import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ObjectGantt } from './ObjectGantt';

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));

vi.mock('@object-ui/plugin-detail', () => ({
  RecordDetailDrawer: () => null,
  deriveRecordPageHref: () => null,
}));

let lastTasks: any[] = [];

vi.mock('./GanttView', () => ({
  GanttView: ({ tasks }: any) => {
    lastTasks = tasks;
    return <div data-testid="gantt-view" data-task-count={String(tasks.length)} />;
  },
}));

/** The authored option colours — the single fact all three renderers must agree on. */
const STATUS_OPTIONS = [
  { value: 'open', label: 'Open', color: '#7c3aed' },
  { value: 'done', label: 'Done', color: '#059669' },
];

const OBJECT_SCHEMA = {
  name: 'duly_task',
  fields: {
    id: { name: 'id', type: 'text' },
    subject: { name: 'subject', type: 'text' },
    visible_from: { name: 'visible_from', type: 'date' },
    due_date: { name: 'due_date', type: 'date' },
    status: { name: 'status', type: 'select', options: STATUS_OPTIONS },
    // No `options` — a plain text field an author may use to store a literal
    // colour, which is the only shape rung 2 exists for.
    accent: { name: 'accent', type: 'text' },
  },
};

const ROWS = [
  {
    id: '1',
    subject: 'Ship it',
    status: 'open',
    accent: '#123456',
    visible_from: '2026-01-01',
    due_date: '2026-01-10',
  },
];

function makeDataSource(rows: any[] = ROWS) {
  return {
    find: vi.fn(async () => ({ data: rows, total: rows.length })),
    findOne: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    getObjectSchema: vi.fn(async () => OBJECT_SCHEMA),
  } as any;
}

async function colorsFor(colorField: string, rows: any[] = ROWS) {
  lastTasks = [];
  const schema: any = {
    type: 'object-gantt',
    objectName: 'duly_task',
    gantt: {
      titleField: 'subject',
      startDateField: 'visible_from',
      endDateField: 'due_date',
      colorField,
    },
  };
  render(<ObjectGantt schema={schema} dataSource={makeDataSource(rows)} />);
  await waitFor(() => expect(lastTasks.length).toBe(rows.length));
  return lastTasks.map((t) => t.color);
}

describe('objectui#7243 — gantt colorField ladder', () => {
  it('rung 1: a select field paints the AUTHORED option colour', async () => {
    expect(await colorsFor('status')).toEqual(['#7c3aed']);
  });

  it('rung 2: a literal hex in a plain field still passes through untouched', async () => {
    expect(await colorsFor('accent')).toEqual(['#123456']);
  });

  it('rung 3: a value with no option colour derives a colour, never the raw value', async () => {
    const rows = [{ ...ROWS[0], status: 'in_progress' }];
    const schemaless = {
      ...OBJECT_SCHEMA,
      fields: { ...OBJECT_SCHEMA.fields, status: { name: 'status', type: 'text' } },
    };
    lastTasks = [];
    const ds = {
      find: vi.fn(async () => ({ data: rows, total: rows.length })),
      findOne: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      getObjectSchema: vi.fn(async () => schemaless),
    } as any;
    render(
      <ObjectGantt
        schema={{
          type: 'object-gantt',
          objectName: 'duly_task',
          gantt: {
            titleField: 'subject',
            startDateField: 'visible_from',
            endDateField: 'due_date',
            colorField: 'status',
          },
        } as any}
        dataSource={ds}
      />,
    );
    await waitFor(() => expect(lastTasks.length).toBe(1));
    // `in_progress` is a SEMANTIC_COLOR_MAP key -> blue -> that palette's hex.
    expect(lastTasks[0].color).toBe('#3b82f6');
    expect(lastTasks[0].color).not.toBe('in_progress');
  });

  it('rung 3: a palette token resolves to that palette colour, not a raw CSS name', async () => {
    const rows = [{ ...ROWS[0], accent: 'red' }];
    expect(await colorsFor('accent', rows)).toEqual(['#ef4444']);
  });

  it('an empty colorField value still falls back to the record status story', async () => {
    const rows = [{ ...ROWS[0], accent: '' }];
    // `status: 'open'` -> SEMANTIC_COLOR_MAP blue.
    expect(await colorsFor('accent', rows)).toEqual(['#3b82f6']);
  });

  it('borderColorField takes rung 1 too — the alert stroke honours option colours', async () => {
    lastTasks = [];
    render(
      <ObjectGantt
        schema={{
          type: 'object-gantt',
          objectName: 'duly_task',
          gantt: {
            titleField: 'subject',
            startDateField: 'visible_from',
            endDateField: 'due_date',
            borderColorField: 'status',
          },
        } as any}
        dataSource={makeDataSource()}
      />,
    );
    await waitFor(() => expect(lastTasks.length).toBe(1));
    expect(lastTasks[0].borderColor).toBe('#7c3aed');
  });
});
