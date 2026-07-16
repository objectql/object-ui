// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * PackageFormDialog — ONE modal for creating, editing, and viewing a package,
 * rendered from the spec-derived manifest form (`package-schema`) through the
 * generic {@link SchemaForm}. It replaces the three hand-rolled package forms
 * (CreatePackageDialog / EditPackageDialog / the BuilderLanding inline form),
 * each of which carried its own field list and id-validation regex — a package
 * created on one surface was rejected by another.
 *
 * Modes:
 *   • create → POST /api/v1/packages { manifest }         (409 on duplicate id)
 *   • edit   → PATCH /api/v1/packages/:id { name, description, version }
 *              (the REST surface only persists those three; `id` / `type` /
 *              `namespace` / `scope` / … are `immutable` in the form and lock
 *              automatically once `createMode` is false)
 *   • view   → read-only render of the manifest
 */

import * as React from 'react';
import { AlertTriangle } from 'lucide-react';
import { ManifestSchema, deriveNamespaceFromPackageId } from '@objectstack/spec/kernel';
import { NAMESPACE_RE } from '../studio-design/packages-io';
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@object-ui/components';
import { useMetadataLocale, t, tFormat } from './i18n';
import { SchemaForm, type SchemaFormIssue } from './SchemaForm';
import { getPackageSchema, getPackageForm } from './package-schema';

const API = '/api/v1/packages';
const VERSION_RE = /^\d+\.\d+\.\d+$/;

export type PackageFormMode = 'create' | 'edit' | 'view';

/** A package manifest as a loose record (spec `ManifestSchema` shape). */
export type ManifestRecord = Record<string, unknown>;

export interface PackageSaveResult {
  id: string;
  mode: PackageFormMode;
  /** The server's package payload, when it returned one. */
  package?: { manifest: ManifestRecord } & Record<string, unknown>;
}

async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: 'include',
    headers: { Accept: 'application/json', ...(init?.headers || {}) },
    ...init,
  });
  const text = await res.text();
  const payload = text ? JSON.parse(text) : null;
  if (!res.ok || payload?.success === false) {
    const msg =
      payload?.error?.message || payload?.error || payload?.message || `Request failed (${res.status})`;
    const err = new Error(typeof msg === 'string' ? msg : `Request failed (${res.status})`);
    (err as any).status = res.status;
    throw err;
  }
  return (payload?.data ?? payload) as T;
}

function notifyPackagesChanged() {
  try {
    window.dispatchEvent(new CustomEvent('objectui:packages-changed'));
  } catch {
    /* non-DOM env */
  }
}

export function PackageFormDialog({
  mode,
  open,
  onOpenChange,
  manifest,
  onSaved,
}: {
  mode: PackageFormMode;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Existing manifest to seed edit/view. Ignored for create. */
  manifest?: ManifestRecord | null;
  onSaved?: (result: PackageSaveResult) => void;
}) {
  const locale = useMetadataLocale();
  const schema = React.useMemo(() => getPackageSchema(), []);
  const form = React.useMemo(() => getPackageForm(locale), [locale]);

  const createMode = mode === 'create';
  const readOnly = mode === 'view';

  const [draft, setDraft] = React.useState<ManifestRecord>({});
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  // Object-name namespace (framework#2694) tracks the id-derived default until
  // the user edits it directly.
  const nsTouched = React.useRef(false);

  React.useEffect(() => {
    if (!open) return;
    nsTouched.current = false;
    if (createMode) {
      // Defaults for a new WRITABLE base package. Deliberately no `scope`:
      // a runtime-created base is writable, whereas `scope: 'project'` marks a
      // read-only CODE package (packages-io writability heuristic). Sending it
      // would make every new package render as 只读. `defaultDatasource` is
      // likewise left to the server so we don't pin a datasource on create.
      setDraft({ version: '0.1.0', type: 'app' });
    } else {
      setDraft({ ...(manifest ?? {}) });
    }
    setError(null);
    setBusy(false);
  }, [open, createMode, manifest]);

  // On create, keep `namespace` in sync with the id (deriveNamespaceFromPackageId)
  // until the user edits the namespace field themselves — mirroring the old
  // create form's behaviour (framework#2694). SchemaForm hands us the full next
  // value, so we diff id/namespace to decide.
  const handleChange = React.useCallback(
    (next: ManifestRecord) => {
      if (!createMode) {
        setDraft(next);
        return;
      }
      setDraft((prev) => {
        let namespace = next.namespace;
        if (namespace !== prev.namespace) {
          // Direct edit — stop tracking the id and sanitize to the allowed
          // namespace alphabet (lowercase letters, digits, underscore).
          nsTouched.current = true;
          namespace = String(namespace ?? '')
            .toLowerCase()
            .replace(/[^a-z0-9_]/g, '');
        }
        if (!nsTouched.current && next.id !== prev.id) {
          namespace = deriveNamespaceFromPackageId(String(next.id ?? '')) ?? '';
        }
        return { ...next, namespace };
      });
    },
    [createMode],
  );

  // Spec validation → inline issues (only where fields are editable).
  const issues: SchemaFormIssue[] = React.useMemo(() => {
    if (readOnly) return [];
    const res = ManifestSchema.safeParse(draft);
    if (res.success) return [];
    return res.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
  }, [draft, readOnly]);

  const nameOk = !!String(draft.name ?? '').trim();
  const versionStr = String(draft.version ?? '').trim();
  const versionOk = createMode ? VERSION_RE.test(versionStr) : !versionStr || VERSION_RE.test(versionStr);
  const idOk = !createMode || !!String(draft.id ?? '').trim();
  // Namespace is required on create (framework#2694): every object name is
  // prefixed with it. On edit it's immutable and not resubmitted.
  const nsOk = !createMode || NAMESPACE_RE.test(String(draft.namespace ?? '').trim());
  const canSubmit = !readOnly && nameOk && versionOk && idOk && nsOk && !busy;

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      let result: PackageSaveResult;
      if (createMode) {
        const manifestBody: ManifestRecord = {
          ...draft,
          id: String(draft.id ?? '').trim(),
          name: String(draft.name ?? '').trim(),
          version: versionStr,
          type: draft.type ?? 'app',
        };
        const created = await apiJson<{ manifest: ManifestRecord } & Record<string, unknown>>(API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ manifest: manifestBody }),
        });
        const id = String((created?.manifest?.id as string) ?? manifestBody.id);
        result = { id, mode, package: created };
      } else {
        const id = String((manifest?.id as string) ?? draft.id ?? '');
        // The REST PATCH only persists name/description/version.
        const updated = await apiJson<{ manifest: ManifestRecord } & Record<string, unknown>>(
          `${API}/${encodeURIComponent(id)}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: String(draft.name ?? '').trim(),
              description: String(draft.description ?? '').trim(),
              version: versionStr,
            }),
          },
        );
        result = { id, mode, package: updated };
      }
      notifyPackagesChanged();
      onSaved?.(result);
      onOpenChange(false);
    } catch (e: any) {
      const msg: string = e?.message ?? '';
      if (e?.status === 409 || /already exists/i.test(msg)) {
        setError(t('engine.packages.create.exists', locale));
      } else {
        setError(msg || t(createMode ? 'engine.packages.create.failed' : 'engine.packages.edit.failed', locale));
      }
    } finally {
      setBusy(false);
    }
  }

  const title =
    mode === 'create'
      ? t('engine.packages.create.title', locale)
      : mode === 'edit'
        ? t('engine.packages.edit.title', locale)
        : t('engine.packages.view.title', locale);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {mode === 'create' ? (
            <DialogDescription>
              {tFormat('engine.packages.create.description', locale, { example: 'com.acme.crm' })}
            </DialogDescription>
          ) : (
            <DialogDescription className="font-mono text-xs">
              {String(manifest?.id ?? draft.id ?? '')}
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="py-1" data-testid="package-form">
          <SchemaForm
            schema={schema}
            form={form}
            value={draft}
            onChange={handleChange}
            issues={issues}
            readOnly={readOnly}
            createMode={createMode}
          />
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <DialogFooter>
          {readOnly ? (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t('engine.close', locale)}
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
                {t('engine.cancel', locale)}
              </Button>
              <Button onClick={submit} disabled={!canSubmit} data-testid="package-form-submit">
                {busy
                  ? t(createMode ? 'engine.packages.create.creating' : 'engine.packages.edit.saving', locale)
                  : t(createMode ? 'engine.packages.create.submit' : 'engine.packages.edit.save', locale)}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
