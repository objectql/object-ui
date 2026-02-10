/**
 * Audit Log Page
 *
 * Read-only grid displaying system audit logs.
 * Shows user actions, resources, timestamps, and details.
 */

import { systemObjects } from './systemObjects';

const auditObject = systemObjects.find((o) => o.name === 'sys_audit_log')!;

export function AuditLogPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Audit Log</h1>
        <p className="text-muted-foreground">View system activity and user actions</p>
      </div>

      <div className="rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              {auditObject.views[0].columns.map((col) => {
                const field = auditObject.fields.find((f) => f.name === col);
                return (
                  <th key={col} className="h-10 px-4 text-left font-medium text-muted-foreground">
                    {field?.label ?? col}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            <tr className="border-b">
              <td className="p-4 text-muted-foreground" colSpan={auditObject.views[0].columns.length}>
                Connect to ObjectStack server to load audit logs. In production, this page uses plugin-grid in read-only mode.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
