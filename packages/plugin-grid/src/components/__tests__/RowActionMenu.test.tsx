/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Regression: multiple `variant:'primary'` row actions must not all render as
 * inline buttons and crowd/clip the narrow actions column. Bug context: the
 * cloud `sys_environment` list declares TWO primary row actions ("Open" +
 * "Upgrade Plan"); RowActionMenu rendered both inline with `justify-end`, so
 * the leftmost ("Open") overflowed the fixed-width cell and was clipped to a
 * sliver. Only the first `maxInlineActions` primaries now stay inline; the rest
 * fold into the "⋮" overflow menu.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';
import { PredicateScopeProvider } from '@object-ui/react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@object-ui/components';
import { Edit } from 'lucide-react';
import { RowActionMenu, BuiltinRowActionItem } from '../RowActionMenu';

const OPEN = { name: 'open', label: 'Open', variant: 'primary' as const };
const UPGRADE = { name: 'upgrade', label: 'Upgrade Plan', variant: 'primary' as const };
const ARCHIVE = { name: 'archive', label: 'Archive', variant: 'secondary' as const };

function renderMenu(props: Record<string, any>) {
  return render(
    <PredicateScopeProvider scope={{}}>
      <RowActionMenu row={{ id: 'e1' }} onActionDef={() => {}} {...props} />
    </PredicateScopeProvider>,
  );
}

describe('RowActionMenu inline overflow', () => {
  it('inlines only the first primary by default; extra primaries fold into the menu', () => {
    renderMenu({ rowActionDefs: [OPEN, UPGRADE] });
    // First primary renders as an inline button (the row's main CTA).
    expect(screen.getByTestId('row-action-inline-open')).toBeInTheDocument();
    // Second primary is NOT inline — it moved to the "⋮" overflow menu.
    expect(screen.queryByTestId('row-action-inline-upgrade')).not.toBeInTheDocument();
    // The overflow menu trigger exists to hold the folded action.
    expect(screen.getByTestId('row-action-trigger')).toBeInTheDocument();
  });

  it('honors a higher maxInlineActions so both primaries stay inline', () => {
    renderMenu({ rowActionDefs: [OPEN, UPGRADE], maxInlineActions: 2 });
    expect(screen.getByTestId('row-action-inline-open')).toBeInTheDocument();
    expect(screen.getByTestId('row-action-inline-upgrade')).toBeInTheDocument();
  });

  it('never inlines a non-primary action', () => {
    renderMenu({ rowActionDefs: [OPEN, ARCHIVE] });
    expect(screen.getByTestId('row-action-inline-open')).toBeInTheDocument();
    expect(screen.queryByTestId('row-action-inline-archive')).not.toBeInTheDocument();
  });

  it('maxInlineActions:0 folds every primary into the menu', () => {
    renderMenu({ rowActionDefs: [OPEN, UPGRADE], maxInlineActions: 0 });
    expect(screen.queryByTestId('row-action-inline-open')).not.toBeInTheDocument();
    expect(screen.queryByTestId('row-action-inline-upgrade')).not.toBeInTheDocument();
    expect(screen.getByTestId('row-action-trigger')).toBeInTheDocument();
  });
});

describe('RowActionMenu CEL visible predicate (issue #1584)', () => {
  // A `variant:'primary'` action renders as an always-mounted inline button, so
  // the `visible` gate is directly observable (menu items live in a collapsed
  // dropdown that only mounts when opened).
  const RESUME = {
    name: 'resume',
    label: 'Resume',
    variant: 'primary' as const,
    visible: "record.status in ['paused', 'stopped']",
  };

  it('honors the CEL `in` operator against the row (the legacy engine could not)', () => {
    render(
      <PredicateScopeProvider scope={{}}>
        <RowActionMenu row={{ id: 'e1', status: 'paused' }} rowActionDefs={[RESUME]} onActionDef={() => {}} />
      </PredicateScopeProvider>,
    );
    expect(screen.getByTestId('row-action-inline-resume')).toBeInTheDocument();
  });

  it('hides the action when the CEL predicate is false', () => {
    render(
      <PredicateScopeProvider scope={{}}>
        <RowActionMenu row={{ id: 'e1', status: 'running' }} rowActionDefs={[RESUME]} onActionDef={() => {}} />
      </PredicateScopeProvider>,
    );
    expect(screen.queryByTestId('row-action-inline-resume')).not.toBeInTheDocument();
  });
});

/**
 * objectui#2614 — the BUILT-IN Edit/Delete row actions honor per-record
 * `visibleWhen` / `disabledWhen` CEL predicates from the object's
 * `userActions.edit` / `delete` object form. Items are rendered inside a
 * controlled-open dropdown (same pattern as the data-table's
 * `DataTableRowActionItem` tests) because Radix mounts menu content only when
 * open — which is also why predicate evaluation is lazy and free at grid
 * render time.
 */
describe('BuiltinRowActionItem per-record CEL predicates (#2614)', () => {
  // The downstream MES case: a task_version_check_item row is frozen once its
  // parent version is published; the Edit button must grey out on frozen rows.
  const FROZEN = { id: 'r1', name: 'Check item A', frozen: true };
  const DRAFT = { id: 'r2', name: 'Check item B', frozen: false };

  function renderItem(props: { predicates?: any; row: any; onSelect?: (row: any) => void }) {
    return render(
      <PredicateScopeProvider scope={{}}>
        <DropdownMenu open modal={false}>
          <DropdownMenuTrigger>menu</DropdownMenuTrigger>
          <DropdownMenuContent>
            <BuiltinRowActionItem
              name="edit"
              icon={<Edit className="mr-2 h-4 w-4" />}
              label="Edit"
              onSelect={props.onSelect ?? (() => {})}
              predicates={props.predicates}
              row={props.row}
            />
          </DropdownMenuContent>
        </DropdownMenu>
      </PredicateScopeProvider>,
    );
  }

  it('renders enabled with no predicates (today’s behavior, zero regression)', () => {
    renderItem({ row: FROZEN });
    const item = screen.getByTestId('row-action-builtin-edit');
    expect(item).toBeInTheDocument();
    expect(item).not.toHaveAttribute('aria-disabled', 'true');
  });

  it('disabledWhen true → rendered but disabled, and clicks do not fire', () => {
    const onSelect = vi.fn();
    renderItem({ predicates: { disabledWhen: 'record.frozen == true' }, row: FROZEN, onSelect });
    const item = screen.getByTestId('row-action-builtin-edit');
    expect(item).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(item);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('disabledWhen false → enabled, and clicks fire with the row', () => {
    const onSelect = vi.fn();
    renderItem({ predicates: { disabledWhen: 'record.frozen == true' }, row: DRAFT, onSelect });
    const item = screen.getByTestId('row-action-builtin-edit');
    expect(item).not.toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(item);
    expect(onSelect).toHaveBeenCalledWith(DRAFT);
  });

  it('visibleWhen false → the item is not rendered for that row', () => {
    renderItem({ predicates: { visibleWhen: 'record.frozen != true' }, row: FROZEN });
    expect(screen.queryByTestId('row-action-builtin-edit')).not.toBeInTheDocument();
  });

  it('visibleWhen true → the item renders', () => {
    renderItem({ predicates: { visibleWhen: 'record.frozen != true' }, row: DRAFT });
    expect(screen.getByTestId('row-action-builtin-edit')).toBeInTheDocument();
  });

  it('accepts the canonical { dialect, source } envelope', () => {
    renderItem({
      predicates: { visibleWhen: { dialect: 'cel', source: 'record.frozen != true' } },
      row: FROZEN,
    });
    expect(screen.queryByTestId('row-action-builtin-edit')).not.toBeInTheDocument();
  });

  it('a faulting visibleWhen fails CLOSED (hidden), a faulting disabledWhen fails soft (enabled)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      renderItem({ predicates: { visibleWhen: 'record.nonexistent.deep == 1' }, row: DRAFT });
      expect(screen.queryByTestId('row-action-builtin-edit')).not.toBeInTheDocument();
    } finally {
      warn.mockRestore();
    }
    const warn2 = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      renderItem({ predicates: { disabledWhen: 'record.nonexistent.deep == 1' }, row: DRAFT });
      expect(screen.getByTestId('row-action-builtin-edit')).not.toHaveAttribute('aria-disabled', 'true');
    } finally {
      warn2.mockRestore();
    }
  });
});
