/**
 * Organization Management Page
 *
 * Displays a list of organizations with member management.
 * Reuses the plugin-grid for data display.
 */

import { useAuth } from '@object-ui/auth';
import { systemObjects } from './systemObjects';

const orgObject = systemObjects.find((o) => o.name === 'sys_org')!;

export function OrgManagementPage() {
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'admin';

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Organization Management</h1>
          <p className="text-muted-foreground">Manage organizations and their members</p>
        </div>
        {isAdmin && (
          <button
            type="button"
            className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground ring-offset-background transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Add Organization
          </button>
        )}
      </div>

      <div className="rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              {orgObject.views[0].columns.map((col) => {
                const field = orgObject.fields.find((f) => f.name === col);
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
              <td className="p-4 text-muted-foreground" colSpan={orgObject.views[0].columns.length}>
                Connect to ObjectStack server to load organizations. In production, this page uses plugin-grid for full CRUD functionality.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
