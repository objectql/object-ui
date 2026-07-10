/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Regression: an `action:group` in `display: 'dropdown'` mode must honor each
 * action's `visible` (and `enabled`) CEL predicate — the same way the group's
 * inline mode (`InlineActionButton`) already does. Previously the dropdown
 * branch mapped `schema.actions` straight to `DropdownMenuItem`s, so an action
 * whose `visible` said to hide it showed anyway.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';
import { PredicateScopeProvider } from '@object-ui/react';
import { DropdownActionItem } from '../action-group';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '../../../ui';

// Render a single dropdown action item inside a controlled-open menu so the
// portal content mounts deterministically (Radix triggers open on pointerdown,
// which is flaky to synthesize in happy-dom). `visible`/`enabled` resolve
// against the ambient ExpressionProvider scope, matching `InlineActionButton`.
function renderItem(action: any, scope: Record<string, any> = {}) {
  return render(
    <PredicateScopeProvider scope={scope}>
      <DropdownMenu open modal={false}>
        <DropdownMenuTrigger>menu</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownActionItem action={action} index={0} onSelect={() => {}} />
        </DropdownMenuContent>
      </DropdownMenu>
    </PredicateScopeProvider>,
  );
}

describe('action:group dropdown item — visible / enabled CEL', () => {
  it('hides an action whose `visible` predicate is false', () => {
    renderItem(
      { name: 'archive', label: 'Archive', visible: 'features.canArchive == true' },
      { features: { canArchive: false } },
    );
    expect(screen.queryByText('Archive')).toBeNull();
  });

  it('shows an action whose `visible` predicate is true', () => {
    renderItem(
      { name: 'archive', label: 'Archive', visible: 'features.canArchive == true' },
      { features: { canArchive: true } },
    );
    expect(screen.getByText('Archive')).toBeInTheDocument();
  });

  it('renders an action with no `visible` predicate', () => {
    renderItem({ name: 'view', label: 'View' });
    expect(screen.getByText('View')).toBeInTheDocument();
  });

  it('disables (but still renders) an action whose `enabled` CEL is false', () => {
    renderItem(
      { name: 'run', label: 'Run', enabled: 'features.ready == true' },
      { features: { ready: false } },
    );
    const item = screen.getByText('Run').closest('[role="menuitem"]');
    expect(item).toBeTruthy();
    expect(item).toHaveAttribute('data-disabled');
  });
});
