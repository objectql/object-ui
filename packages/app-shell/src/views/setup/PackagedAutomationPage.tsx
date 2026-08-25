// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * PackagedAutomationPage — Setup › "Packaged automation" (ADR-0126 §7.4).
 *
 * ## What this page is, and what it deliberately is not
 *
 * Automation AUTHORING lives in Studio and stays there. This page is the
 * OPERATIONAL surface for the flows a code package shipped: per packaged flow
 * it does exactly two things, and claims nothing beyond them —
 *
 *   1. **on/off for this scope** — reads the activation state the engine
 *      reports (`GET /api/v1/automation/_status`, backed by the ADR-0126 §7.2
 *      `sys_metadata_activation` ledger) and flips it through
 *      `POST /api/v1/automation/<name>/toggle`;
 *   2. **clone** — `POST /api/v1/automation/<name>/clone` with a mandatory NEW
 *      machine name and label (ADR-0126 §7.1).
 *
 * Everything else a "packaged flow" page could plausibly show is withdrawn by
 * ADR-0126 §9, and its absence is load-bearing rather than unfinished:
 *
 *   ⛔ no diff-vs-base, ⛔ no "customized" badge, ⛔ no "based on v3" /
 *   base-moved notice, ⛔ no ancestry link from a clone back to its source.
 *
 * The platform does not track that lineage, so a surface that displayed it
 * would be displaying something it had to invent. Cloned-without-disabled and
 * disabled-without-clone are ordinary states, shown plainly, not halves of an
 * unfinished ceremony. `PackagedAutomationPage.test.tsx` pins the absence of
 * the withdrawn shapes so a future "helpful" addition fails loudly.
 *
 * For the same reason this page shows no `bound` / `status` column even though
 * `_status` carries both: §7.4 scopes it to what the activation ledger knows.
 * The Studio rail is where a flow's binding is diagnosed.
 *
 * ## Server refusals reach the operator VERBATIM
 *
 * Three refusals are expected here and all three are the server's words,
 * rendered as sent — no client-side softening, shortening or re-wording:
 *
 *   - **403 `PERMISSION_DENIED`** — the ADR-0126 §5 posture gate. In a
 *     `group` / `isolated` deployment the install-wide activation row requires
 *     the platform operator; the server's message names the posture AND the
 *     sanctioned path (clone under a new name). Rewording it here would drop
 *     the half that tells the admin what to do instead.
 *   - **409 `DELETE_RESTRICTED`** — the §7.3 subflow guard, on disable only.
 *     The message NAMES the packaged callers that would break mid-run. That
 *     list is the entire value of the refusal and only the server can build it.
 *   - **409** on clone — the name is taken. The message explains why same-name
 *     clones are refused (the engine keys flows by bare name) and suggests a
 *     free name.
 *
 * `actionErrorDetail` is the one place this repo reads an ADR-0112 error
 * envelope's message; a fallback string is used ONLY when the response carried
 * no message at all, never in place of one.
 *
 * ## How this page is reached
 *
 * Through the component-registry nav contribution — the same mechanism every
 * other framework-contributed Setup surface uses (`metadata:directory`,
 * `metadata:resource`, `developer:packages` in `services/builtinComponents`).
 * The Setup app's navigation names the ref `automation:packaged`, and
 * `ComponentNavView` resolves it at
 * `/apps/<app>/component/automation/packaged`. No bespoke route is added:
 * a route would be a second way in that the app metadata does not know about.
 */

import * as React from 'react';
import { RefreshCw } from 'lucide-react';
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Empty,
  EmptyDescription,
  EmptyTitle,
  Input,
  Label,
  Skeleton,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@object-ui/components';
import { useObjectTranslation } from '@object-ui/i18n';
import { actionErrorDetail } from '@object-ui/core';

// The LEAF module, not `previews/useFlowNodePalette.js` which re-exports it:
// this page is imported eagerly by `services/builtinComponents`, so anything
// in its graph joins the console's eager closure — and that module's scope
// reaches the whole flow-designer canvas.
import { apiBase } from '../../utils/apiBase.js';
import {
  envelopeData,
  envelopeRefused,
  joinPackagedFlows,
  readMetadataItems,
  readRuntimeStates,
  type FlowRuntimeStateRow,
  type PackagedFlowRow,
} from './packagedFlows.js';

/* -------------------------------------------------------------------------- */
/* Fetch helpers                                                               */
/* -------------------------------------------------------------------------- */

const JSON_HEADERS = { Accept: 'application/json' } as const;

async function readJson(res: Response): Promise<unknown> {
  return res.json().catch(() => null);
}

/**
 * The engine's runtime states. `payload.data.flows ?? payload.flows` is how
 * this repo already reads this exact endpoint (`StudioDesignSurface`); the two
 * shapes are the wrapped and bare forms of one response, not two dialects.
 */
async function fetchRuntimeStates(signal: AbortSignal): Promise<FlowRuntimeStateRow[]> {
  const res = await fetch(`${apiBase()}/automation/_status`, {
    credentials: 'include',
    headers: JSON_HEADERS,
    cache: 'no-store',
    signal,
  });
  if (!res.ok) throw new Error(`automation status HTTP ${res.status}`);
  return readRuntimeStates(await readJson(res));
}

/** The `flow` metadata list — bare array or `{ items }`, as this route answers. */
async function fetchFlowMetadata(signal: AbortSignal): Promise<unknown[]> {
  const res = await fetch(`${apiBase()}/meta/flow`, {
    credentials: 'include',
    headers: JSON_HEADERS,
    cache: 'no-store',
    signal,
  });
  if (!res.ok) throw new Error(`flow metadata HTTP ${res.status}`);
  return readMetadataItems(await readJson(res));
}

/* -------------------------------------------------------------------------- */
/* Clone dialog state                                                          */
/* -------------------------------------------------------------------------- */

interface CloneDraft {
  /** Machine name of the flow being copied. */
  source: string;
  /** New machine name — mandatory (ADR-0126 §7.1). */
  name: string;
  /** New display name — mandatory. */
  label: string;
  /** The server's refusal, verbatim. */
  refusal: string | null;
  busy: boolean;
}

/* -------------------------------------------------------------------------- */
/* Page                                                                        */
/* -------------------------------------------------------------------------- */

export function PackagedAutomationPage() {
  const { t } = useObjectTranslation();

  const [rows, setRows] = React.useState<PackagedFlowRow[] | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [nonce, setNonce] = React.useState(0);
  /** Machine name of the flow whose toggle is in flight. */
  const [busyFlow, setBusyFlow] = React.useState<string | null>(null);
  /** Per-flow server refusal, keyed by machine name. Verbatim. */
  const [refusals, setRefusals] = React.useState<Record<string, string>>({});
  const [clone, setClone] = React.useState<CloneDraft | null>(null);
  /** The server's post-clone notice, verbatim, plus the name it created. */
  const [cloneResult, setCloneResult] = React.useState<{ name: string; notice: string } | null>(null);

  React.useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    setLoadError(null);
    (async () => {
      try {
        const [runtime, meta] = await Promise.all([
          fetchRuntimeStates(controller.signal),
          fetchFlowMetadata(controller.signal),
        ]);
        if (cancelled) return;
        setRows(joinPackagedFlows(runtime, meta));
      } catch (e) {
        if (cancelled || controller.signal.aborted) return;
        setRows([]);
        setLoadError(
          e instanceof Error && e.message
            ? e.message
            : t('packagedAutomation.loadFailed', { defaultValue: 'Could not load packaged automation.' }),
        );
      }
    })();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [nonce, t]);

  const clearRefusal = React.useCallback((name: string) => {
    setRefusals((prev) => {
      if (!(name in prev)) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  }, []);

  async function onToggle(row: PackagedFlowRow, enabled: boolean) {
    setBusyFlow(row.name);
    clearRefusal(row.name);
    setCloneResult(null);
    try {
      const res = await fetch(`${apiBase()}/automation/${encodeURIComponent(row.name)}/toggle`, {
        method: 'POST',
        credentials: 'include',
        headers: { ...JSON_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
      const json = await readJson(res);
      if (!res.ok || envelopeRefused(json)) {
        // VERBATIM. The posture gate (403) and the subflow guard (409) both
        // carry the whole of what the admin needs in this string — the second
        // one names the callers, which nothing on the client could reconstruct.
        setRefusals((prev) => ({
          ...prev,
          [row.name]: actionErrorDetail(
            json,
            // A SEPARATE key from the catch arm's below: this one has a status
            // to name and that one does not, and one key cannot carry a hole
            // only half its call sites can fill.
            t('packagedAutomation.toggleFailedHttp', {
              defaultValue: 'Could not change activation (HTTP {{status}}).',
              status: res.status,
            }),
          ),
        }));
        return;
      }
      const reported = envelopeData(json).enabled;
      const next = typeof reported === 'boolean' ? reported : enabled;
      setRows((prev) => prev?.map((r) => (r.name === row.name ? { ...r, enabled: next } : r)) ?? prev);
    } catch (e) {
      setRefusals((prev) => ({
        ...prev,
        [row.name]:
          e instanceof Error && e.message
            ? e.message
            : t('packagedAutomation.toggleFailed', { defaultValue: 'Could not change activation.' }),
      }));
    } finally {
      setBusyFlow(null);
    }
  }

  async function onCloneSubmit(draft: CloneDraft) {
    setClone({ ...draft, busy: true, refusal: null });
    try {
      const res = await fetch(`${apiBase()}/automation/${encodeURIComponent(draft.source)}/clone`, {
        method: 'POST',
        credentials: 'include',
        headers: { ...JSON_HEADERS, 'Content-Type': 'application/json' },
        // ⛔ EXACTLY the two keys the clone body declares. The carried-over
        // definition (nodes, triggers, connectors) is NOT offered as editable
        // form fields: a clone copies the whole definition and the copy is
        // edited in Studio afterwards, like any other flow.
        body: JSON.stringify({ name: draft.name.trim(), label: draft.label.trim() }),
      });
      const json = await readJson(res);
      if (!res.ok || envelopeRefused(json)) {
        setClone({
          ...draft,
          busy: false,
          refusal: actionErrorDetail(
            json,
            // Separate key from the catch arm's below, for the same reason as
            // the toggle pair: a status hole only one of the two can fill.
            t('packagedAutomation.cloneFailedHttp', {
              defaultValue: 'Could not clone this flow (HTTP {{status}}).',
              status: res.status,
            }),
          ),
        });
        return;
      }
      const data = envelopeData(json);
      const created = (data.flow as { name?: unknown } | undefined)?.name;
      const notice = data.notice;
      setClone(null);
      setCloneResult({
        name: typeof created === 'string' && created ? created : draft.name.trim(),
        notice: typeof notice === 'string' ? notice : '',
      });
      // The clone is a tenant artifact, so it does NOT join this packaged
      // list. Refetch anyway: the source flow's own state is re-read, and a
      // stale list is the one thing an operational page must not show.
      setNonce((n) => n + 1);
    } catch (e) {
      setClone({
        ...draft,
        busy: false,
        refusal:
          e instanceof Error && e.message
            ? e.message
            : t('packagedAutomation.cloneFailed', { defaultValue: 'Could not clone this flow.' }),
      });
    }
  }

  const title = t('packagedAutomation.title', { defaultValue: 'Packaged automation' });
  const cloneNameValid = !!clone && clone.name.trim() !== '' && clone.label.trim() !== '';

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">{title}</h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            {t('packagedAutomation.subtitle', {
              defaultValue:
                'Flows shipped by installed packages. Turn one off for this deployment, or clone it under a new name to customize it. Editing happens in Studio.',
            })}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setNonce((n) => n + 1)}
          aria-label={t('packagedAutomation.refresh', { defaultValue: 'Refresh' })}
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {cloneResult && (
        <div role="status" className="rounded-md border border-border bg-muted/40 p-3 text-sm space-y-1">
          <p className="font-medium">
            {t('packagedAutomation.cloneCreated', {
              // `{{name}}`, not a JS template literal: the inline default must
              // be the SAME string the pack carries, so a provider-less render
              // and a translated one cannot drift apart.
              defaultValue: 'Created flow "{{name}}".',
              name: cloneResult.name,
            })}
          </p>
          {/* The server's own post-clone notice, verbatim. */}
          {cloneResult.notice && <p className="text-muted-foreground">{cloneResult.notice}</p>}
        </div>
      )}

      {loadError && (
        <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
          {loadError}
        </div>
      )}

      {rows === null && (
        <div className="space-y-2" data-testid="packaged-automation-loading">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      )}

      {rows !== null && rows.length === 0 && !loadError && (
        <Empty>
          <EmptyTitle>
            {t('packagedAutomation.emptyTitle', { defaultValue: 'No packaged flows' })}
          </EmptyTitle>
          <EmptyDescription>
            {t('packagedAutomation.emptyBody', {
              defaultValue:
                'No installed package ships an automation flow on this deployment. Flows you author yourself live in Studio.',
            })}
          </EmptyDescription>
        </Empty>
      )}

      {rows !== null && rows.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('packagedAutomation.colFlow', { defaultValue: 'Flow' })}</TableHead>
              <TableHead className="w-[220px]">
                {t('packagedAutomation.colActivation', { defaultValue: 'Activation' })}
              </TableHead>
              <TableHead className="w-[140px] text-right">
                {t('packagedAutomation.colActions', { defaultValue: 'Actions' })}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const refusal = refusals[row.name];
              return (
                <TableRow key={row.name} data-testid={`packaged-flow-${row.name}`}>
                  <TableCell className="align-top">
                    <div className="font-medium">{row.label}</div>
                    <code className="font-mono text-xs text-muted-foreground">{row.name}</code>
                    {refusal && (
                      // VERBATIM server refusal, next to the control that
                      // caused it. `role="alert"` so it is announced.
                      <p role="alert" className="mt-2 text-sm text-destructive">
                        {refusal}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="align-top">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={row.enabled}
                        disabled={busyFlow === row.name}
                        onCheckedChange={(next: boolean) => void onToggle(row, next)}
                        aria-label={t('packagedAutomation.toggleLabel', {
                          defaultValue: 'Activation for {{label}}',
                          label: row.label,
                        })}
                      />
                      <Badge variant={row.enabled ? 'default' : 'secondary'}>
                        {row.enabled
                          ? t('packagedAutomation.on', { defaultValue: 'On' })
                          : t('packagedAutomation.off', { defaultValue: 'Off' })}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="align-top text-right">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setClone({ source: row.name, name: '', label: '', refusal: null, busy: false })
                      }
                    >
                      {t('packagedAutomation.clone', { defaultValue: 'Clone' })}
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      <Dialog open={!!clone} onOpenChange={(open: boolean) => !open && setClone(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t('packagedAutomation.cloneTitle', { defaultValue: 'Clone packaged flow' })}
            </DialogTitle>
            <DialogDescription>
              {t('packagedAutomation.cloneBody', {
                defaultValue:
                  'The copy carries the whole definition and takes a new machine name and label. Edit the copy in Studio.',
              })}
            </DialogDescription>
          </DialogHeader>

          {clone && (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="packaged-clone-name">
                  {t('packagedAutomation.cloneName', { defaultValue: 'New machine name' })}
                </Label>
                <Input
                  id="packaged-clone-name"
                  value={clone.name}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setClone({ ...clone, name: e.target.value, refusal: null })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="packaged-clone-label">
                  {t('packagedAutomation.cloneLabel', { defaultValue: 'New label' })}
                </Label>
                <Input
                  id="packaged-clone-label"
                  value={clone.label}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setClone({ ...clone, label: e.target.value, refusal: null })
                  }
                />
              </div>
              {clone.refusal && (
                <p role="alert" className="text-sm text-destructive">
                  {clone.refusal}
                </p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setClone(null)}>
              {t('packagedAutomation.cancel', { defaultValue: 'Cancel' })}
            </Button>
            <Button
              type="button"
              disabled={!cloneNameValid || !!clone?.busy}
              onClick={() => clone && void onCloneSubmit(clone)}
            >
              {t('packagedAutomation.cloneConfirm', { defaultValue: 'Create clone' })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default PackagedAutomationPage;
