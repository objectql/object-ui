/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * `ObjectGantt` reads its `find()` answers as `QueryResult` DECLARES them — and
 * does NOT read `records` (objectui#6839).
 *
 * ⭐ This module is the one with TWO sinks, reached by two different routes,
 * and they behave differently — which is why they are pinned separately here
 * rather than folded into one "the gantt rendered" case:
 *
 *   1. THE ROWS — `find(task)` -> `applyNonGridRowCeiling` (`@object-ui/react`)
 *      -> `extractRecords`. Indirect: this component never names the helper on
 *      this path, so a card enumerating the helper's direct callers would not
 *      list it. A refused envelope draws an empty chart.
 *   2. THE QUICK-FILTER DOMAIN — `find(projects)` -> `extractRecords`, called
 *      directly. A refused envelope here does NOT empty the chart: the bars
 *      still draw, and the only casualty is the dropdown's option list, which
 *      silently narrows to the values present in the loaded rows. That failure
 *      is invisible to any rows-only assertion, and it is the reason this file
 *      asserts the domain separately.
 *
 * MEASURED for this module: no `find()` in `plugin-gantt`, nor in any app or
 * example mounting a gantt, emits a `records` envelope — the package's four
 * `records:` occurrences are three doc comments and a record-VISIBILITY batch
 * route stub (`fetch`, not `find`). CONTROL, so the zero is a reading: the same
 * sweep finds a live `find()` double emitting `{ records: [...] }` at
 * `plugin-list`'s ObjectGallery, a consumer with its own unwrap ladder.
 *
 * ⚠️ Every refusal case is ALSO satisfied by an `extractRecords` that returns
 * `[]` for everything — an implementation strictly worse than the bug. The
 * `data` and bare-array cases refuse it: they push the SAME rows through the
 * SAME mounts, on BOTH sinks.
 *
 * MODULE RESOLUTION: this file imports the component by relative source path
 * and `@object-ui/core` is aliased by the root `vitest.config.mts` to
 * `packages/core/src`, so both legs resolve to SOURCE — no package `exports`
 * hop, no `dist`, and therefore no rebuild leg to get wrong.
 */

import React from 'react';
import { render, fireEvent, waitFor, within, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';

/**
 * `GanttView` is mocked to a thin shell surfacing the task count, exactly as
 * `ObjectGantt.quickfilter.test.tsx` and `ObjectGantt.referenceArms-6837
 * .test.tsx` do — how the chart paints bars is not what this file observes.
 */
vi.mock('./GanttView', () => ({
  GanttView: ({ tasks }: any) => <div data-testid="gantt-view" data-count={tasks.length} />,
}));

import { ObjectGantt } from './ObjectGantt';

afterEach(cleanup);

/** Both loaded rows point at `p1`, so `p2`/`p3` can only come from the domain. */
const TASKS = [
  { id: '1', name: 'Alpha', start: '2024-01-01', end: '2024-01-05', project: 'p1' },
  { id: '2', name: 'Beta', start: '2024-02-01', end: '2024-02-10', project: 'p1' },
];

/** The referenced object's full domain — reachable ONLY through sink 2. */
const PROJECTS = [
  { id: 'p1', name: 'Apollo' },
  { id: 'p2', name: 'Borealis' },
  { id: 'p3', name: 'Cygnus' },
];

/** How one case wraps its rows on the way back out of `find()`. */
type Envelope = (rows: unknown[]) => unknown;

const asData: Envelope = (rows) => ({ data: rows, total: rows.length });
const asBareArray: Envelope = (rows) => rows;
const asRecords: Envelope = (rows) => ({ records: rows, total: rows.length });

const GANTT_SCHEMA = {
  type: 'gantt',
  objectName: 'task',
  startDateField: 'start',
  endDateField: 'end',
  titleField: 'name',
  quickFilters: [{ field: 'project', label: 'Project' }],
} as any;

/**
 * Mount over a `find()` that wraps BOTH answers in `envelope`, and wait for the
 * schema-dependent commit.
 *
 * The settle signal is envelope-INDEPENDENT: once `objectSchema` lands, the
 * record query is re-issued carrying `$expand`, and `buildExpandFields` decides
 * that from the field's `type` alone. So the recorded `find('task', {$expand})`
 * proves the component consumed the schema for a REFUSED envelope exactly as it
 * does for a live one — and the option-fetch effect shares that commit, so a
 * resolving arm has already recorded `find('projects', …)` by then.
 *
 * ⛔ Call ONCE per case, never inside a `waitFor` predicate (objectui#7802).
 */
async function mount(envelope: Envelope) {
  const ds: any = {
    find: vi.fn(async (object: string) =>
      object === 'projects' ? envelope(PROJECTS) : envelope(TASKS),
    ),
    findOne: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    getObjectSchema: vi.fn().mockResolvedValue({
      name: 'task',
      fields: {
        name: { type: 'text' },
        start: { type: 'date' },
        end: { type: 'date' },
        project: { type: 'lookup', reference: 'projects' },
      },
    }),
  };
  const view = render(<ObjectGantt schema={GANTT_SCHEMA} dataSource={ds} />);
  await waitFor(() =>
    expect(
      ds.find.mock.calls.some((c: any[]) => c[0] === 'task' && c[1]?.$expand?.includes('project')),
    ).toBe(true),
  );
  return { ds, view };
}

/** Bars the chart drew — sink 1. */
const bars = (view: any) => Number(view.getByTestId('gantt-view').getAttribute('data-count'));

/**
 * Is `p3` — a project NO loaded row points at — offered in the dropdown?
 *
 * This is the only observation that separates sink 2 from sink 1: the fallback
 * arm ("distinct values present in the loaded data") would still offer `p1`
 * whether or not the domain fetch was read.
 */
async function offersUnloadedProject(view: any): Promise<boolean> {
  fireEvent.click(view.getByTestId('quick-filter-trigger-project'));
  const panel = await view.findByTestId('quick-filter-panel-project');
  return within(panel).queryByTestId('quick-filter-option-project-p3') !== null;
}

describe('ObjectGantt — the find() envelopes it reads (objectui#6839)', () => {
  describe('sink 1 — the rows, via applyNonGridRowCeiling', () => {
    it("still reads the contract's `data` member", async () => {
      const { view } = await mount(asData);
      await waitFor(() => expect(bars(view), 'the declared rows member must still draw').toBe(2));
    });

    it('still reads a bare array — the live non-envelope shape fakes answer with', async () => {
      const { view } = await mount(asBareArray);
      await waitFor(() => expect(bars(view), 'the bare-array arm must still draw').toBe(2));
    });

    it('does NOT read `records` — not a QueryResult member', async () => {
      // Before the fix these two tasks drew off a key `QueryResult` does not
      // declare, and did so AHEAD of `data`.
      const { view } = await mount(asRecords);
      expect(
        bars(view),
        'a `records` envelope must reach the chart as zero bars, not as the tasks it names',
      ).toBe(0);
    });
  });

  describe('sink 2 — the quick-filter option domain, read directly', () => {
    it("still reads the contract's `data` member", async () => {
      const { view } = await mount(asData);
      expect(
        await offersUnloadedProject(view),
        'the full referenced domain must still widen the dropdown past the loaded rows',
      ).toBe(true);
    });

    it('still reads a bare array', async () => {
      const { view } = await mount(asBareArray);
      expect(await offersUnloadedProject(view)).toBe(true);
    });

    it('does NOT read `records` — and the chart is NOT how you would notice', async () => {
      // The sharp half of this file. The bars are unaffected by sink 2, so a
      // rows-only pin would have called this module green while the dropdown
      // silently narrowed to the values already on screen.
      const { view } = await mount(asRecords);
      expect(
        await offersUnloadedProject(view),
        'a `records` envelope must not resolve the referenced domain',
      ).toBe(false);
    });
  });
});
