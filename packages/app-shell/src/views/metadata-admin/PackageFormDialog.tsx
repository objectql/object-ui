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
import { NAMESPACE_RE } from '../studio-design/packages-io.js';
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@object-ui/components';
import { useMetadataLocale, t, tFormat } from './i18n.js';
import { SchemaForm, type SchemaFormIssue } from './SchemaForm.js';
import { getPackageSchema, getPackageForm } from './package-schema.js';
import { readEnvelopeFailureText } from '../../utils/apiErrorEnvelope.js';

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

/**
 * Was this envelope's prose MARKED, i.e. did the producer address it to the end
 * user (`error.userMessage`, #9934) rather than to whoever is debugging?
 *
 * ⚠️ Why this is read separately instead of taken from
 * {@link readEnvelopeFailureText}: that reader answers *what prose to show* and
 * deliberately collapses the two channels into one string
 * (`userMessage || message`, plus the declared code). Its return value
 * therefore cannot tell a caller WHICH channel won — and objectui#8051's two
 * status arms need exactly that bit, because their localized constant is a
 * generic substitution that objectui#3821 keeps for UNMARKED bodies only. So
 * the mark is read here and carried across the throw; ⛔ the arms cannot
 * re-derive it from the message they receive.
 *
 * ⛔ Not a second copy of the shared rule. The rule about what to SHOW stays in
 * `readEnvelopeFailureText` and is not restated here; this answers a different
 * question about the same body, at the one call site that asks it. Widening the
 * shared reader's signature to return the provenance is objectui#7980's
 * surface, not this card's.
 *
 * The predicate is byte-identical to the shared reader's `marked` const on
 * purpose: a typed `string` check, not a truthiness one, so a non-string mark
 * is not a mark (a producer bug — falling through to the diagnostic is the
 * honest answer) and an empty-string mark is not one either.
 */
function readEnvelopeUserMessage(payload: unknown): string {
  const error = (payload as { error?: unknown } | null | undefined)?.error;
  if (!error || typeof error !== 'object') return '';
  const { userMessage } = error as { userMessage?: unknown };
  return typeof userMessage === 'string' ? userMessage : '';
}

/**
 * What `apiJson` attaches to the `Error` it throws, and the whole of the
 * contract `submit()`'s catch reads back. Named rather than cast away one
 * property at a time so the carrier is legible from both ends: the catch cannot
 * recover either field from the message, and objectui#8051 turns on that.
 */
type ApiJsonError = Error & { status: number; userMessage: string };

async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: 'include',
    headers: { Accept: 'application/json', ...(init?.headers || {}) },
    ...init,
  });
  const text = await res.text();
  const payload = text ? JSON.parse(text) : null;
  if (!res.ok || payload?.success === false) {
    // The ADR-0112 envelope first, by the ONE shared rule — a producer-marked
    // `error.userMessage` outranks the diagnostic `error.message`, and
    // `error.code` rides along behind whichever won. This reader used to read
    // `error.message` and stop, so a marked sentence arrived on the wire (both
    // doors serving these package routes emit the channel) and had nowhere to
    // appear: on a marked 5xx the author was shown the generic substitution
    // the door had put in `message` instead of the sentence written for them.
    // See {@link readEnvelopeFailureText}.
    //
    // The two rungs BELOW it stay, and stay HERE rather than moving into the
    // shared reader: they are not the ADR-0112 envelope. A bare-string `error`
    // and a top-level `message` are older runtimes' shapes, live for this call
    // site and not for the rule's other consumers, and folding them in would
    // hand every one of those a tolerant dialect it never asked for.
    const msg =
      readEnvelopeFailureText(payload) ||
      payload?.error ||
      payload?.message ||
      `Request failed (${res.status})`;
    const err = new Error(typeof msg === 'string' ? msg : `Request failed (${res.status})`) as ApiJsonError;
    err.status = res.status;
    // objectui#8051 — the mark travels WITH the refusal. `msg` above already
    // resolved to the marked sentence when there was one, but it did so
    // irreversibly; the status arms in `submit()`'s catch have to know whether
    // the prose they are about to discard was addressed to the person reading
    // the screen. Empty string when unmarked, which is the overwhelmingly
    // common case and everything the two package doors emit today.
    err.userMessage = readEnvelopeUserMessage(payload);
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
      // objectui#8051 — WAS this refusal marked? The two status arms below
      // answer with a localized constant, and that constant is a GENERIC
      // SUBSTITUTION: objectui#3821's rule, which the envelope writer states as
      // "a consumer that sees the field renders it verbatim and keeps its
      // generic substitution for everything unmarked", keeps it for unmarked
      // bodies and hands a MARKED body straight to the person. Until this card
      // both arms applied the substitution to marked bodies too, so on the two
      // statuses an author meets most — 409 (id taken) and 403 (no ADR-0066
      // capability) — the one sentence a producer wrote for them was dropped.
      //
      // Ruling of record, objectui#8051 (2026-09-09), verbatim:
      // 「本地化分支改为优先使用生产方消息」, 「⛔ 无产品语义分叉」.
      //
      // ⚠️ This bit is NOT derivable from `msg`. `apiJson` resolves the
      // envelope through `readEnvelopeFailureText`, which returns
      // `userMessage || message` and reports no provenance — a marked sentence
      // and a diagnostic that happens to read the same are one value by then.
      // Hence `readEnvelopeUserMessage` at the throw site and this read here.
      const marked: boolean = typeof e?.userMessage === 'string' && e.userMessage !== '';
      if (e?.status === 409 || /already exists/i.test(msg)) {
        setError(marked ? msg : t('engine.packages.create.exists', locale));
      } else if (e?.status === 403 || /manage_metadata/i.test(msg)) {
        // objectstack#8270 — for an UNMARKED body this arm still answers
        // exactly as it did, and that is the whole of what #8270 measured. The
        // sentence it was ruled about, "Managing packages requires the
        // `manage_metadata` capability.", is the door's DIAGNOSTIC:
        // `sendError(res, 403, 'FORBIDDEN', …)` in `@objectstack/rest`
        // `package-routes.ts` passes no `extra`, so no `userMessage` rides with
        // it, so `marked` is false and the localized copy answers — byte for
        // byte as the 2026-08-13 maintainer ruling requires. A deployment that
        // withholds the capability does so deliberately, so this is a settled
        // posture to state in the user's language, not a transient failure to
        // retry. What changes is only the case #8270 never saw: a body a
        // producer deliberately marked for the end user.
        //
        // Probed the same way as the 409 arm above — the status when the
        // transport reports one, the message when it does not.
        setError(marked ? msg : t('engine.packages.noCapability', locale));
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
          <div
            data-testid="package-form-error"
            className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-sm text-destructive"
          >
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
