/**
 * Audit Log Page
 *
 * Read-only grid displaying system audit logs.
 * Fetches data via dataSource.find('sys_audit_log').
 */

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, Badge } from '@object-ui/components';
import { ScrollText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAdapter } from '../../context/AdapterProvider';
import { systemObjects } from './systemObjects';

const auditObject = systemObjects.find((o) => o.name === 'sys_audit_log')!;
const columns = auditObject.views[0].columns;

export function AuditLogPage() {
  const dataSource = useAdapter();

  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!dataSource) return;
    setLoading(true);
    try {
      const result = await dataSource.find('sys_audit_log', { $orderby: { createdAt: 'desc' } });
      setRecords(result.data || []);
    } catch {
      toast.error('Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  }, [dataSource]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div className="flex flex-col gap-4 sm:gap-6 p-4 sm:p-6">
      <div className="flex items-center gap-3 min-w-0">
        <div className="bg-primary/10 p-2 rounded-md shrink-0">
          <ScrollText className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Audit Log</h1>
          <p className="text-sm text-muted-foreground mt-0.5">View system activity and user actions</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  {columns.map((col) => {
                    const field = auditObject.fields.find((f) => f.name === col);
                    return (
                      <th key={col} className="h-10 px-3 sm:px-4 text-left font-medium text-muted-foreground whitespace-nowrap">
                        {field?.label ?? col}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td className="p-6 text-center" colSpan={columns.length}>
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                    </td>
                  </tr>
                ) : records.length === 0 ? (
                  <tr>
                    <td className="p-4 sm:p-6 text-center text-sm text-muted-foreground" colSpan={columns.length}>
                      <div className="flex flex-col items-center gap-2 py-4">
                        <ScrollText className="h-8 w-8 text-muted-foreground/50" />
                        <p>No audit logs found.</p>
                        <Badge variant="secondary" className="text-xs">Read-only</Badge>
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
