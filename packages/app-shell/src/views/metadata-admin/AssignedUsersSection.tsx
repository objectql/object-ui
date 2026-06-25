/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * AssignedUsersSection — "Manage Assignments" for a permission set.
 *
 * The admin's mental model is "who holds this role / AI seat" — so this is a
 * people-first list (name + email + remove), not a raw junction table. It reads
 * `sys_user_permission_set` for the set, resolves each `user_id` to a real
 * person, and uses the reusable `RecordPickerDialog` to assign more. Server-side
 * rules on the junction insert (e.g. the AI-seat cap) are caught and shown as a
 * friendly, localized inline message — not a raw developer error.
 *
 * Permission-set-agnostic: every role gets the same UI, and the AI seat
 * (`ai_seat`) is just one of them. The generic add-by-picker engine (spec
 * RecordRelatedListProps.add) powers the capability; this is the polished
 * surface for the high-value case.
 */

import * as React from 'react';
import { Button } from '@object-ui/components';
import { RecordPickerDialog } from '@object-ui/fields';
import { useAdapter } from '@object-ui/react';
import { Plus, X, Users, Loader2, AlertCircle } from 'lucide-react';
import { detectLocale } from './i18n';

export interface AssignedUsersSectionProps {
  /** The permission set's machine name (e.g. `ai_seat`, `admin_full_access`). */
  permissionSetName: string;
}

interface AssignedRow {
  grantId: string;
  userId: string;
  name: string;
  email: string;
}

/** Minimal locale-aware copy (zh vs everything-else) — keeps the surface in the user's language. */
function useCopy() {
  const zh = React.useMemo(() => detectLocale().toLowerCase().startsWith('zh'), []);
  return React.useMemo(
    () =>
      zh
        ? {
            title: '已分配用户',
            add: '添加用户',
            remove: '移除',
            empty: '还没有分配任何用户。点击「添加用户」来分配。',
            loading: '加载中…',
            pickTitle: '选择要分配的用户',
            seatFull: (n: number) =>
              'AI 席位已用完(' + n + '/' + n + ')。请先移除一个用户,或在许可证中提升席位上限,再分配新用户。',
            addFailed: '分配失败,请重试。',
            countOf: (n: number) => n + ' 人',
          }
        : {
            title: 'Assigned Users',
            add: 'Add user',
            remove: 'Remove',
            empty: 'No users assigned yet. Click "Add user" to assign.',
            loading: 'Loading…',
            pickTitle: 'Select users to assign',
            seatFull: (n: number) =>
              'All ' + n + ' AI seat(s) are in use. Remove a user or raise the license cap before assigning another.',
            addFailed: 'Failed to assign. Please try again.',
            countOf: (n: number) => String(n),
          },
    [zh],
  );
}

const asArray = (res: any): any[] =>
  Array.isArray(res) ? res : res?.records ?? res?.items ?? res?.data ?? [];

const personLabel = (u: any): string =>
  u?.full_name || u?.name || u?.display_name || u?.email || String(u?.id ?? '');

export function AssignedUsersSection({ permissionSetName }: AssignedUsersSectionProps) {
  const adapter = useAdapter() as any;
  const c = useCopy();

  const [setId, setSetId] = React.useState<string | null>(null);
  const [rows, setRows] = React.useState<AssignedRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const sets = asArray(
        await adapter.find('sys_permission_set', { $filter: { name: permissionSetName }, limit: 1 }),
      );
      const id = sets[0]?.id ? String(sets[0].id) : null;
      setSetId(id);
      if (!id) {
        setRows([]);
        return;
      }
      const grants = asArray(
        await adapter.find('sys_user_permission_set', { $filter: { permission_set_id: id }, $top: 500 }),
      );
      const userIds = [...new Set(grants.map((g: any) => g.user_id).filter(Boolean).map(String))];
      const users = userIds.length
        ? asArray(await adapter.find('sys_user', { $filter: { id: { $in: userIds } }, $top: 500 }))
        : [];
      const byId = new Map(users.map((u: any) => [String(u.id), u]));
      setRows(
        grants
          .filter((g: any) => g.user_id)
          .map((g: any) => {
            const u = byId.get(String(g.user_id));
            return {
              grantId: String(g.id),
              userId: String(g.user_id),
              name: u ? personLabel(u) : String(g.user_id),
              email: u?.email ?? '',
            };
          }),
      );
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [adapter, permissionSetName]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const assignedIds = React.useMemo(() => new Set(rows.map((r) => r.userId)), [rows]);

  const addUsers = React.useCallback(
    async (records: any[]) => {
      if (!setId) return;
      setBusy(true);
      setError(null);
      try {
        for (const u of records || []) {
          const uid = u?.id != null ? String(u.id) : null;
          if (!uid || assignedIds.has(uid)) continue;
          await adapter.create('sys_user_permission_set', { permission_set_id: setId, user_id: uid });
        }
        await load();
      } catch (err: any) {
        const raw = String(err?.body?.error ?? err?.error ?? err?.message ?? '');
        const capMatch = raw.match(/(\d+)\s*of\s*(\d+)\s*seat/i);
        if (/cap reached|seat cap|ai[-_ ]?seat/i.test(raw)) {
          setError(c.seatFull(capMatch ? Number(capMatch[2]) : rows.length));
        } else {
          const cleaned = raw.replace(/^\s*\[[^\]]*\]\s*/, '').trim();
          setError(cleaned || c.addFailed);
        }
      } finally {
        setBusy(false);
        setPickerOpen(false);
      }
    },
    [adapter, setId, assignedIds, load, rows.length, c],
  );

  const removeUser = React.useCallback(
    async (grantId: string) => {
      setError(null);
      try {
        await adapter.delete('sys_user_permission_set', grantId);
        await load();
      } catch {
        /* keep the row; a failed delete is non-destructive */
      }
    },
    [adapter, load],
  );

  return (
    <div className="px-4 py-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span>{c.title}</span>
          {!loading && (
            <span className="text-xs text-muted-foreground font-normal">{c.countOf(rows.length)}</span>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={busy || !setId}
          onClick={() => {
            setError(null);
            setPickerOpen(true);
          }}
          className="gap-1 h-8 text-xs"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          {c.add}
        </Button>
      </div>

      {error && (
        <div
          className="mb-3 flex items-start gap-2 rounded-md border border-amber-300/60 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-xs text-amber-800 dark:text-amber-200"
          role="alert"
        >
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-3">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {c.loading}
        </div>
      ) : rows.length === 0 ? (
        <div className="text-xs text-muted-foreground italic py-3">{c.empty}</div>
      ) : (
        <ul className="divide-y rounded-md border">
          {rows.map((r) => (
            <li key={r.grantId} className="flex items-center gap-3 px-3 py-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-medium shrink-0">
                {(r.name || '?').slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm truncate">{r.name}</div>
                {r.email && r.email !== r.name && (
                  <div className="text-xs text-muted-foreground truncate">{r.email}</div>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void removeUser(r.grantId)}
                aria-label={c.remove}
                title={c.remove}
                className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive shrink-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {setId && (
        <RecordPickerDialog
          open={pickerOpen}
          onOpenChange={(o: boolean) => setPickerOpen(o)}
          multiple
          dataSource={adapter}
          objectName="sys_user"
          title={c.pickTitle}
          onSelect={() => {}}
          onSelectRecords={(records: any[]) => void addUsers(records)}
        />
      )}
    </div>
  );
}

export default AssignedUsersSection;
