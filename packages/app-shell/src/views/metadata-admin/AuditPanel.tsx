// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * AuditPanel — ADR-0010 §3.6 / Phase 4.1 protection-audit trail.
 *
 * Renders the rows in `sys_metadata_audit` for a single metadata
 * item (type + name): every save/publish/rollback/delete/reset
 * attempt, with the lock state at the moment of the call and the
 * decision (`allowed` / `denied` / `forced`). This is the compliance
 * surface promised by the metadata-protection ADR — denied attempts
 * never reach the regular history log, so this is the only place
 * where blocked writes are visible.
 *
 * Data source: `client.audit(type, name)` →
 *   `GET /api/v1/meta/:type/:name/audit`.
 *
 * Empty state is friendly: a fresh install has no rows because the
 * audit writer only fires on actual write attempts, so "no events"
 * just means nobody has tried to change this item.
 */

import * as React from 'react';
import { RefreshCw, Loader2, ShieldCheck, ShieldAlert, ShieldX } from 'lucide-react';
import { Button } from '@object-ui/components';
import { Badge } from '@object-ui/components';
import { Empty, EmptyTitle, EmptyDescription } from '@object-ui/components';
import type {
  MetadataClient,
  MetadataAuditEntry,
} from '@object-ui/data-objectstack';
import { t, translateConsoleValue, type SupportedLocale } from './i18n';

export interface AuditPanelProps {
  type: string;
  name: string;
  client: MetadataClient;
  locale?: SupportedLocale | string;
}

function fmtTime(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function outcomeBadge(outcome: MetadataAuditEntry['outcome'], locale?: SupportedLocale | string) {
  const map: Record<MetadataAuditEntry['outcome'], {
    label: string;
    cls: string;
    Icon: React.ComponentType<{ className?: string }>;
  }> = {
    allowed: {
      label: 'allowed',
      cls: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      Icon: ShieldCheck,
    },
    denied: {
      label: 'denied',
      cls: 'bg-rose-50 text-rose-700 border-rose-200',
      Icon: ShieldX,
    },
    forced: {
      label: 'forced',
      cls: 'bg-amber-50 text-amber-700 border-amber-200',
      Icon: ShieldAlert,
    },
  };
  const v = map[outcome] ?? map.allowed;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${v.cls}`}
    >
      <v.Icon className="h-3 w-3" />
      {translateConsoleValue('outcome', v.label, locale)}
    </span>
  );
}

export function AuditPanel({
  type,
  name,
  client,
  locale = 'en-US',
}: AuditPanelProps) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [events, setEvents] = React.useState<MetadataAuditEntry[] | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await client.audit(type, name, { limit: 100 });
      setEvents(res.events ?? []);
    } catch (err: any) {
      setError(String(err?.message ?? err));
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [client, type, name]);

  React.useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-1 pb-2">
        <div className="text-xs text-muted-foreground">
          {events?.length ?? 0} {t('engine.edit.auditCount', locale)}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void load()}
          disabled={loading}
          className="h-7 gap-1 text-xs"
          title={t('engine.edit.refresh', locale)}
        >
          {loading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3" />
          )}
          {t('engine.edit.refresh', locale)}
        </Button>
      </div>

      {error && (
        <div className="m-2 rounded border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700">
          {error}
        </div>
      )}

      <div className="flex-1 overflow-auto">
        {loading && (!events || events.length === 0) ? (
          <div className="flex h-32 items-center justify-center text-xs text-muted-foreground">
            <Loader2 className="mr-2 h-3 w-3 animate-spin" />
            {t('engine.edit.loading', locale)}
          </div>
        ) : !events || events.length === 0 ? (
          <Empty className="py-10">
            <EmptyTitle>{t('engine.edit.auditEmptyTitle', locale)}</EmptyTitle>
            <EmptyDescription>
              {t('engine.edit.auditEmptyDescription', locale)}
            </EmptyDescription>
          </Empty>
        ) : (
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-muted/40 text-left text-[10px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-2 py-1.5 font-medium">
                  {t('engine.edit.auditColTime', locale)}
                </th>
                <th className="px-2 py-1.5 font-medium">
                  {t('engine.edit.auditColActor', locale)}
                </th>
                <th className="px-2 py-1.5 font-medium">
                  {t('engine.edit.auditColOperation', locale)}
                </th>
                <th className="px-2 py-1.5 font-medium">
                  {t('engine.edit.auditColOutcome', locale)}
                </th>
                <th className="px-2 py-1.5 font-medium">
                  {t('engine.edit.auditColLock', locale)}
                </th>
                <th className="px-2 py-1.5 font-medium">
                  {t('engine.edit.auditColNote', locale)}
                </th>
              </tr>
            </thead>
            <tbody>
              {events.map((ev) => (
                <tr
                  key={String(ev.id)}
                  className="border-t border-border/50 align-top hover:bg-muted/20"
                >
                  <td className="whitespace-nowrap px-2 py-1.5 font-mono text-[11px]">
                    {fmtTime(ev.occurredAt)}
                  </td>
                  <td className="px-2 py-1.5">{ev.actor}</td>
                  <td className="px-2 py-1.5">
                    <Badge variant="outline" className="text-[10px]">
                      {translateConsoleValue('op', ev.operation, locale)}
                    </Badge>
                  </td>
                  <td className="px-2 py-1.5">{outcomeBadge(ev.outcome, locale)}</td>
                  <td className="px-2 py-1.5">
                    {ev.lockState && ev.lockState !== 'none' ? (
                      <span className="font-mono text-[11px]">
                        {translateConsoleValue('lock', ev.lockState, locale)}
                        {ev.lockOverridden ? ' *' : ''}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td
                    className="max-w-[28ch] truncate px-2 py-1.5 text-muted-foreground"
                    title={ev.note ?? ev.code}
                  >
                    {ev.note ?? ev.code}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
