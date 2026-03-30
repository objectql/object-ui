/**
 * User Management Page
 *
 * Metadata-driven user management powered by ObjectView.
 * The sys_user object definition in systemObjects.ts drives
 * the table columns, search, sort, and CRUD operations.
 */

import { useAuth } from '@object-ui/auth';
import { Users } from 'lucide-react';
import { SystemObjectViewPage } from './SystemObjectViewPage';

export function UserManagementPage() {
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'admin';

  return (
    <SystemObjectViewPage
      objectName="sys_user"
      title="User Management"
      description="Manage system users and their roles"
      icon={Users}
      isAdmin={isAdmin}
    />
  );
}
