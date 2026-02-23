/**
 * Permission Management Page
 *
 * Displays a grid of sys_permission records with CRUD capabilities,
 * search filtering, and role assignment.
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@object-ui/auth';
import { Button, Card, CardContent, Badge, Input } from '@object-ui/components';
import { Plus, Key, Loader2, Trash2, Search } from 'lucide-react';
import { toast } from 'sonner';
import { useAdapter } from '../../context/AdapterProvider';
import { systemObjects } from './systemObjects';

const permObject = systemObjects.find((o) => o.name === 'sys_permission')!;
const columns = permObject.views[0].columns;

export function PermissionManagementPage() {
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'admin';
  const dataSource = useAdapter();

  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchData = useCallback(async () => {
    if (!dataSource) return;
    setLoading(true);
    try {
      const result = await dataSource.find('sys_permission');
      setRecords(result.data || []);
    } catch {
      toast.error('Failed to load permissions');
    } finally {
      setLoading(false);
    }
  }, [dataSource]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreate = useCallback(async () => {
    if (!dataSource) return;
    try {
      await dataSource.create('sys_permission', {
        name: 'New Permission',
        description: '',
        resource: '',
        action: 'read',
      });
      toast.success('Permission created');
      fetchData();
    } catch {
      toast.error('Failed to create permission');
    }
  }, [dataSource, fetchData]);

  const handleDelete = useCallback(async (id: string) => {
    if (!dataSource) return;
    try {
      await dataSource.delete('sys_permission', id);
      toast.success('Permission deleted');
      fetchData();
    } catch {
      toast.error('Failed to delete permission');
    }
  }, [dataSource, fetchData]);

  // Filter records by search query
  const filteredRecords = records.filter((r) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (r.name || '').toLowerCase().includes(q) ||
      (r.resource || '').toLowerCase().includes(q) ||
      (r.action || '').toLowerCase().includes(q) ||
      (r.description || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0 flex items-center gap-2">
          <Key className="h-5 w-5 text-muted-foreground" />
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Permissions</h1>
            <p className="text-sm text-muted-foreground">Manage permission rules and assignments</p>
          </div>
        </div>
        {isAdmin && (
          <Button onClick={handleCreate} data-testid="add-permission-btn">
            <Plus className="h-4 w-4 mr-2" />
            Add Permission
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search permissions..."
          value={searchQuery}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
          className="pl-8"
          data-testid="permission-search-input"
        />
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-8 justify-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading permissions...</span>
        </div>
      ) : filteredRecords.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">No permissions found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="permissions-table">
            <thead>
              <tr className="border-b text-left">
                {columns.map((col: string) => (
                  <th key={col} className="py-2 px-3 font-medium text-muted-foreground capitalize">
                    {permObject.fields.find((f: any) => f.name === col)?.label || col}
                  </th>
                ))}
                {isAdmin && <th className="py-2 px-3 font-medium text-muted-foreground">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((rec: any) => (
                <tr key={rec.id} className="border-b hover:bg-muted/50">
                  {columns.map((col: string) => (
                    <td key={col} className="py-2 px-3">
                      {col === 'action' ? (
                        <Badge variant="outline">{rec[col]}</Badge>
                      ) : (
                        <span className="truncate">{rec[col] ?? '—'}</span>
                      )}
                    </td>
                  ))}
                  {isAdmin && (
                    <td className="py-2 px-3">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(rec.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
