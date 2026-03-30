/**
 * Audit Log Page
 *
 * Read-only metadata-driven audit log powered by ObjectView.
 * The sys_audit_log object definition in systemObjects.ts drives
 * the table columns, search, and sort. All mutation operations
 * are disabled (read-only view).
 */

import { ScrollText } from 'lucide-react';
import { SystemObjectViewPage } from './SystemObjectViewPage';

export function AuditLogPage() {
  return (
    <SystemObjectViewPage
      objectName="sys_audit_log"
      title="Audit Log"
      description="View system activity and user actions"
      icon={ScrollText}
      readOnly
    />
  );
}
