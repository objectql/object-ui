/**
 * Permission Management Page
 *
 * Metadata-driven permission management powered by ObjectView.
 * The sys_permission object definition in systemObjects.ts drives
 * the table columns, search, sort, and CRUD operations.
 */

import { useAuth } from '@object-ui/auth';
import { Key } from 'lucide-react';
import { SystemObjectViewPage } from './SystemObjectViewPage';

export function PermissionManagementPage() {
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'admin';

  return (
    <SystemObjectViewPage
      objectName="sys_permission"
      title="Permissions"
      description="Manage permission rules and assignments"
      icon={Key}
      isAdmin={isAdmin}
    />
  );
}
