/**
 * Audit Log Page (system route)
 *
 * Read-only browser for `sys_audit_log` records, surfaced via the System
 * Hub card at `/system/audit-log`. Talks to the framework REST endpoint
 * `/api/v1/data/sys_audit_log` with standard ObjectQL filter params.
 *
 * Field shape mirrors framework/packages/platform-objects/src/audit/
 * sys-audit-log.object.ts (snake_case columns).
 *
 * Scope (MVP):
 *  - Filter by action / object_name / actor (user_id) / date range
 *  - Paginated table (50/page)
 *  - Row click opens a side drawer with full event details + JSON
 *    diff of old_value → new_value when present
 *
 * Out of scope (future):
 *  - Cross-tenant filter (single-tenant view assumed)
 *  - CSV export / saved filter
 *  - Field-level redaction of old/new value payloads (handled server-side
 *    once FLS lands)
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  CardContent,
  Input,
  Label,
  Badge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  Skeleton,
  Empty,
  EmptyTitle,
  EmptyDescription,
  Alert,
  AlertDescription,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
} from '@object-ui/components';
import { RefreshCw, Search, X, AlertCircle, ScrollText } from 'lucide-react';
import { ACTION_OPTIONS, ACTION_VARIANT } from './auditLogActions';

const SERVER_URL = (import.meta.env.VITE_SERVER_URL || '').replace(/\/$/, '');
const API_BASE = `${SERVER_URL}/api/v1`;

interface AuditRow {
  id: string;
  created_at?: string;
  action?: string;
  user_id?: string | null;
  object_name?: string | null;
  record_id?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  old_value?: string | null;
  new_value?: string | null;
  tenant_id?: string | null;
  metadata?: string | null;
  [extra: string]: unknown;
}

const PAGE_SIZE = 50;

function formatDate(s: string | null | undefined): string {
  if (!s) return '—';
  try { return new Date(s).toLocaleString(); } catch { return s; }
}

function truncate(s: string | null | undefined, n = 24): string {
  if (!s) return '—';
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

function tryPrettyJson(s: string | null | undefined): string {
  if (!s) return '';
  try { return JSON.stringify(JSON.parse(s), null, 2); } catch { return s; }
}

export function AuditLogPage() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [objectFilter, setObjectFilter] = useState<string>('');
  const [actorFilter, setActorFilter] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>('');  // YYYY-MM-DD
  const [toDate, setToDate] = useState<string>('');

  // Pagination
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  // Selection
  const [selected, setSelected] = useState<AuditRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const filter: Record<string, unknown> = {};
      if (actionFilter && actionFilter !== 'all') filter.action = actionFilter;
      if (objectFilter.trim()) filter.object_name = objectFilter.trim();
      if (actorFilter.trim()) filter.user_id = actorFilter.trim();
      if (fromDate) filter.created_at = { ...(filter.created_at as object || {}), $gte: fromDate };
      if (toDate) filter.created_at = { ...(filter.created_at as object || {}), $lte: `${toDate}T23:59:59` };

      const params = new URLSearchParams();
      if (Object.keys(filter).length > 0) {
        params.set('$filter', JSON.stringify(filter));
      }
      params.set('$orderby', 'created_at desc');
      params.set('$top', String(PAGE_SIZE + 1));  // +1 to detect hasMore
      params.set('$skip', String(page * PAGE_SIZE));

      const res = await fetch(`${API_BASE}/data/sys_audit_log?${params.toString()}`, {
        credentials: 'include',
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}: ${body.slice(0, 200) || res.statusText}`);
      }
      const json = await res.json();
      // REST envelope: { object, records, total, hasMore }
      const items: AuditRow[] = Array.isArray(json)
        ? json
        : Array.isArray(json?.records)
          ? json.records
          : Array.isArray(json?.data)
            ? json.data
            : [];
      setHasMore(items.length > PAGE_SIZE);
      setRows(items.slice(0, PAGE_SIZE));
    } catch (err: any) {
      console.warn('[AuditLogPage] load failed:', err);
      setError(err?.message || 'Failed to load audit log');
      setRows([]);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [actionFilter, objectFilter, actorFilter, fromDate, toDate, page]);

  useEffect(() => { load(); }, [load]);

  const resetFilters = useCallback(() => {
    setActionFilter('all');
    setObjectFilter('');
    setActorFilter('');
    setFromDate('');
    setToDate('');
    setPage(0);
  }, []);

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (actionFilter !== 'all') n += 1;
    if (objectFilter.trim()) n += 1;
    if (actorFilter.trim()) n += 1;
    if (fromDate) n += 1;
    if (toDate) n += 1;
    return n;
  }, [actionFilter, objectFilter, actorFilter, fromDate, toDate]);

  return (
    <div className="p-6 space-y-4 max-w-screen-2xl mx-auto">
      <div className="flex items-center gap-3">
        <ScrollText className="h-6 w-6 text-muted-foreground" />
        <div className="flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">Audit Log</h1>
          <p className="text-sm text-muted-foreground">
            Read-only system activity and record changes. Newest first.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Filter bar */}
      <Card>
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-5 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Action</Label>
            <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); setPage(0); }}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All actions</SelectItem>
                {ACTION_OPTIONS.map((a) => (
                  <SelectItem key={a} value={a}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Object</Label>
            <Input
              placeholder="e.g. account"
              value={objectFilter}
              onChange={(e) => { setObjectFilter(e.target.value); setPage(0); }}
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Actor (user id)</Label>
            <Input
              placeholder="user id"
              value={actorFilter}
              onChange={(e) => { setActorFilter(e.target.value); setPage(0); }}
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">From</Label>
            <Input type="date" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setPage(0); }} className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">To</Label>
            <Input type="date" value={toDate} onChange={(e) => { setToDate(e.target.value); setPage(0); }} className="h-9" />
          </div>
          {activeFilterCount > 0 && (
            <div className="md:col-span-5 flex justify-end">
              <Button variant="ghost" size="sm" onClick={resetFilters}>
                <X className="h-4 w-4 mr-1" />
                Clear filters ({activeFilterCount})
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading && rows.length === 0 ? (
            <div className="p-6 space-y-2">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}
            </div>
          ) : rows.length === 0 ? (
            <div className="p-12">
              <Empty>
                <Search className="h-8 w-8 text-muted-foreground mb-3" />
                <EmptyTitle>No audit entries</EmptyTitle>
                <EmptyDescription>
                  {activeFilterCount > 0
                    ? 'Try clearing filters or widening the date range.'
                    : 'Events will appear here once tracked objects are modified.'}
                </EmptyDescription>
              </Empty>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px]">Timestamp</TableHead>
                  <TableHead className="w-[130px]">Action</TableHead>
                  <TableHead>Object</TableHead>
                  <TableHead>Record</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead className="w-[130px]">IP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const variant = ACTION_VARIANT[r.action || ''] || 'outline';
                  return (
                    <TableRow
                      key={r.id}
                      className="cursor-pointer"
                      onClick={() => setSelected(r)}
                    >
                      <TableCell className="font-mono text-xs">{formatDate(r.created_at)}</TableCell>
                      <TableCell><Badge variant={variant}>{r.action || '—'}</Badge></TableCell>
                      <TableCell>{r.object_name || '—'}</TableCell>
                      <TableCell className="font-mono text-xs">{truncate(r.record_id, 18)}</TableCell>
                      <TableCell className="font-mono text-xs">{truncate(r.user_id, 18)}</TableCell>
                      <TableCell className="font-mono text-xs">{r.ip_address || '—'}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {(rows.length > 0 || page > 0) && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Page {page + 1}{hasMore ? '' : ' · end'}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0 || loading} onClick={() => setPage((p) => Math.max(0, p - 1))}>
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled={!hasMore || loading} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Detail drawer */}
      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent side="right" className="sm:max-w-2xl w-full overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Badge variant={selected ? (ACTION_VARIANT[selected.action || ''] || 'outline') : 'outline'}>
                {selected?.action || '—'}
              </Badge>
              {selected?.object_name || 'Audit Event'}
            </SheetTitle>
            <SheetDescription>
              {selected?.id ? <span className="font-mono text-xs">{selected.id}</span> : null}
            </SheetDescription>
          </SheetHeader>

          {selected && (
            <div className="mt-6 space-y-5">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground">Timestamp</div>
                  <div className="font-mono">{formatDate(selected.created_at)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">IP Address</div>
                  <div className="font-mono">{selected.ip_address || '—'}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Actor (user_id)</div>
                  <div className="font-mono break-all">{selected.user_id || '—'}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Tenant</div>
                  <div className="font-mono break-all">{selected.tenant_id || '—'}</div>
                </div>
                <div className="col-span-2">
                  <div className="text-xs text-muted-foreground">Target record</div>
                  <div className="font-mono text-sm break-all">
                    {selected.object_name || '—'} / {selected.record_id || '—'}
                  </div>
                </div>
                {selected.user_agent && (
                  <div className="col-span-2">
                    <div className="text-xs text-muted-foreground">User Agent</div>
                    <div className="font-mono text-xs break-all">{selected.user_agent}</div>
                  </div>
                )}
              </div>

              {(selected.old_value || selected.new_value) && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <div className="text-sm font-medium">Change payload</div>
                    {selected.old_value && (
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Before</div>
                        <pre className="rounded-md bg-muted p-3 text-xs font-mono whitespace-pre-wrap max-h-64 overflow-auto">
                          {tryPrettyJson(selected.old_value)}
                        </pre>
                      </div>
                    )}
                    {selected.new_value && (
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">After</div>
                        <pre className="rounded-md bg-muted p-3 text-xs font-mono whitespace-pre-wrap max-h-64 overflow-auto">
                          {tryPrettyJson(selected.new_value)}
                        </pre>
                      </div>
                    )}
                  </div>
                </>
              )}

              {selected.metadata && (
                <>
                  <Separator />
                  <div>
                    <div className="text-sm font-medium mb-2">Metadata</div>
                    <pre className="rounded-md bg-muted p-3 text-xs font-mono whitespace-pre-wrap max-h-48 overflow-auto">
                      {tryPrettyJson(selected.metadata)}
                    </pre>
                  </div>
                </>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
