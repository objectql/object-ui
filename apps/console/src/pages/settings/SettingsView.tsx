/**
 * <SettingsView> — single namespace renderer.
 *
 * Fetches manifest+values from `/api/settings/:namespace`, lays them
 * out via <SettingsField>, tracks dirty state, and saves through PUT.
 * Env-locked fields are read-only and show <EnvLockBadge>.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2, ArrowLeft, RotateCcw, ShieldAlert } from 'lucide-react';
import { Button, Card, CardContent, Skeleton, Badge } from '@object-ui/components';
import { extractFieldErrors } from '@object-ui/react';
import { getIcon } from '../../utils/getIcon';
import { SettingsField } from './SettingsField';
import {
  getSettingsNamespace,
  lockedKeyOf,
  runSettingsAction,
  saveSettingsNamespace,
} from './api';
import { resolveLabel, type SettingsNamespacePayload } from './types';
import { useSettingsLabel } from './useSettingsLabel';

/**
 * Evaluate the manifest's `visible: "${data.foo === 'bar'}"`
 * expression against the live value map. Intentionally minimal — a
 * full expression engine lives in `@object-ui/core` and can be wired
 * in later via plugin.
 */
function evalVisibility(expr: string | undefined, data: Record<string, unknown>): boolean {
  if (!expr) return true;
  const trimmed = expr.trim();
  const m = trimmed.match(/^\$\{(.+)\}$/);
  if (!m) return true;
  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function('data', `with (data) { return (${m[1]}); }`);
    return Boolean(fn(data));
  } catch {
    return true;
  }
}

/** `{ ...rest }` without `key`, returned as a new object so React sees the change. */
function omitKey<T>(map: Record<string, T>, key: string): Record<string, T> {
  const { [key]: _dropped, ...rest } = map;
  return rest;
}

/**
 * A `SETTINGS_CRYPTO_UNAVAILABLE` refusal, as this view renders it
 * (objectstack#8273, PR objectstack#8396).
 *
 * The deployment has nothing able to encrypt a key the manifest declares
 * encrypted, so the write was REFUSED rather than quietly stored in the clear.
 * That is a property of the deployment, not of the value — which is why the
 * envelope locates the refusal (`details: { namespace, key }`) and never
 * carries the value itself.
 */
interface CryptoRefusal {
  /** `namespace.key` — the refused key, as located by `error.details`. */
  subject?: string;
  /**
   * The server's own sentence, carrying the operator prescription (wire
   * `SettingsServicePluginOptions.cryptoProvider`, or configure a real crypto
   * adapter). Rendered verbatim and never restated here: the server owns this
   * copy, and a second wording is how the two drift into disagreeing about how
   * to fix the deployment. Absent when the body carried no message — the
   * console renders nothing rather than inventing a prescription.
   */
  prescription?: string;
}

/**
 * Read the refusal out of the declared `error.details` slot.
 *
 * Deliberately inline rather than beside `lockedKeyOf` in `api.ts`: that helper
 * lives there because it is a dual-position COMPAT SHIM, reading the declared
 * `details.key` *and* the pre-objectstack#4224 `error.key` sibling. This code is
 * new in #8396 and has exactly one declared position, so there is no second
 * shape to reconcile and nothing for the wire-shape module to own.
 */
function cryptoRefusalOf(apiError: unknown): CryptoRefusal {
  const e = (apiError ?? {}) as {
    message?: unknown;
    details?: { namespace?: unknown; key?: unknown } | null;
  };
  const nonEmpty = (v: unknown): string | undefined =>
    typeof v === 'string' && v.length > 0 ? v : undefined;
  const details = e.details && typeof e.details === 'object' ? e.details : undefined;
  const namespace = nonEmpty(details?.namespace);
  const key = nonEmpty(details?.key);
  return {
    subject: key ? (namespace ? `${namespace}.${key}` : key) : undefined,
    prescription: nonEmpty(e.message),
  };
}

export function SettingsView() {
  const params = useParams<{ namespace?: string }>();
  const navigate = useNavigate();
  const namespace = params.namespace ?? '';

  const [payload, setPayload] = useState<SettingsNamespacePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Live edit map keyed by spec.key. Falls back to resolved value when undefined. */
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  /**
   * Per-field rejections from the last failed save, keyed by field name
   * (objectstack#4224). Empty until a save comes back `SETTINGS_VALIDATION`.
   *
   * Before #4224 the server sent this as a `Record<key, message>` hung beside
   * `error.code`, which `extractFieldErrors` could not read — so the whole
   * batch collapsed into one toast that named no field. It now arrives as the
   * declared `FieldError[]` under `error.details.fields`.
   */
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  /**
   * The last save's fail-closed crypto refusal, or null (objectui#4570).
   *
   * Unlike `fieldErrors` this deliberately does NOT clear when the key is
   * edited. A field error describes the VALUE the server saw, so typing
   * contradicts it; this describes the DEPLOYMENT's inability to encrypt, which
   * typing does not change. It clears when that claim can actually have become
   * false: a new save attempt, a save that succeeds, a discard, or a reload.
   */
  const [cryptoRefusal, setCryptoRefusal] = useState<CryptoRefusal | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const p = await getSettingsNamespace(namespace);
      setPayload(p);
      setDraft({});
      setFieldErrors({});
      setCryptoRefusal(null);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, [namespace]);

  useEffect(() => {
    if (namespace) void load();
  }, [namespace, load]);

  /** Effective live values for visibility expressions. */
  const liveValues = useMemo(() => {
    const v: Record<string, unknown> = {};
    if (!payload) return v;
    for (const [k, r] of Object.entries(payload.values)) v[k] = r.value;
    return { ...v, ...draft };
  }, [payload, draft]);

  const dirtyKeys = useMemo(() => Object.keys(draft), [draft]);

  /** i18n helpers bound to this settings namespace. */
  const labels = useSettingsLabel(namespace);

  if (!namespace) {
    return <div className="p-6 text-muted-foreground">No namespace selected.</div>;
  }

  if (loading) {
    return (
      <div className="p-6 space-y-3 max-w-3xl">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 max-w-3xl">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <Card className="mt-3">
          <CardContent className="py-8 text-center text-sm text-destructive">{error}</CardContent>
        </Card>
      </div>
    );
  }

  if (!payload) return null;

  const { manifest, values } = payload;
  const Icon = manifest.icon ? getIcon(manifest.icon) : null;
  const title = labels.title(resolveLabel(manifest.label));
  const description = labels.description(manifest.description);

  const onSave = async () => {
    if (dirtyKeys.length === 0) return;
    setSaving(true);
    // Each attempt re-derives the refusal from scratch, so the panel always
    // reflects THIS save's verdict rather than a stale one from a previous try.
    setCryptoRefusal(null);
    try {
      const res = await saveSettingsNamespace(namespace, draft);
      setPayload({ ...payload, values: { ...values, ...res.values } });
      setDraft({});
      setFieldErrors({});
      toast.success('Settings saved');
    } catch (err: any) {
      const apiError = err?.payload?.error;
      if (apiError?.code === 'SETTINGS_LOCKED') {
        // `lockedKeyOf` reads both wire positions — see its note (objectstack#4224).
        const key = lockedKeyOf(apiError);
        toast.error(key ? `Locked by environment: ${key}` : 'Locked by environment');
      } else if (apiError?.code === 'SETTINGS_CRYPTO_UNAVAILABLE') {
        // The deployment cannot encrypt a declared-secret key, so the write was
        // refused (objectstack#8396). This is neither a per-field rejection nor
        // a transient failure the user can retry their way out of — it stays on
        // screen as its own state, carrying the server's prescription, until
        // the deployment is reconfigured.
        //
        // The toast mirrors SETTINGS_LOCKED above: a code-specific sentence
        // naming the subject, not the generic `err.message`. It fires for the
        // same reason the validation branch's does — the panel can be scrolled
        // out of view, and a save that silently does nothing is the worse
        // failure.
        const refusal = cryptoRefusalOf(apiError);
        setCryptoRefusal(refusal);
        toast.error(
          refusal.subject ? `Cannot encrypt secrets: ${refusal.subject}` : 'Cannot encrypt secrets',
        );
      } else {
        // Per-field rejections render against the inputs that caused them
        // (objectstack#4224). `extractFieldErrors` reads `details.fields`, so it
        // is handed `error` — the object that carries `details` — not the
        // whole body.
        //
        // The toast still fires: the offending field can be scrolled out of
        // view, or hidden behind a `visible` expression, and a save that
        // silently does nothing is the worse failure. It carries the server's
        // summary message, which already names the fields.
        const perField = extractFieldErrors(apiError);
        if (perField?.length) {
          setFieldErrors(Object.fromEntries(perField.map((f) => [f.field, f.message])));
        }
        toast.error(err?.message ?? 'Save failed');
      }
    } finally {
      setSaving(false);
    }
  };

  const onAction = async (actionId: string) => {
    setSaving(true);
    try {
      const result = await runSettingsAction(namespace, actionId, draft);
      if (result.ok) toast.success(result.message ?? 'Action succeeded');
      else toast.error(result.message ?? 'Action failed');
    } catch (err: any) {
      toast.error(err?.message ?? 'Action failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto pb-32">
      <Button variant="ghost" size="sm" onClick={() => navigate('/system/settings')}>
        <ArrowLeft className="h-4 w-4 mr-1" /> All settings
      </Button>

      <div className="mt-3 flex items-start gap-3">
        {Icon ? (
          // eslint-disable-next-line react-hooks/static-components -- getIcon returns a module-cached stable component per name, not one created during render
          <Icon className="h-7 w-7 mt-0.5 text-muted-foreground" />
        ) : null}
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            {manifest.beta ? <Badge variant="secondary">Beta</Badge> : null}
          </div>
          {description ? (
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
          ) : null}
        </div>
      </div>

      {manifest.helpText ? (
        <p className="text-sm text-muted-foreground mt-4 whitespace-pre-wrap">{manifest.helpText}</p>
      ) : null}

      {cryptoRefusal ? (
        <Card className="mt-4 border-destructive/50 bg-destructive/5">
          <CardContent className="py-4">
            <div role="alert" className="flex items-start gap-3">
              <ShieldAlert className="h-5 w-5 mt-0.5 shrink-0 text-destructive" />
              <div className="flex-1 text-sm">
                <p className="font-medium text-destructive">
                  This deployment cannot encrypt secrets
                </p>
                <p className="mt-1">
                  {cryptoRefusal.subject ? (
                    <>
                      <code className="font-mono text-xs">{cryptoRefusal.subject}</code> is
                      declared encrypted, so nothing was written.
                    </>
                  ) : (
                    'The declared-encrypted value was refused, so nothing was written.'
                  )}
                </p>
                {cryptoRefusal.prescription ? (
                  <p className="mt-2 text-muted-foreground whitespace-pre-wrap">
                    {cryptoRefusal.prescription}
                  </p>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="mt-6 divide-y">
        {manifest.specifiers
          .filter((spec) => evalVisibility(spec.visible, liveValues))
          .map((spec, idx) => {
            const key = spec.key;
            const resolved = key ? values[key] : undefined;
            const current = key ? (key in draft ? draft[key] : resolved?.value) : undefined;
            return (
              <SettingsField
                key={(key ?? `_layout_${idx}`) + idx}
                spec={spec}
                resolved={resolved}
                value={current}
                onChange={(v) => {
                  if (!key) return;
                  setDraft((d) => ({ ...d, [key]: v }));
                  // Clear this field's rejection the moment it is edited. The
                  // error describes the value the server saw, so keeping it on
                  // screen while the user types contradicts what is in the box —
                  // and the next save re-derives the set from scratch anyway.
                  setFieldErrors((e) => (key in e ? omitKey(e, key) : e));
                }}
                onAction={spec.type === 'action_button' ? () => onAction(spec.id ?? key ?? 'test') : undefined}
                locked={resolved?.locked}
                saving={saving}
                labels={labels}
                error={key ? fieldErrors[key] : undefined}
              />
            );
          })}
      </div>

      {dirtyKeys.length > 0 ? (
        <div className="fixed bottom-0 inset-x-0 bg-background/95 backdrop-blur border-t shadow-lg z-40">
          <div className="max-w-3xl mx-auto px-6 py-3 flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {dirtyKeys.length} unsaved change{dirtyKeys.length > 1 ? 's' : ''}
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDraft({});
                  // Discarding reverts to the stored values, so rejections of
                  // the edits being thrown away go with them.
                  setFieldErrors({});
                  setCryptoRefusal(null);
                }}
                disabled={saving}
              >
                <RotateCcw className="h-4 w-4 mr-1" /> Discard
              </Button>
              <Button onClick={onSave} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
                Save changes
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
