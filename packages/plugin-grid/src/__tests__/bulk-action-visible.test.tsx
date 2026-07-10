/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Regression: the selection bulk-action bar must honor each `BulkActionDef`'s
 * `visible` predicate (a permission / feature gate). It used to render every
 * `bulkActionDefs` entry unconditionally, ignoring `visible` entirely.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';
import { PredicateScopeProvider } from '@object-ui/react';
import { BulkActionBar } from '../components/BulkActionBar';

function renderBar(actionDefs: any[], scope: Record<string, any> = {}) {
  return render(
    <PredicateScopeProvider scope={scope}>
      <BulkActionBar
        selectedRows={[{ id: '1' }]}
        actions={[]}
        actionDefs={actionDefs}
        onActionDef={() => {}}
      />
    </PredicateScopeProvider>,
  );
}

describe('BulkActionBar — bulk action visible CEL', () => {
  it('hides a bulk action whose `visible` predicate is false', () => {
    renderBar(
      [{ name: 'bulk_delete', label: 'Delete', visible: 'features.canBulkDelete == true' }],
      { features: { canBulkDelete: false } },
    );
    expect(screen.queryByTestId('bulk-action-bulk_delete')).toBeNull();
    // The bar itself still renders (the selection count / Clear affordance).
    expect(screen.getByTestId('bulk-actions-bar')).toBeInTheDocument();
  });

  it('shows a bulk action whose `visible` predicate is true', () => {
    renderBar(
      [{ name: 'bulk_delete', label: 'Delete', visible: 'features.canBulkDelete == true' }],
      { features: { canBulkDelete: true } },
    );
    expect(screen.getByTestId('bulk-action-bulk_delete')).toBeInTheDocument();
  });

  it('renders a bulk action with no `visible` predicate', () => {
    renderBar([{ name: 'bulk_tag', label: 'Tag' }]);
    expect(screen.getByTestId('bulk-action-bulk_tag')).toBeInTheDocument();
  });
});
