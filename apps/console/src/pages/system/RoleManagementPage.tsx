/**
 * Role Management Page
 *
 * Metadata-driven role management powered by ObjectView.
 * The sys_role object definition in systemObjects.ts drives
 * the table columns, search, sort, and CRUD operations.
 */

import { useAuth } from '@object-ui/auth';
import { Shield } from 'lucide-react';
import { SystemObjectViewPage } from './SystemObjectViewPage';

export function RoleManagementPage() {
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'admin';

  return (
    <SystemObjectViewPage
      objectName="sys_role"
      title="Role Management"
      description="Define roles and assign permissions"
      icon={Shield}
      isAdmin={isAdmin}
    />
  );
}
