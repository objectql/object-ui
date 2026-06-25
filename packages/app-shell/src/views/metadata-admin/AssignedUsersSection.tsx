/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * AssignedUsersSection — "Manage Assignments" for a permission set.
 *
 * Renders the GENERIC `<RelatedList>` (with its add-by-picker affordance) over
 * the `sys_user_permission_set` junction, so an admin can grant/revoke a
 * permission set to users WITHOUT raw data editing. This is the Salesforce
 * "Assigned Users" pattern, expressed through the reusable related-list
 * primitive rather than a bespoke editor: pick a `sys_user` → a junction row
 * `{permission_set_id, user_id}` is created; remove deletes the junction row.
 * Server-side insert rules still apply and surface inline — e.g. the AI-seat
 * cap rejects the N+1 assignment for the `ai_seat` permission set.
 *
 * It is deliberately permission-set-agnostic: every role/permission set gets
 * the same management UI, and `ai_seat` (the AI-seat) is just one of them.
 */

import * as React from 'react';
import { useAdapter } from '@object-ui/react';
import { RelatedList } from '@object-ui/plugin-detail';

export interface AssignedUsersSectionProps {
  /** The permission set's machine name (e.g. `ai_seat`, `admin_full_access`). */
  permissionSetName: string;
}

export function AssignedUsersSection({ permissionSetName }: AssignedUsersSectionProps) {
  const adapter = useAdapter();
  const [setId, setSetId] = React.useState<string | null>(null);

  // Resolve the permission set's id from its name (the junction links by id).
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res: any = await (adapter as any).find('sys_permission_set', {
          $filter: { name: permissionSetName },
          limit: 1,
        });
        const rows: any[] = Array.isArray(res) ? res : res?.data ?? res?.records ?? [];
        const id = rows?.[0]?.id;
        if (!cancelled) setSetId(id != null ? String(id) : null);
      } catch {
        if (!cancelled) setSetId(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [adapter, permissionSetName]);

  if (!setId) return null;

  return (
    <RelatedList
      title="Assigned Users"
      type="table"
      api="sys_user_permission_set"
      objectName="sys_user_permission_set"
      referenceField="permission_set_id"
      parentId={setId}
      dataSource={adapter as any}
      columns={['user_id', 'granted_by']}
      add={{
        picker: { object: 'sys_user', valueField: 'id', labelField: 'email' },
        linkField: 'user_id',
        label: 'Add user',
      }}
      onRowDelete={async (row: any) => {
        const id = row?.id ?? row?._id;
        if (id != null) await (adapter as any).delete?.('sys_user_permission_set', String(id));
      }}
    />
  );
}

export default AssignedUsersSection;
