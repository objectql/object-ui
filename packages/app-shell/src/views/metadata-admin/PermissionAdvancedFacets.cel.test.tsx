// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import * as React from 'react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PermissionAdvancedFacets } from './PermissionAdvancedFacets';

afterEach(cleanup);

const t = (k: string) => k;

function renderFacets(over: Record<string, unknown> = {}) {
  const props = {
    draft: {
      rowLevelSecurity: [
        { name: 'p1', object: 'account', operation: 'all', using: 'organization_id ==', check: '', enabled: true },
      ],
    },
    setDraft: () => {},
    writable: true,
    allSetNames: [] as string[],
    loadObjectFields: async () => ['organization_id', 'owner_id'],
    t,
    ...over,
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return render(<PermissionAdvancedFacets {...(props as any)} />);
}

describe('PermissionAdvancedFacets · CEL authoring safety (objectui#2413)', () => {
  it('reports blocking CEL errors up so the host can gate Save', async () => {
    const onCelErrorsChange = vi.fn();
    const user = userEvent.setup();
    renderFacets({ onCelErrorsChange });
    // The RLS facet is collapsed by default — expand it to mount the editors.
    await user.click(screen.getByText('perm.rls.title'));
    await waitFor(() => expect(onCelErrorsChange).toHaveBeenCalledWith(1), { timeout: 3000 });
  });

  it('opens the test-run dialog for a policy', async () => {
    const user = userEvent.setup();
    renderFacets();
    await user.click(screen.getByText('perm.rls.title'));
    await user.click(await screen.findByRole('button', { name: /perm\.cel\.test\.run/ }));
    expect(await screen.findByText('perm.cel.test.title', {}, { timeout: 3000 })).toBeTruthy();
  });
});
