/**
 * User Management Page
 *
 * Displays a list of system users with CRUD capabilities.
 * Fetches data via dataSource.find('sys_user') and supports
 * create / delete operations.
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@object-ui/auth';
import { Button, Card, CardContent, Badge } from '@object-ui/components';
import { Plus, Users, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAdapter } from '../../context/AdapterProvider';
import { systemObjects } from './systemObjects';

const userObject = systemObjects.find((o) => o.name === 'sys_user')!;
const columns = userObject.views[0].columns;

export function UserManagementPage() {
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'admin';
  const dataSource = useAdapter();

  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!dataSource) return;
    setLoading(true);
    try {
      const result = await dataSource.find('sys_user');
      setRecords(result.data || []);
    } catch {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [dataSource]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreate = useCallback(async () => {
    if (!dataSource) return;
    try {
      await dataSource.create('sys_user', { name: 'New User', email: '', role: 'member', status: 'active' });
      toast.success('User created');
      fetchData();
    } catch {
      toast.error('Failed to create user');
    }
  }, [dataSource, fetchData]);

  const handleDelete = useCallback(async (id: string) => {
    if (!dataSource) return;
    try {
      await dataSource.delete('sys_user', id);
      toast.success('User deleted');
      fetchData();
    } catch {
      toast.error('Failed to delete user');
    }
  }, [dataSource, fetchData]);

  return (
    <div className="flex flex-col gap-4 sm:gap-6 p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="bg-primary/10 p-2 rounded-md shrink-0">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">User Management</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Manage system users and their roles</p>
          </div>
        </div>
        {isAdmin && (
          <Button size="sm" className="shrink-0 gap-2" onClick={handleCreate}>
            <Plus className="h-4 w-4" />
            Add User
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  {columns.map((col) => {
                    const field = userObject.fields.find((f) => f.name === col);
                    return (
                      <th key={col} className="h-10 px-3 sm:px-4 text-left font-medium text-muted-foreground whitespace-nowrap">
                        {field?.label ?? col}
                      </th>
                    );
                  })}
                  {isAdmin && <th className="h-10 px-3 sm:px-4 text-right font-medium text-muted-foreground">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td className="p-6 text-center" colSpan={columns.length + (isAdmin ? 1 : 0)}>
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                    </td>
                  </tr>
                ) : records.length === 0 ? (
                  <tr>
                    <td className="p-4 sm:p-6 text-center text-sm text-muted-foreground" colSpan={columns.length + (isAdmin ? 1 : 0)}>
                      <div className="flex flex-col items-center gap-2 py-4">
                        <Users className="h-8 w-8 text-muted-foreground/50" />
                        <p>No users found.</p>
                        <Badge variant="secondary" className="text-xs">plugin-grid powered</Badge>
                      </div>
                    </td>
                  </tr>
                ) : (
                  records.map((record) => (
                    <tr key={record.id || record._id} className="border-b hover:bg-muted/50 transition-colors">
                      {columns.map((col) => (
                        <td key={col} className="h-10 px-3 sm:px-4 whitespace-nowrap">
                          {String(record[col] ?? '')}
                        </td>
                      ))}
                      {isAdmin && (
                        <td className="h-10 px-3 sm:px-4 text-right">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(record.id || record._id)}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
