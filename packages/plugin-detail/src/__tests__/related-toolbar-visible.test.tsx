/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Regression: a related list's `list_toolbar` header actions must honor each
 * action's `visible` CEL predicate. The same bridge (`deriveActions`) feeds
 * both the row actions (`list_item`, honored via the data-table's
 * `DataTableRowActionItem`) and these header buttons (`list_toolbar`); the
 * toolbar path used to render every action unconditionally, so e.g.
 * `invite_user` (`visible: "features.organization != false"`) showed even when
 * the org feature was disabled.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';
import { PredicateScopeProvider } from '@object-ui/react';
import { RelatedToolbarButton } from '../RelatedList';

function renderButton(action: any, scope: Record<string, any> = {}) {
  return render(
    <PredicateScopeProvider scope={scope}>
      <RelatedToolbarButton action={action} onToolbarAction={() => {}} />
    </PredicateScopeProvider>,
  );
}

describe('RelatedList list_toolbar button — visible CEL', () => {
  it('hides a toolbar action whose `visible` predicate is false', () => {
    renderButton(
      { name: 'invite_user', label: 'Invite User', visible: 'features.organization != false' },
      { features: { organization: false } },
    );
    expect(screen.queryByTestId('related-toolbar-action-invite_user')).toBeNull();
    expect(screen.queryByText('Invite User')).toBeNull();
  });

  it('shows a toolbar action whose `visible` predicate is true', () => {
    renderButton(
      { name: 'invite_user', label: 'Invite User', visible: 'features.organization != false' },
      { features: { organization: true } },
    );
    expect(screen.getByTestId('related-toolbar-action-invite_user')).toBeInTheDocument();
    expect(screen.getByText('Invite User')).toBeInTheDocument();
  });

  it('renders a toolbar action with no `visible` predicate', () => {
    renderButton({ name: 'export', label: 'Export' });
    expect(screen.getByTestId('related-toolbar-action-export')).toBeInTheDocument();
  });
});

/**
 * objectui#3871 — the same gate, with the predicate written in the documented
 * `${…}` template spelling. This leg does NOT opt into `throwOnError`, so the
 * double wrap came back from the evaluator as the unparsed string and
 * `Boolean(…)` read it as a constant `true`: the toolbar action was shown
 * whatever its predicate said. `invite_user` is the live example in the prose
 * above — spelled as a template it would have appeared with the org feature off.
 *
 * Reverse verification: restore the unconditional wrap and the "false hides"
 * case goes red; the "true shows" case was green already (shown either way), so
 * both are here and only one is the detector.
 */
describe('RelatedList list_toolbar button — `${…}` template `visible` (objectui#3871)', () => {
  const TEMPLATE = '${features.organization !== false}';

  it('hides a toolbar action whose template predicate is false (DETECTOR)', () => {
    renderButton(
      { name: 'invite_user', label: 'Invite User', visible: TEMPLATE },
      { features: { organization: false } },
    );
    expect(screen.queryByTestId('related-toolbar-action-invite_user')).toBeNull();
  });

  it('shows a toolbar action whose template predicate is true', () => {
    renderButton(
      { name: 'invite_user', label: 'Invite User', visible: TEMPLATE },
      { features: { organization: true } },
    );
    expect(screen.getByTestId('related-toolbar-action-invite_user')).toBeInTheDocument();
  });
});
