/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from 'react';
import { Card } from '@object-ui/components';
import { useRecordContext } from '@object-ui/react';
import { AssignedUsersSection } from './AssignedUsersSection';

/**
 * `record:permission_assignments` — surfaces a permission set's user
 * assignment (add / remove via `sys_user_permission_set`, plus position-held
 * grants) directly on the Setup `sys_permission_set` record page
 * (ADR-0056 P1b / epic #2398).
 *
 * In the pure model, assigning users to a set is a Setup (admin) act — the
 * permission facets themselves are *designed* in Studio (rendered read-only
 * here as summary + deep-link, see PermissionFacetLink). So the assignment UI
 * belongs on the Setup record page, not buried in the structured editor. It is
 * injected as the record page's `discussion` (main-column, full-width footer)
 * slot for `sys_permission_set` only, in RecordDetailView.
 *
 * The set's api-name comes from the record context; `AssignedUsersSection` is
 * otherwise self-contained (it resolves its own adapter). Renders nothing until
 * the record (hence the name) is loaded.
 */
export function RecordPermissionAssignmentsRenderer(): React.ReactElement | null {
  const ctx = useRecordContext();
  const setName = (ctx?.data as Record<string, unknown> | undefined)?.name;
  if (!setName || typeof setName !== 'string') return null;
  return (
    <Card className="overflow-hidden">
      <AssignedUsersSection permissionSetName={setName} />
    </Card>
  );
}

export default RecordPermissionAssignmentsRenderer;
