/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * objectui#3562 — the row "⋮" trigger must be decided by the items that will
 * ACTUALLY render for that row, not by the handlers wired or the actions
 * declared.
 *
 * This is the reporter's own screen. The console object list (all three list
 * callers converge on `ObjectGrid`, which injects its own `_actions` column and
 * renders THIS component in the cell — it never passes `onRowEdit`/`onRowDelete`
 * to data-table) showed a "⋮" on every `sys_approval_request` row that opened a
 * 128×10 box with zero `[role=menu]` children. The guard read
 * `(canEdit && onEdit) || (canDelete && onDelete) || menuDefs.length > 0 || rowActions.length > 0`
 * — handlers and DECLARATIONS — while the items were filtered a second time, per
 * item and per record, by `visibleWhen` / `visible`. The object's `list_item`
 * actions (approve / reject / recall) are gated for approvers, so an admin in the
 * "全部" view failed every one of them row by row: guard true, zero items.
 *
 * That this component renders no separators at all is why the reporter measured
 * exactly 0 children rather than a stray rule — see PR #3756's「登陆点更正」.
 *
 * The data-table half of the same defect is PR #3756; this suite mirrors it
 * (same dispositions, same pure-function cases) with the two additions this
 * surface needs: the inline PRIMARY button path, and the legacy string
 * `rowActions` that carry no predicate.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';
import { PredicateScopeProvider, ActionProvider, SchemaRendererProvider } from '@object-ui/react';
import { registerAllFields } from '@object-ui/fields';
import { RowActionMenu, planRowActionMenu } from '../RowActionMenu';
import { ObjectGrid } from '../../ObjectGrid';

registerAllFields();

/** The real `userActions.edit.visibleWhen` shape (objectui#2614). */
const NOT_FROZEN = 'record.frozen != true';
/** The reporter's shape: an action gated for a role the viewer is not in. */
const IS_APPROVER = 'record.approver == "u-me"';

const FROZEN = { id: 'r1', name: 'Frozen A', frozen: true, approver: 'someone-else' };
const DRAFT = { id: 'r2', name: 'Draft B', frozen: false, approver: 'someone-else' };

const trigger = () => screen.queryByTestId('row-action-trigger');

function renderMenu(props: Record<string, unknown>) {
  return render(
    <PredicateScopeProvider scope={{}}>
      <RowActionMenu row={FROZEN} onActionDef={() => {}} {...props} />
    </PredicateScopeProvider>,
  );
}

afterEach(() => { cleanup(); });

describe('RowActionMenu — the "⋮" counts renderable items, not handlers (#3562)', () => {
  it('renders NO trigger when every built-in item is predicate-suppressed', () => {
    const { container } = renderMenu({
      canEdit: true,
      canDelete: true,
      onEdit: () => {},
      onDelete: () => {},
      editPredicates: { visibleWhen: NOT_FROZEN },
      deletePredicates: { visibleWhen: NOT_FROZEN },
    });

    // Handlers ARE wired and `canEdit`/`canDelete` ARE true — the old guard
    // rendered a trigger here, which is the reported empty box.
    expect(trigger()).not.toBeInTheDocument();
    // With no trigger there is nothing to open, so the empty menu cannot exist.
    expect(screen.queryByRole('menu')).toBeNull();
    // The cell wrapper survives (see the ObjectGrid alignment test below), but
    // it holds nothing.
    expect(container.querySelector('button')).toBeNull();
  });

  it('keeps the trigger when only SOME items are suppressed', () => {
    renderMenu({
      canEdit: true,
      canDelete: true,
      onEdit: () => {},
      onDelete: () => {},
      // Edit is gated away on a frozen row; Delete is ungated and survives.
      editPredicates: { visibleWhen: NOT_FROZEN },
    });
    expect(trigger()).toBeInTheDocument();
  });

  it('renders one trigger for the plain Edit + Delete case (the reporter’s control group)', () => {
    // Their own business object: no predicates, two items, menu works. This is
    // the case that must not move.
    renderMenu({ canEdit: true, canDelete: true, onEdit: () => {}, onDelete: () => {} });
    expect(trigger()).toBeInTheDocument();
  });

  it('renders no trigger when nothing is wired at all (unchanged)', () => {
    renderMenu({});
    expect(trigger()).not.toBeInTheDocument();
  });

  it('suppresses the trigger when every CUSTOM action is invisible for the row', () => {
    // sys_approval_request as the reporter sees it: the declared list_item
    // actions all gate on being the approver, and this admin is not.
    renderMenu({
      rowActionDefs: [
        { name: 'approve', label: 'Approve', variant: 'secondary', visible: IS_APPROVER },
        { name: 'reject', label: 'Reject', variant: 'secondary', visible: IS_APPROVER },
        { name: 'recall', label: 'Recall', variant: 'secondary', visible: IS_APPROVER },
      ],
    });
    expect(trigger()).not.toBeInTheDocument();
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('keeps the trigger for the custom action that DOES survive', () => {
    renderMenu({
      rowActionDefs: [
        { name: 'approve', label: 'Approve', variant: 'secondary', visible: IS_APPROVER },
        { name: 'view', label: 'View', variant: 'secondary' },
      ],
    });
    expect(trigger()).toBeInTheDocument();
  });

  it('legacy string rowActions carry no predicate, so they always keep the trigger', () => {
    // Preserved deliberately: a bare identifier has nothing to evaluate, so it
    // cannot be suppressed and the menu is never empty.
    renderMenu({ rowActions: ['send_email'], onAction: () => {} });
    expect(trigger()).toBeInTheDocument();
  });
});

/**
 * The inline PRIMARY button path. It already returned `null` on a failing
 * predicate; what changes is that it reads the SAME visibility function as the
 * menu items and the guard, so the three cannot drift. These pin the outcome the
 * ruling names: a primary whose predicate fails for the row renders nothing —
 * and does not conjure a "⋮" either.
 */
describe('RowActionMenu — the inline primary button shares one visibility source (#3562)', () => {
  const OPEN_IF_APPROVER = {
    name: 'approve',
    label: 'Approve',
    variant: 'primary' as const,
    visible: IS_APPROVER,
  };

  it('a primary whose predicate fails renders neither a button nor a trigger', () => {
    renderMenu({ rowActionDefs: [OPEN_IF_APPROVER] });
    expect(screen.queryByTestId('row-action-inline-approve')).not.toBeInTheDocument();
    // …and nothing folded into a menu behind it.
    expect(trigger()).not.toBeInTheDocument();
  });

  it('the same def renders inline on a row whose predicate passes', () => {
    render(
      <PredicateScopeProvider scope={{}}>
        <RowActionMenu
          row={{ ...DRAFT, approver: 'u-me' }}
          rowActionDefs={[OPEN_IF_APPROVER]}
          onActionDef={() => {}}
        />
      </PredicateScopeProvider>,
    );
    expect(screen.getByTestId('row-action-inline-approve')).toBeInTheDocument();
    // A single surviving primary needs no overflow — unchanged behavior.
    expect(trigger()).not.toBeInTheDocument();
  });

  it('a suppressed primary does NOT promote the next primary into its inline slot', () => {
    // Slot allocation still runs on the DECLARED primaries: #3562 is about
    // whether the trigger renders, not about relocating items. `upgrade` stays
    // folded into the menu (and so the menu, holding one item, keeps its "⋮").
    renderMenu({
      rowActionDefs: [
        OPEN_IF_APPROVER,
        { name: 'upgrade', label: 'Upgrade', variant: 'primary' },
      ],
    });
    expect(screen.queryByTestId('row-action-inline-approve')).not.toBeInTheDocument();
    expect(screen.queryByTestId('row-action-inline-upgrade')).not.toBeInTheDocument();
    expect(trigger()).toBeInTheDocument();
  });
});

/**
 * Column alignment through the REAL grid — the surface the reporter looked at.
 * `ObjectGrid` injects the `_actions` column (header + one cell per row) at
 * table level; this change only decides what goes INSIDE the cell, so a row with
 * nothing to offer renders an empty cell and every row keeps the same `<td>`
 * count. Same convention as PR #3756's data-table half.
 */
describe('ObjectGrid actions column stays aligned when a row loses its menu (#3562)', () => {
  function renderGrid(rows: Record<string, unknown>[], userActions: Record<string, unknown>) {
    const dataSource: any = {
      getObjectSchema: async (name: string) => ({
        name,
        userActions,
        fields: {
          id: { type: 'text' },
          name: { type: 'text', label: 'Name' },
          frozen: { type: 'boolean', label: 'Frozen' },
        },
      }),
    };
    return render(
      <ActionProvider>
        <SchemaRendererProvider dataSource={dataSource}>
          <ObjectGrid
            schema={{
              type: 'object-grid',
              objectName: 'test_object',
              columns: [{ field: 'name', label: 'Name' }],
              data: { provider: 'value', items: rows },
            } as any}
            dataSource={dataSource}
            onEdit={vi.fn()}
            onDelete={vi.fn()}
          />
        </SchemaRendererProvider>
      </ActionProvider>,
    );
  }

  /** The last `<td>` of every body row — the `_actions` cell. */
  function actionCells(container: HTMLElement): HTMLTableCellElement[] {
    return Array.from(container.querySelectorAll('tbody tr')).map((tr) => {
      const cells = Array.from(tr.querySelectorAll('td')) as HTMLTableCellElement[];
      return cells[cells.length - 1];
    });
  }

  it('every row suppressed → no triggers, header intact, empty cells (the reported shape)', async () => {
    const { container } = renderGrid([FROZEN, { ...DRAFT, frozen: true }], {
      edit: { enabled: true, visibleWhen: NOT_FROZEN },
      delete: { enabled: true, visibleWhen: NOT_FROZEN },
    });
    await waitFor(() => expect(screen.getByText('Frozen A')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('Draft B')).toBeInTheDocument());

    // `waitFor`, not a bare assertion: `userActions` arrives from the async
    // `getObjectSchema`, so the settled verdict is the one to read — before the
    // fetch lands the grid has no predicates and BOTH rows carry a trigger.
    // Verified: asserted synchronously, this reads 2 triggers on the fixed
    // build. So the transition 2 → 0 is real, not an assertion that passes
    // because nothing ever rendered.
    await waitFor(() => expect(screen.queryAllByTestId('row-action-trigger')).toHaveLength(0));
    expect(screen.queryByRole('menu')).toBeNull();
    // The column itself is table-level and unaffected: header plus one empty
    // cell per row, exactly as on a grid that wires no row handlers at all.
    expect(screen.getByText('Actions')).toBeInTheDocument();
    const cells = actionCells(container);
    expect(cells).toHaveLength(2);
    for (const cell of cells) expect(cell.querySelector('button')).toBeNull();
  });

  it('mixed rows keep identical td counts (one row with a trigger, one without)', async () => {
    const { container } = renderGrid([FROZEN, DRAFT], {
      edit: { enabled: true, visibleWhen: NOT_FROZEN },
      delete: false,
    });
    await waitFor(() => expect(screen.getByText('Frozen A')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('Draft B')).toBeInTheDocument());

    // Only the non-frozen row keeps an item, so only it keeps a trigger.
    await waitFor(() => expect(screen.queryAllByTestId('row-action-trigger')).toHaveLength(1));
    const widths = Array.from(container.querySelectorAll('tbody tr')).map(
      (tr) => tr.querySelectorAll('td').length,
    );
    // No row is short a cell — the trigger's absence never collapses the column.
    expect(new Set(widths).size).toBe(1);
    const cells = actionCells(container);
    expect(cells[0].querySelector('button')).toBeNull();
    expect(cells[1].querySelector('button')).not.toBeNull();
  });
});

/**
 * The resolution the guard counts with, exercised directly: the DOM tests above
 * pin whether a trigger exists, these pin WHICH items it would hold. Both read
 * the same `planRowActionMenu`, and the item components re-read the same
 * visibility functions — so the trigger and its contents cannot drift apart.
 */
describe('planRowActionMenu', () => {
  const scope = {};
  const noop = () => {};
  const base = { scope, inlineDefs: [], menuDefs: [] } as const;

  it('counts nothing when nothing is wired', () => {
    expect(planRowActionMenu({ ...base, row: DRAFT })).toMatchObject({
      edit: false,
      remove: false,
      menuCount: 0,
    });
  });

  it('counts both built-ins when they are ungated', () => {
    expect(planRowActionMenu({
      ...base,
      row: FROZEN,
      canEdit: true,
      canDelete: true,
      onEdit: noop,
      onDelete: noop,
    })).toMatchObject({ edit: true, remove: true, menuCount: 2 });
  });

  it('drops only the suppressed built-in', () => {
    expect(planRowActionMenu({
      ...base,
      row: FROZEN,
      canEdit: true,
      canDelete: true,
      onEdit: noop,
      onDelete: noop,
      editPredicates: { visibleWhen: NOT_FROZEN },
    })).toMatchObject({ edit: false, remove: true, menuCount: 1 });
  });

  it('reaches zero on a suppressed row while the SAME grid keeps both on a row that passes', () => {
    const args = {
      ...base,
      canEdit: true,
      canDelete: true,
      onEdit: noop,
      onDelete: noop,
      editPredicates: { visibleWhen: NOT_FROZEN },
      deletePredicates: { visibleWhen: NOT_FROZEN },
    };
    expect(planRowActionMenu({ ...args, row: FROZEN }).menuCount).toBe(0);
    expect(planRowActionMenu({ ...args, row: DRAFT }).menuCount).toBe(2);
  });

  it('a wired handler without the object verdict counts for nothing', () => {
    // `canEdit` folds the ADR-0103 bucket, `userActions` and the server's
    // effective operation set; a handler alone was never enough.
    expect(planRowActionMenu({ ...base, row: DRAFT, onEdit: noop, onDelete: noop }))
      .toMatchObject({ edit: false, remove: false, menuCount: 0 });
  });

  it('keeps the menu defs whose `visible` passes, in declared order', () => {
    const plan = planRowActionMenu({
      ...base,
      menuDefs: [
        { name: 'unfreeze', visible: 'record.frozen == true' },
        { name: 'publish', visible: NOT_FROZEN },
        { name: 'view' },
      ],
      row: FROZEN,
    });
    expect(plan.custom.map((a) => a.name)).toEqual(['unfreeze', 'view']);
    expect(plan.menuCount).toBe(2);
  });

  it('filters the inline primaries too, without counting them toward the trigger', () => {
    const plan = planRowActionMenu({
      ...base,
      inlineDefs: [{ name: 'approve', variant: 'primary', visible: IS_APPROVER }],
      row: FROZEN,
    });
    expect(plan.inline).toEqual([]);
    // An inline button is not a menu item: it never keeps the "⋮" alive, and a
    // surviving one does not either.
    expect(plan.menuCount).toBe(0);
    const passing = planRowActionMenu({
      ...base,
      inlineDefs: [{ name: 'approve', variant: 'primary', visible: IS_APPROVER }],
      row: { ...DRAFT, approver: 'u-me' },
    });
    expect(passing.inline.map((a) => a.name)).toEqual(['approve']);
    expect(passing.menuCount).toBe(0);
  });

  it('legacy string actions count — they have no predicate to fail', () => {
    expect(planRowActionMenu({ ...base, row: FROZEN, rowActions: ['send_email'] }))
      .toMatchObject({ legacy: ['send_email'], menuCount: 1 });
  });

  it('still counts an item that renders merely DISABLED', () => {
    expect(planRowActionMenu({
      ...base,
      row: FROZEN,
      canEdit: true,
      onEdit: noop,
      editPredicates: { disabledWhen: 'record.frozen == true' },
    })).toMatchObject({ edit: true, menuCount: 1 });
  });

  it('fails CLOSED on a faulting predicate (no phantom item, no phantom trigger)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      expect(planRowActionMenu({
        ...base,
        row: FROZEN,
        canEdit: true,
        onEdit: noop,
        editPredicates: { visibleWhen: 'record.frozen ==' },
        menuDefs: [{ name: 'broken', visible: 'record.frozen ==' }],
      })).toMatchObject({ edit: false, custom: [], menuCount: 0 });
    } finally {
      warn.mockRestore();
    }
  });

  it('preserves the `visible: false` truthy gate verbatim (objectui#3758, not this issue)', () => {
    // `!def.visible` reads `false` as "ungated", so the def renders and counts —
    // exactly what the item components have always done. Re-deciding this would
    // change WHICH items render, which is out of #3562's scope; the point of the
    // shared function is only that the guard and the items agree.
    const plan = planRowActionMenu({
      ...base,
      row: FROZEN,
      menuDefs: [{ name: 'ghost', visible: false }],
    });
    expect(plan.custom.map((a) => a.name)).toEqual(['ghost']);
    expect(plan.menuCount).toBe(1);
  });
});
