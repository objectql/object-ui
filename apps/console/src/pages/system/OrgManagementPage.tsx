/**
 * Organization Management Page
 *
 * Metadata-driven organization management powered by ObjectView.
 * The sys_org object definition in systemObjects.ts drives
 * the table columns, search, sort, and CRUD operations.
 */

import { useAuth } from '@object-ui/auth';
import { Building2 } from 'lucide-react';
import { SystemObjectViewPage } from './SystemObjectViewPage';

export function OrgManagementPage() {
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'admin';

  return (
    <SystemObjectViewPage
      objectName="sys_org"
      title="Organization Management"
      description="Manage organizations and their members"
      icon={Building2}
      isAdmin={isAdmin}
    />
  );
}
