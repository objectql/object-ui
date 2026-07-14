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
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';
import { PredicateScopeProvider } from '@object-ui/react';
import { RowActionMenu } from '../RowActionMenu';

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
