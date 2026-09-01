/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * objectui#7070 — the third face. `generateViewSchema`'s gantt branch floored
 * `startDateField` / `endDateField` at `'start_date'` / `'end_date'` for every
 * view, declared or not, exactly as the app-shell and ListView faces did.
 *
 * The sibling of `ObjectView.calendarBinding-7029` next door. Fixing two of the
 * three faces would leave this one fabricating the same names one route over —
 * which is the shape of the original defect, where objectui#3129 fixed the
 * timeline axis at app-shell alone and the two plugin faces kept inventing.
 *
 * REVERSE VERIFICATION — direction predicted before running, then observed:
 * restore `|| 'start_date'` / `|| 'end_date'` and the "invents NO binding" case
 * goes RED while every CONTROL stays GREEN in either world.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { ObjectView } from '../ObjectView';
import type { ObjectViewSchema } from '@object-ui/types';

/** Every schema the view hands to SchemaRenderer, in order. */
const rendered: any[] = [];

vi.mock('@object-ui/react', async (importOriginal) => {
  const React = await import('react');
  return {
    ...(await importOriginal<Record<string, unknown>>()),
    SchemaRenderer: ({ schema }: any) => {
      rendered.push(schema);
      return <div data-testid="schema-renderer">{schema?.type}</div>;
    },
    SchemaRendererContext: React.createContext(null),
    subscribeDataChanges: () => () => {},
    notifyDataChanged: () => {},
  };
});
vi.mock('@object-ui/plugin-grid', () => ({ ObjectGrid: () => <div data-testid="object-grid" /> }));
vi.mock('@object-ui/plugin-form', () => ({ ObjectForm: () => <div data-testid="object-form" /> }));

async function renderGanttView(view: Record<string, unknown>) {
  rendered.length = 0;
  const ds: any = {
    find: vi.fn().mockResolvedValue({ data: [], total: 0 }),
    findOne: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    getObjectSchema: vi.fn().mockResolvedValue({ name: 'crm_leave_request', fields: {} }),
  };
  render(
    <ObjectView
      schema={{ type: 'object-view', objectName: 'crm_leave_request' } as ObjectViewSchema}
      views={[{ id: 'g', label: 'Gantt', type: 'gantt' as any, ...view }]}
      dataSource={ds}
    />,
  );
  await waitFor(() => expect(rendered.length).toBeGreaterThan(0));
  return rendered[rendered.length - 1];
}

describe('ObjectView.generateViewSchema — gantt restates only a DECLARED binding (objectui#7070)', () => {
  it('invents NO date binding for a gantt view that declares no config', async () => {
    const schema = await renderGanttView({});
    expect(schema.type).toBe('object-gantt');
    // Both used to be fabricated here. Absent bindings are the only route to
    // `ObjectGantt`'s refusal screen — measured to exist before this deletion,
    // and pinned in `plugin-gantt/src/ObjectGantt.unconfiguredRefusal-7070`.
    expect(schema.startDateField).toBeUndefined();
    expect(schema.endDateField).toBeUndefined();
  });

  it('invents no date binding for an EMPTY gantt block', async () => {
    // ⚠️ `gantt` sits at the VIEW's top level here, not under `options`:
    // `viewOptions` is `currentNamedViewConfig?.options || activeView`, and a
    // raw `views` entry takes the `activeView` leg. Written as `{ options:
    // { gantt } }` first, this case and the two CONTROLs below all read
    // `undefined` — the CONTROLs went red and exposed it, which is exactly the
    // job a declared-config control exists to do. Written the wrong way, THIS
    // case would have passed while measuring nothing at all.
    const schema = await renderGanttView({ gantt: {} });
    expect(schema.startDateField).toBeUndefined();
    expect(schema.endDateField).toBeUndefined();
  });

  it('keeps the out-of-scope `progress` / `dependencies` floors (objectui#7070 scope)', async () => {
    // ⛔ Not date axes, different absent-value semantics, deliberately left. The
    // point of pinning them is that the SCOPE is visible: if a later card
    // retires them, this case is where it declares that it did.
    const schema = await renderGanttView({});
    expect(schema.progressField).toBe('progress');
    expect(schema.dependenciesField).toBe('dependencies');
  });

  it('CONTROL: forwards a declared gantt block unchanged', async () => {
    const schema = await renderGanttView({
      gantt: { startDateField: 'planned_start', endDateField: 'planned_end', titleField: 'subject' },
    });
    expect(schema.type).toBe('object-gantt');
    expect(schema.startDateField).toBe('planned_start');
    expect(schema.endDateField).toBe('planned_end');
    expect(schema.titleField).toBe('subject');
  });

  it('CONTROL: a partially declared axis keeps its declared half and only that', async () => {
    const schema = await renderGanttView({ gantt: { startDateField: 'planned_start' } });
    expect(schema.startDateField).toBe('planned_start');
    expect(schema.endDateField).toBeUndefined();
  });
});
