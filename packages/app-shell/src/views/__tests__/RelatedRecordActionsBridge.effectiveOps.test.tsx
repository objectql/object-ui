// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * RelatedRecordActionsBridge — effective API operations (#3546).
 *
 * The related-list Create/Edit/Delete affordances for a CHILD object must be
 * intersected with the server-resolved effective operation set for that child
 * (`/me/permissions` `apiOperations`), so the list never offers an operation
 * the server would 405. These pin the button-visibility outcome:
 *   • full CRUD effective set → onCreate/onEdit/onDelete all present;
 *   • read-only effective set → none present;
 *   • update-only effective set → onEdit present, onCreate/onDelete absent;
 *   • undefined (unrestricted / old backend) → bucket affordances win (all present).
 */

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';
import { vi } from 'vitest';

// Controllable effective-operations map, keyed by child object name.
let effectiveOps: Record<string, string[] | undefined> = {};

vi.mock('@object-ui/permissions', () => ({
  usePermissions: () => ({
    getObjectApiOperations: (name: string) => effectiveOps[name],
  }),
}));

import { RelatedRecordActionsBridge } from '../RelatedRecordActionsBridge';
import { useRelatedRecordActions } from '@object-ui/react';

const CHILD = 'invoice';
// platform bucket → create/edit/delete all open by default.
const objects = [{ name: CHILD, managedBy: 'platform' }];

/** Probe: resolves the child's handlers and exposes which are present. */
function Probe({ onResolve }: { onResolve: (present: Record<string, boolean>) => void }) {
  const api = useRelatedRecordActions();
  const handlers = api?.resolve({ objectName: CHILD }) ?? {};
  onResolve({
    onCreate: typeof handlers.onCreate === 'function',
    onEdit: typeof handlers.onEdit === 'function',
    onDelete: typeof handlers.onDelete === 'function',
    onView: typeof handlers.onView === 'function',
  });
  return null;
}

function resolveHandlers(): Record<string, boolean> {
  let captured: Record<string, boolean> = {};
  render(
    <MemoryRouter>
      <RelatedRecordActionsBridge
        appName="crm"
        objects={objects}
        dataSource={{ delete: vi.fn() }}
        actionLabel={(_o, _n, fallback) => fallback}
      >
        <Probe onResolve={(p) => { captured = p; }} />
      </RelatedRecordActionsBridge>
    </MemoryRouter>,
  );
  return captured;
}

describe('RelatedRecordActionsBridge — effective API operations (#3546)', () => {
  it('full-CRUD effective set → Create/Edit/Delete all offered', () => {
    effectiveOps = { [CHILD]: ['get', 'list', 'create', 'update', 'delete'] };
    const h = resolveHandlers();
    expect(h.onCreate).toBe(true);
    expect(h.onEdit).toBe(true);
    expect(h.onDelete).toBe(true);
    expect(h.onView).toBe(true); // view is always allowed when the list renders
  });

  it('read-only effective set → no Create/Edit/Delete (only View)', () => {
    effectiveOps = { [CHILD]: ['get', 'list'] };
    const h = resolveHandlers();
    expect(h.onCreate).toBe(false);
    expect(h.onEdit).toBe(false);
    expect(h.onDelete).toBe(false);
    expect(h.onView).toBe(true);
  });

  it('update-only effective set → Edit offered, Create/Delete hidden', () => {
    effectiveOps = { [CHILD]: ['get', 'list', 'update'] };
    const h = resolveHandlers();
    expect(h.onEdit).toBe(true);
    expect(h.onCreate).toBe(false);
    expect(h.onDelete).toBe(false);
  });

  it('undefined effective set (unrestricted / old backend) → bucket wins, all offered', () => {
    effectiveOps = { [CHILD]: undefined };
    const h = resolveHandlers();
    expect(h.onCreate).toBe(true);
    expect(h.onEdit).toBe(true);
    expect(h.onDelete).toBe(true);
  });
});
