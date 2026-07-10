// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * AccessExplainPanel — "why can this user access?" (ADR-0090 D6).
 *
 * Right-side sheet in the Studio Access pillar that asks the backend explain
 * engine (`GET/POST /api/v1/security/explain`) why a principal can — or cannot
 * — perform an operation on an object, and renders the `ExplainDecision`
 * trace: the resolved principal (position → permission-set binding chain) and
 * the nine evaluation-pipeline layers with their verdicts (required
 * capabilities, object CRUD, FLS, OWD baseline, depth, sharing, VAMA bypass,
 * RLS). The report is produced by the SAME code paths enforcement runs, so
 * what this panel shows is what the middleware does.
 *
 * Explaining ANOTHER user is authorized server-side: `manage_users` or a
 * delegated adminScope covering that user (D12) — a 403 here renders as a
 * friendly localized message, not a raw error.
 */

import * as React from 'react';
import {
  Badge,
  Button,
  Input,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@object-ui/components';
import { RecordPickerDialog } from '@object-ui/fields';
import { useAdapter } from '@object-ui/react';
import { createAuthenticatedFetch } from '@object-ui/auth';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronsUpDown,
  HelpCircle,
  Loader2,
  ShieldQuestion,
  User as UserIcon,
  X,
  XCircle,
} from 'lucide-react';
import { t, tFormat, useMetadataLocale } from './i18n';

/** Mirrors `ExplainOperationSchema` in `@objectstack/spec/security`. */
const OPERATIONS = ['read', 'create', 'update', 'delete', 'transfer', 'restore', 'purge'] as const;
type ExplainOperation = (typeof OPERATIONS)[number];

/** Mirrors `ExplainDecisionSchema` in `@objectstack/spec/security` (ADR-0090 D6). */
export interface ExplainLayer {
  layer:
    | 'principal'
    | 'required_permissions'
    | 'object_crud'
    | 'fls'
    | 'owd_baseline'
    | 'depth'
    | 'sharing'
    | 'vama_bypass'
    | 'rls';
  verdict: 'grants' | 'denies' | 'narrows' | 'widens' | 'neutral' | 'not_applicable';
  detail: string;
  contributors?: Array<{ kind: 'permission_set' | 'position' | 'system'; name: string; via?: string }>;
}
export interface ExplainDecision {
  allowed: boolean;
  object: string;
  operation: ExplainOperation;
  principal: {
    userId: string | null;
    positions?: string[];
    permissionSets?: string[];
    principalKind?: string;
    onBehalfOf?: { userId: string };
  };
  layers: ExplainLayer[];
  readFilter?: unknown;
}

const VERDICT_BADGE: Record<ExplainLayer['verdict'], string> = {
  grants: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  denies: 'border-destructive/40 bg-destructive/10 text-destructive',
  narrows: 'border-amber-400/50 bg-amber-400/10 text-amber-700 dark:text-amber-300',
  widens: 'border-sky-400/50 bg-sky-400/10 text-sky-700 dark:text-sky-300',
  neutral: 'border-border bg-muted/40 text-muted-foreground',
  not_applicable: 'border-border bg-transparent text-muted-foreground/60',
};

const personLabel = (u: unknown): string => {
  const r = (u ?? {}) as Record<string, unknown>;
  return String(r.full_name || r.name || r.display_name || r.email || r.id || '');
};

export interface AccessExplainPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Optional prefill for the object input (e.g. from the matrix). */
  defaultObject?: string;
}

export function AccessExplainPanel({ open, onOpenChange, defaultObject }: AccessExplainPanelProps): React.ReactElement {
  const locale = useMetadataLocale();
  const adapter = useAdapter() as any;
  const authFetch = React.useMemo(() => createAuthenticatedFetch(), []);

  const [objectName, setObjectName] = React.useState(defaultObject ?? '');
  const [operation, setOperation] = React.useState<ExplainOperation>('read');
  const [user, setUser] = React.useState<{ id: string; label: string } | null>(null);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [decision, setDecision] = React.useState<ExplainDecision | null>(null);

  React.useEffect(() => {
    if (defaultObject) setObjectName((v) => v || defaultObject);
  }, [defaultObject]);

  const run = React.useCallback(async () => {
    const object = objectName.trim();
    if (!object) return;
    setBusy(true);
    setError(null);
    setDecision(null);
    try {
      // Split SPA + backend dev: promote `/api/...` to the backend origin so
      // the request (and its auth cookie) reaches :3000 — same convention as
      // MetadataTypeActions.
      const apiBase = ((import.meta as { env?: Record<string, string> }).env?.VITE_SERVER_URL || '').replace(/\/+$/, '');
      const res = await authFetch(`${apiBase}/api/v1/security/explain`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ object, operation, ...(user ? { userId: user.id } : {}) }),
      });
      let data: Record<string, unknown> | null = null;
      try {
        data = (await res.json()) as Record<string, unknown>;
      } catch {
        /* non-JSON body — fall through to the status check */
      }
      if (res.status === 403) {
        setError(t('engine.studio.access.explain.forbidden', locale));
        return;
      }
      if (!res.ok) {
        const detail =
          (data?.message as string) || (data?.error as string) || `HTTP ${res.status} ${res.statusText}`.trim();
        setError(detail);
        return;
      }
      setDecision(data as unknown as ExplainDecision);
    } catch (err) {
      setError((err as Error)?.message ?? String(err));
    } finally {
      setBusy(false);
    }
  }, [authFetch, objectName, operation, user, locale]);

  const opLabel = (op: string) => t(`engine.studio.access.explain.op.${op}`, locale);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ShieldQuestion className="h-4 w-4" /> {t('engine.studio.access.explain.title', locale)}
          </SheetTitle>
          <SheetDescription>{t('engine.studio.access.explain.description', locale)}</SheetDescription>
        </SheetHeader>

        {/* ── request form ── */}
        <div className="mt-4 space-y-3 text-sm">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              {t('engine.studio.access.explain.user', locale)}
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-md border bg-background px-2 text-left text-xs hover:bg-muted/60"
              >
                <UserIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">
                  {user ? user.label : t('engine.studio.access.explain.self', locale)}
                </span>
                {/* objectui#2381 — the picker was here all along but the button
                    read as static text; the chevron makes "pick another user"
                    discoverable. */}
                <ChevronsUpDown className="h-3 w-3 shrink-0 text-muted-foreground/70" />
              </button>
              {user && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 shrink-0 p-0 text-muted-foreground"
                  onClick={() => setUser(null)}
                  aria-label={t('engine.studio.access.explain.clearUser', locale)}
                  title={t('engine.studio.access.explain.clearUser', locale)}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <div className="min-w-0 flex-1 space-y-1">
              <label htmlFor="explain-object" className="text-xs font-medium text-muted-foreground">
                {t('engine.studio.access.explain.object', locale)}
              </label>
              <Input
                id="explain-object"
                value={objectName}
                onChange={(e) => setObjectName(e.target.value)}
                placeholder={t('engine.studio.access.explain.objectPlaceholder', locale)}
                className="h-8 text-xs"
              />
            </div>
            <div className="w-32 shrink-0 space-y-1">
              <label htmlFor="explain-operation" className="text-xs font-medium text-muted-foreground">
                {t('engine.studio.access.explain.operation', locale)}
              </label>
              <select
                id="explain-operation"
                value={operation}
                onChange={(e) => setOperation(e.target.value as ExplainOperation)}
                className="h-8 w-full rounded-md border bg-background px-2 text-xs outline-none focus:ring-1 focus:ring-primary"
              >
                {OPERATIONS.map((op) => (
                  <option key={op} value={op}>
                    {opLabel(op)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <Button size="sm" className="h-8 gap-1.5 text-xs" disabled={busy || !objectName.trim()} onClick={() => void run()}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <HelpCircle className="h-3.5 w-3.5" />}
            {busy ? t('engine.studio.access.explain.running', locale) : t('engine.studio.access.explain.run', locale)}
          </Button>
        </div>

        {/* ── result ── */}
        <div className="mt-5 space-y-4 text-sm">
          {error && !busy && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive"
            >
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                <span className="font-medium">{t('engine.studio.access.explain.failed', locale)}</span> — {error}
              </span>
            </div>
          )}

          {!decision && !error && !busy && (
            <p className="text-xs text-muted-foreground">{t('engine.studio.access.explain.empty', locale)}</p>
          )}

          {decision && !busy && (
            <>
              {/* verdict banner */}
              <div
                data-testid="explain-verdict"
                className={
                  decision.allowed
                    ? 'flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-emerald-700 dark:text-emerald-400'
                    : 'flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-destructive'
                }
              >
                {decision.allowed ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <XCircle className="h-4 w-4 shrink-0" />}
                <span className="text-xs font-medium">
                  {tFormat(
                    decision.allowed ? 'engine.studio.access.explain.allowedLine' : 'engine.studio.access.explain.deniedLine',
                    locale,
                    { operation: opLabel(decision.operation), object: decision.object },
                  )}
                </span>
              </div>

              {/* principal: position → permission-set chain */}
              <div className="rounded-md border bg-muted/30 p-3">
                <p className="text-[11px] font-medium text-muted-foreground">
                  {t('engine.studio.access.explain.principal', locale)}
                </p>
                <p className="mt-1 truncate font-mono text-xs text-foreground">
                  {decision.principal.userId ?? '(anonymous)'}
                  {decision.principal.onBehalfOf?.userId ? ` ⇄ ${decision.principal.onBehalfOf.userId}` : ''}
                </p>
                <div className="mt-2 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="text-[11px] text-muted-foreground">
                      {t('engine.studio.access.explain.positions', locale)}:
                    </span>
                    {(decision.principal.positions ?? []).map((p) => (
                      <Badge key={p} variant="outline" className="px-1.5 py-0 text-[10px] font-normal">
                        {p}
                      </Badge>
                    ))}
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="text-[11px] text-muted-foreground">
                      {t('engine.studio.access.explain.permissionSets', locale)}:
                    </span>
                    {(decision.principal.permissionSets ?? []).map((p) => (
                      <Badge key={p} variant="secondary" className="px-1.5 py-0 text-[10px] font-normal">
                        {p}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>

              {/* the nine pipeline layers */}
              <div>
                <p className="mb-2 text-[11px] font-medium text-muted-foreground">
                  {t('engine.studio.access.explain.layers', locale)}
                </p>
                <ol className="space-y-2">
                  {decision.layers.map((l) => (
                    <li key={l.layer} className="rounded-md border p-2.5" data-testid={`explain-layer-${l.layer}`}>
                      <div className="flex items-center gap-2">
                        <span className="min-w-0 flex-1 truncate text-xs font-medium">
                          {t(`engine.studio.access.explain.layer.${l.layer}`, locale)}
                        </span>
                        <span
                          className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] leading-none ${VERDICT_BADGE[l.verdict] ?? VERDICT_BADGE.neutral}`}
                        >
                          {t(`engine.studio.access.explain.verdict.${l.verdict}`, locale)}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{l.detail}</p>
                      {(l.contributors ?? []).length > 0 && (
                        <div className="mt-1.5 flex flex-wrap items-center gap-1">
                          <span className="text-[10px] text-muted-foreground/70">
                            {t('engine.studio.access.explain.contributors', locale)}:
                          </span>
                          {(l.contributors ?? []).map((c, i) => (
                            <Badge
                              key={`${c.kind}:${c.name}:${i}`}
                              variant={c.kind === 'position' ? 'outline' : 'secondary'}
                              className="px-1.5 py-0 text-[10px] font-normal"
                              title={c.via ? `${c.kind} · via ${c.via}` : c.kind}
                            >
                              {c.name}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </li>
                  ))}
                </ol>
              </div>

              {/* machine artifact — the composed read filter */}
              {decision.operation === 'read' && decision.readFilter !== undefined && (
                <div>
                  <p className="mb-1 text-[11px] font-medium text-muted-foreground">
                    {t('engine.studio.access.explain.readFilter', locale)}
                  </p>
                  <pre className="overflow-x-auto rounded-md border bg-muted/30 p-2 font-mono text-[11px] leading-snug">
                    {JSON.stringify(decision.readFilter, null, 2)}
                  </pre>
                </div>
              )}
            </>
          )}
        </div>

        <RecordPickerDialog
          open={pickerOpen}
          onOpenChange={(o: boolean) => setPickerOpen(o)}
          dataSource={adapter}
          objectName="sys_user"
          title={t('engine.studio.access.explain.pickUserTitle', locale)}
          onSelect={() => {}}
          onSelectRecords={(records: any[]) => {
            const u = records?.[0];
            if (u?.id != null) setUser({ id: String(u.id), label: personLabel(u) });
            setPickerOpen(false);
          }}
        />
      </SheetContent>
    </Sheet>
  );
}

export default AccessExplainPanel;
