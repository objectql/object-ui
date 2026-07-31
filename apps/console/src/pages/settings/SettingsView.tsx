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
import { Loader2, ArrowLeft, RotateCcw } from 'lucide-react';
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

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const p = await getSettingsNamespace(namespace);
      setPayload(p);
      setDraft({});
      setFieldErrors({});
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
