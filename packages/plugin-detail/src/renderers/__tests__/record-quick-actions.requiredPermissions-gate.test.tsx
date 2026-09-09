/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * `record:quick_actions.requiredPermissions` — the BLOCK-LEVEL permission
 * gate the registration describes as "Hide the whole bar unless the user
 * holds these permissions" (objectui#8071 slice 4).
 *
 * Not to be confused with an `ActionDef`'s OWN `requiredPermissions` — a
 * per-action field the `gated` fixture in
 * `record-quick-actions.declared-action-ids-7182.test.tsx` already exercises
 * through `ActionEngine.getActionsForLocation`'s per-action filter. This file
 * pins the renderer's OWN read of `schema.requiredPermissions`, at
 * `record-quick-actions.tsx`:
 *
 *   const required: string[] = Array.isArray(schema.requiredPermissions)
 *     ? schema.requiredPermissions
 *     : [];
 *   if (required.length > 0 && objectName) {
 *     const ok = required.every((p) => perms.can(objectName, p as any));
 *     if (!ok) return <…Insufficient permissions…/>;
 *   }
 *
 * — a gate that runs BEFORE any action is drawn, over the WHOLE array via
 * `.every`, against the record's own `objectName`. A declaration reading only
 * "array of string" cannot tell this from a single scalar flag; the member
 * shape only shows up once every element is actually checked (`.every`, not
 * `[0]`), which is what the "partial grant" case below is for.
 */

import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MetadataCtx, RecordContextProvider } from '@object-ui/react';
import type { MetadataContextValue } from '@object-ui/react';
import { RecordQuickActionsRenderer } from '../record-quick-actions';

/** Permissions the mocked `perms.can` currently grants — reassigned per test. */
const stub = { granted: new Set<string>() };

const canSpy = vi.fn((_object: string, action: string) => stub.granted.has(action));

vi.mock('@object-ui/permissions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@object-ui/permissions')>();
  return {
    ...actual,
    usePermissions: () => ({
      can: canSpy,
      cannot: (object: string, action: string) => !canSpy(object, action),
    }),
  };
});

/** Declared on the object, at the location this bar renders by default. */
const APPROVE = {
  name: 'approve',
  label: 'Approve',
  type: 'script',
  locations: ['record_header'],
};

const OBJECT_META = { name: 'crm_account', actions: [APPROVE] };

const getItem = vi.fn(async (type: string, name: string) =>
  type === 'object' && name === 'crm_account' ? OBJECT_META : null,
);

/**
 * Held at MODULE level on purpose: `getItem` is an effect dependency of
 * `useMetadataItem`, so a value rebuilt per render spins that hook forever
 * (the same reason `recordQuickActionsInputs.actionNamesFallback.test.tsx`
 * does this).
 */
const METADATA: MetadataContextValue = {
  apps: [],
  objects: [OBJECT_META] as any,
  dashboards: [],
  reports: [],
  pages: [],
  loading: false,
  error: null,
  refresh: async () => {},
  invalidate: () => {},
  ensureType: async () => [],
  getItem: getItem as unknown as MetadataContextValue['getItem'],
  getItemsByType: () => [],
  getTypeStatus: () => 'ready' as const,
};

function mount(schema: Record<string, unknown>) {
  return render(
    <MetadataCtx.Provider value={METADATA}>
      <RecordContextProvider objectName="crm_account" recordId="rec-1" data={{ id: 'rec-1' }}>
        <RecordQuickActionsRenderer schema={{ actionNames: ['approve'], ...schema } as any} />
      </RecordContextProvider>
    </MetadataCtx.Provider>,
  );
}

beforeEach(() => {
  stub.granted = new Set();
  canSpy.mockClear();
  getItem.mockClear();
});

describe('record:quick_actions.requiredPermissions — block-level gate (objectui#8071 slice 4)', () => {
  it('CONTROL: with no `requiredPermissions` declared, the bar renders regardless of the (empty) grant set', async () => {
    mount({});
    expect(await screen.findByRole('button', { name: 'Approve' })).toBeInTheDocument();
    // The gate short-circuits on `required.length > 0` — an absent key never
    // asks the permission system at all.
    expect(canSpy).not.toHaveBeenCalled();
  });

  it('hides the WHOLE bar when a declared permission is not held', async () => {
    mount({ requiredPermissions: ['crm.manage'] });
    expect(await screen.findByText(/insufficient permissions to view quick actions/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
    expect(canSpy).toHaveBeenCalledWith('crm_account', 'crm.manage');
  });

  it('renders once the declared permission is granted — the same key, read for real', async () => {
    stub.granted = new Set(['crm.manage']);
    mount({ requiredPermissions: ['crm.manage'] });
    expect(await screen.findByRole('button', { name: 'Approve' })).toBeInTheDocument();
    expect(screen.queryByText(/insufficient permissions/i)).not.toBeInTheDocument();
  });

  it('every declared permission must be held — a PARTIAL grant still gates the bar', async () => {
    // Only one of the two declared permissions is granted. A verdict driven
    // by `required[0]` alone (or by "any", not "every") would pass this —
    // reading `.every` over the full array is the member shape this test
    // exists to discriminate.
    stub.granted = new Set(['crm.manage']);
    mount({ requiredPermissions: ['crm.manage', 'crm.export'] });
    expect(await screen.findByText(/insufficient permissions to view quick actions/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
    expect(canSpy).toHaveBeenCalledWith('crm_account', 'crm.manage');
    expect(canSpy).toHaveBeenCalledWith('crm_account', 'crm.export');
  });

  it('granting ALL declared permissions renders the bar — the positive control for the partial-grant case above', async () => {
    stub.granted = new Set(['crm.manage', 'crm.export']);
    mount({ requiredPermissions: ['crm.manage', 'crm.export'] });
    expect(await screen.findByRole('button', { name: 'Approve' })).toBeInTheDocument();
  });

  it('checks the gate against THIS record\'s own `objectName`, not a fixed string', async () => {
    stub.granted = new Set(['crm.manage']);
    mount({ requiredPermissions: ['crm.manage'] });
    await screen.findByRole('button', { name: 'Approve' });
    expect(canSpy).toHaveBeenCalledWith('crm_account', 'crm.manage');
    expect(canSpy).not.toHaveBeenCalledWith(expect.not.stringMatching('crm_account'), 'crm.manage');
  });
});
