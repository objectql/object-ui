// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * PermissionMatrixEditor — custom editor for `type=permission` (Phase 3e).
 *
 * Renders the Salesforce-style matrix that lives behind a Permission
 * Set / Profile metadata item:
 *
 *   • Top section — object-level CRUD + VAMA (View All / Modify All)
 *     + lifecycle (Transfer / Restore / Purge).
 *   • Lower section — field-level R/W for the fields of any object
 *     selected from the table above.
 *
 * Data model (matches `PermissionSetSchema` in
 * `packages/spec/src/security/permission.zod.ts`):
 *
 *   {
 *     name: string,
 *     label?: string,
 *     isDefault?: boolean,   // install-time suggestion (ADR-0090 D5); Profile was removed (D2)
 *     objects: { [object_name]: ObjectPermission },
 *     fields?:  { [`${object_name}.${field_name}`]: FieldPermission },
 *     systemPermissions?: string[],
 *     tabPermissions?: Record<string, 'visible'|'hidden'|'default_on'|'default_off'>,
 *   }
 *
 * Wiring: registered from `builtinComponents.tsx` as
 *   registerMetadataResource({ type: 'permission', EditPage: PermissionMatrixEditPage })
 *
 * The component reads `/api/v1/meta/object` to enumerate available
 * objects, and reads each object's merged definition (`GET
 * /api/v1/meta/object/<name>`, whose `fields` reflect the published
 * object — inline + standalone) to enumerate that object's fields for
 * field-level permission editing. Saves through the
 * standard metadata save flow (overlay-aware, OCC, destructive-change
 * dialog already provided by the generic engine — we go through
 * client.save() directly).
 */

import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Save,
  Loader2,
  History as HistoryIcon,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@object-ui/components';
import { Badge } from '@object-ui/components';
import { Input } from '@object-ui/components';
import { Label } from '@object-ui/components';
import { Switch } from '@object-ui/components';
import { Checkbox } from '@object-ui/components';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@object-ui/components';
import { useAdapter } from '@object-ui/react';
import { CapabilityMultiSelectField, parseCapabilityNames } from '@object-ui/fields';
import { PageShell } from './PageShell';
import { useMetadataClient, useMetadataTypes, type RichMetadataTypeEntry } from './useMetadata';
import { resolveResourceConfig } from './registry';
import { t as translate, useMetadataLocale } from './i18n';
import { PermissionAdvancedFacets } from './PermissionAdvancedFacets';
import {
  mergePermissionSlice,
  scopePermissionSet,
  type ObjectPerm,
  type FieldPerm,
  type PermissionSetDraft,
} from './permission-slice';

/* ────────────────────────────────────────────────────────────────── */
/* Domain shapes                                                      */
/* ────────────────────────────────────────────────────────────────── */

interface ObjectSummary {
  name: string;
  label?: string;
  /**
   * [ADR-0066 D2/④] The object's `access.default` posture. A `private`
   * object is NOT covered by a permission set's `'*'` wildcard grant —
   * access requires an explicit per-object grant (or the superuser
   * viewAllRecords/modifyAllRecords bypass). Surfaced as a row badge so
   * admins editing the matrix know a wildcard-only set does not reach it.
   */
  accessDefault?: 'public' | 'private';
  /**
   * [ADR-0090 D1/D11] The object's authored OWD pair. Record-level baseline
   * context for the grants edited here: object CRUD in this matrix gates the
   * operation, the OWD decides WHICH records it reaches (own vs org-wide).
   * `owd` unset renders as the D1 fail-closed default (private).
   */
  owd?: string;
  owdExternal?: string;
}

/** Localized short label for an OWD value; falls back to the raw value. */
function owdLabel(t: (k: string) => string, value: string): string {
  const key: Record<string, string> = {
    private: 'perm.owd.private',
    public_read: 'perm.owd.public_read',
    public_read_write: 'perm.owd.public_read_write',
    controlled_by_parent: 'perm.owd.controlled_by_parent',
  };
  return key[value] ? t(key[value]) : value;
}

interface FieldSummary {
  name: string;
  label?: string;
}

function getObjectActions(
  locale: string,
): Array<{ key: keyof ObjectPerm; short: string; tip: string }> {
  return [
    { key: 'allowCreate', short: 'C', tip: translate('perm.action.create', locale) },
    { key: 'allowRead', short: 'R', tip: translate('perm.action.read', locale) },
    { key: 'allowEdit', short: 'U', tip: translate('perm.action.edit', locale) },
    { key: 'allowDelete', short: 'D', tip: translate('perm.action.delete', locale) },
    { key: 'allowTransfer', short: 'Tr', tip: translate('perm.action.transfer', locale) },
    { key: 'allowRestore', short: 'Re', tip: translate('perm.action.restore', locale) },
    { key: 'allowPurge', short: 'Pu', tip: translate('perm.action.purge', locale) },
    { key: 'viewAllRecords', short: 'VA', tip: translate('perm.action.viewAll', locale) },
    { key: 'modifyAllRecords', short: 'MA', tip: translate('perm.action.modifyAll', locale) },
  ];
}

export interface PermissionMatrixEditPageProps {
  type: string;
  name: string;
  /**
   * When set, the matrix is scoped to a single package (ADR-0086 P0): it lists
   * only the objects that package declares, and Save merges just that slice
   * back — other packages' contributed rows are left untouched. When omitted,
   * the matrix operates at environment scope (all objects, whole-record save).
   */
  packageId?: string;
  /**
   * ADR-0086 P2 (D6/D7 — the package door). When editing under a `packageId`,
   * a permission set is package **metadata**: Save writes a **draft** (not a
   * live record), published atomically with the rest of the package. `onDraftSaved`
   * notifies the surface so its pending-changes counter refreshes; `publishNonce`
   * bumps on publish so the editor re-reads the now-published baseline (its draft
   * is gone). Both are no-ops at environment scope, where Save stays live (D7).
   */
  onDraftSaved?: () => void;
  publishNonce?: number;
  /**
   * objectui#2505 — when provided, the per-object OWD badge becomes a link that
   * opens the package-level Record Sharing Baseline (OWD) overview, scrolled to
   * that object. Set only by the Studio Access pillar (which hosts the sibling
   * overview surface); omitted at environment scope / metadata-admin, where the
   * badge stays a plain read-only chip.
   */
  onOpenOwd?: (objectName: string) => void;
  /**
   * Fires on every unsaved-edit transition (false → true → false). The Studio
   * Access pillar keys this page per set (`key={name}`) and swaps it out for
   * the OWD overview, so the HOST must know before a surface switch whether a
   * remount would discard edits. Reset to `false` on unmount so a discarded
   * editor never leaves the host thinking edits are still pending.
   */
  onDirtyChange?: (dirty: boolean) => void;
  /**
   * Host-level read-only gate — set by the Studio Access pillar when the
   * surrounding PACKAGE is read-only. Independent of the TYPE-level
   * `allowOrgOverride` writability: either gate locks the matrix (checkboxes,
   * bulk buttons, name/label, facets), hides Save, and shows the read-only
   * badge — the badge hint names the package as the reason when this gate
   * is the one that tripped.
   */
  readOnly?: boolean;
}

/* ────────────────────────────────────────────────────────────────── */
/* Component                                                          */
/* ────────────────────────────────────────────────────────────────── */

export function PermissionMatrixEditPage({ type, name, packageId, onDraftSaved, publishNonce, onOpenOwd, onDirtyChange, readOnly = false }: PermissionMatrixEditPageProps) {
  const navigate = useNavigate();
  const client = useMetadataClient();
  // Data adapter (records) — the capability picker reads the live sys_capability
  // registry (ADR-0056 P2). The metadata `client` handles the draft; capability
  // rows are data, fetched like AssignedUsersSection does.
  const adapter = useAdapter();
  const { entries } = useMetadataTypes(client);
  const entry: RichMetadataTypeEntry | undefined = entries.find((t) => t.type === type);
  const resolved = resolveResourceConfig(type, entry);
  // Two independent read-only gates: the metadata TYPE may forbid org
  // overrides (allowOrgOverride), and the HOST may pass a package-level
  // `readOnly` (read-only package in the Studio Access pillar). Either one
  // must lock every authoring affordance below.
  const writable = !!resolved.allowOrgOverride && !readOnly;
  const locale = useMetadataLocale();
  const t = React.useCallback((k: string) => translate(k, locale), [locale]);
  const OBJECT_ACTIONS = React.useMemo(() => getObjectActions(locale), [locale]);

  const [draft, setDraft] = React.useState<PermissionSetDraft>({
    name,
    objects: {},
    fields: {},
  });
  // Snapshot of the last loaded/saved draft — the anchor `isDirty` compares
  // against. `null` until the first load lands (nothing to be dirty against).
  const baselineRef = React.useRef<string | null>(null);
  /** Set the draft AND re-anchor the dirty baseline to it (load + post-save). */
  const resetDraftBaseline = React.useCallback((next: PermissionSetDraft) => {
    try {
      baselineRef.current = JSON.stringify(next);
    } catch {
      baselineRef.current = null;
    }
    setDraft(next);
  }, []);
  const [objects, setObjects] = React.useState<ObjectSummary[]>([]);
  const [fieldsByObject, setFieldsByObject] = React.useState<Record<string, FieldSummary[]>>({});
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [destructive, setDestructive] = React.useState<
    null | { issues: Array<{ kind?: string; path?: string; message?: string }>; pending: PermissionSetDraft }
  >(null);
  const [filter, setFilter] = React.useState('');
  const [showOnlyEnabled, setShowOnlyEnabled] = React.useState(false);
  // All permission-set api-names — the admin-scope editor's assignable
  // allowlist picks from these (ADR-0056 P3).
  const [allSetNames, setAllSetNames] = React.useState<string[]>([]);
  React.useEffect(() => {
    let cancelled = false;
    client
      .list<{ name?: string }>('permission', {})
      .then((rows) => {
        if (!cancelled)
          setAllSetNames(
            (rows || []).map((r) => r?.name).filter((n): n is string => !!n),
          );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [client]);

  /* ── Load draft + object catalog ───────────────────────────── */
  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const [lay, objList, pendingDraft] = await Promise.all([
          client.layered<PermissionSetDraft>(type, name).catch(() => null),
          // In package scope, list only the objects this package declares
          // (ADR-0086 P0) — otherwise the whole environment leaks into the panel.
          client.list<any>('object', packageId ? { packageId } : {}).catch(() => []),
          // ADR-0086 P2 (D6): under the package door a set is draft/published
          // metadata, so surface the PENDING draft if one exists — otherwise a
          // just-saved-not-yet-published edit would appear lost on reopen. Draft
          // reads return the `{ type, name, item }` envelope; `null` = no draft.
          packageId
            ? client.getDraft<{ item?: PermissionSetDraft } | PermissionSetDraft>(type, name, { packageId }).catch(() => null)
            : Promise.resolve(null),
        ]);
        if (cancelled) return;
        const draftBody = pendingDraft
          ? (((pendingDraft as any).item ?? pendingDraft) as PermissionSetDraft)
          : null;
        // Draft wins over the published baseline for display (D6).
        const effective: PermissionSetDraft = (draftBody ?? lay?.effective ??
          lay?.code ?? { name, objects: {} }) as PermissionSetDraft;
        const list: ObjectSummary[] = ((objList as any[]) ?? [])
          .map((row) => {
            const item = row?.item ?? row;
            return {
              name: String(item?.name ?? ''),
              label: item?.label,
              accessDefault: item?.access?.default as ObjectSummary['accessDefault'],
              owd: typeof item?.sharingModel === 'string' ? item.sharingModel : undefined,
              owdExternal:
                typeof item?.externalSharingModel === 'string' ? item.externalSharingModel : undefined,
            };
          })
          .filter((o) => !!o.name)
          .sort((a, b) => a.name.localeCompare(b.name));
        setObjects(list);
        const full: PermissionSetDraft = {
          ...effective,
          name: String(effective?.name ?? name),
          objects: effective?.objects ?? {},
          fields: effective?.fields ?? {},
        };
        // Package scope: only surface this package's slice for editing; rows
        // contributed by other packages stay off-screen and are re-merged on
        // Save from a fresh read (see doSave).
        if (packageId) {
          const sliced = scopePermissionSet(full, list.map((o) => o.name));
          resetDraftBaseline({ ...full, objects: sliced.objects, fields: sliced.fields });
        } else {
          resetDraftBaseline(full);
        }
      } catch (err: any) {
        setError(err?.message ?? String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client, type, name, packageId, publishNonce, resetDraftBaseline]);

  /* ── Lazy-load fields when an object is expanded ─────────── */
  async function ensureFields(objectName: string) {
    if (fieldsByObject[objectName]) return;
    try {
      // Read the authoritative, merged object definition (same source the
      // object settings tab uses for its nameField dropdown). The `field`
      // LIST endpoint only surfaces standalone/code-package field metadata
      // and misses fields carried inline on a published object, which left
      // this editor showing "no fields" for objects that clearly have them.
      // `fields` may come back as an array or as a `{ [name]: def }` map.
      const obj = (await client.get<any>('object', objectName)) as
        | { fields?: Record<string, any> | Array<any> }
        | null;
      const raw = obj?.fields;
      const list: FieldSummary[] = (
        Array.isArray(raw)
          ? raw.map((f: any) => ({ name: String(f?.name ?? ''), label: f?.label }))
          : raw && typeof raw === 'object'
            ? Object.entries(raw).map(([name, f]: [string, any]) => ({
                name: String(f?.name ?? name),
                label: f?.label,
              }))
            : []
      )
        .filter((f) => !!f.name)
        .sort((a, b) => a.name.localeCompare(b.name));
      setFieldsByObject((prev) => ({ ...prev, [objectName]: list }));
    } catch {
      setFieldsByObject((prev) => ({ ...prev, [objectName]: [] }));
    }
  }

  /**
   * Resolve a policy object's field NAMES for the RLS CEL editor
   * (objectui#2413) — powers field lint + autocomplete. Reads the merged object
   * definition like {@link ensureFields}; the facets cache the result per object.
   */
  const loadObjectFields = React.useCallback(
    async (objectName: string): Promise<string[]> => {
      try {
        const obj = (await client.get<any>('object', objectName)) as
          | { fields?: Record<string, any> | Array<any> }
          | null;
        const raw = obj?.fields;
        const names = (
          Array.isArray(raw)
            ? raw.map((f: any) => String(f?.name ?? ''))
            : raw && typeof raw === 'object'
              ? Object.entries(raw).map(([name, f]: [string, any]) => String((f as any)?.name ?? name))
              : []
        ).filter(Boolean);
        return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
      } catch {
        return [];
      }
    },
    [client],
  );

  // Count of blocking CEL parse errors in the RLS editor — gates Save
  // (objectui#2413): a malformed predicate silently mis-scopes rows, so we
  // don't let it persist.
  const [celErrorCount, setCelErrorCount] = React.useState(0);

  // Dirty detection — cheap JSON snapshot comparison against the last
  // loaded/saved baseline (same approach as ResourceEditPage). Every mutation
  // funnels through setDraft (matrix checkboxes, header inputs, capabilities,
  // advanced facets), so comparing the draft covers them all.
  const isDirty = React.useMemo(() => {
    const snap = baselineRef.current;
    if (snap == null) return false;
    try {
      return JSON.stringify(draft) !== snap;
    } catch {
      return false;
    }
  }, [draft]);

  // Report dirty transitions to the host (see onDirtyChange). Ref-stabilized
  // so a non-memoized callback prop doesn't refire the effect; the unmount
  // cleanup reports `false` so a deliberately-discarded editor clears the
  // host's guard state.
  const onDirtyChangeRef = React.useRef(onDirtyChange);
  React.useEffect(() => {
    onDirtyChangeRef.current = onDirtyChange;
  });
  React.useEffect(() => {
    onDirtyChangeRef.current?.(isDirty);
  }, [isDirty]);
  React.useEffect(
    () => () => {
      onDirtyChangeRef.current?.(false);
    },
    [],
  );

  // Browser-native "leave site?" prompt on tab close / reload with unsaved
  // matrix edits — same guard ResourceEditPage installs.
  React.useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Required for Chrome to actually show the prompt.
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  function toggleExpand(objectName: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(objectName)) next.delete(objectName);
      else {
        next.add(objectName);
        ensureFields(objectName);
      }
      return next;
    });
  }

  /* ── Mutators ───────────────────────────────────────────── */
  function updateObjectPerm(objectName: string, action: keyof ObjectPerm, value: boolean) {
    setDraft((prev) => {
      const cur = prev.objects[objectName] ?? {};
      const nextObj: ObjectPerm = { ...cur, [action]: value };
      // Cascade: viewAllRecords implies allowRead.
      if (action === 'viewAllRecords' && value) nextObj.allowRead = true;
      if (action === 'modifyAllRecords' && value) {
        nextObj.allowEdit = true;
        nextObj.allowRead = true;
      }
      return {
        ...prev,
        objects: { ...prev.objects, [objectName]: nextObj },
      };
    });
  }

  function bulkSetObject(objectName: string, action: 'all' | 'none' | 'crud' | 'read') {
    setDraft((prev) => {
      const next: ObjectPerm =
        action === 'none'
          ? {}
          : action === 'all'
          ? Object.fromEntries(OBJECT_ACTIONS.map((a) => [a.key, true])) as ObjectPerm
          : action === 'crud'
          ? { allowCreate: true, allowRead: true, allowEdit: true, allowDelete: true }
          : { allowRead: true };
      return {
        ...prev,
        objects: { ...prev.objects, [objectName]: next },
      };
    });
  }

  function updateFieldPerm(objectName: string, fieldName: string, action: keyof FieldPerm, value: boolean) {
    const key = `${objectName}.${fieldName}`;
    setDraft((prev) => {
      const fields = { ...(prev.fields ?? {}) };
      const cur = fields[key] ?? { readable: true, editable: false };
      const next: FieldPerm = { ...cur, [action]: value };
      // Cascade: !readable implies !editable.
      if (action === 'readable' && !value) next.editable = false;
      // Cascade: editable implies readable.
      if (action === 'editable' && value) next.readable = true;
      fields[key] = next;
      return { ...prev, fields };
    });
  }

  /**
   * Re-narrow a freshly-read full permission set to this package's slice for
   * display. No-op at environment scope (no `packageId`).
   */
  function toDisplayDraft(set: PermissionSetDraft): PermissionSetDraft {
    if (!packageId) return set;
    const sliced = scopePermissionSet(set, objects.map((o) => o.name));
    return { ...set, objects: sliced.objects, fields: sliced.fields };
  }

  /* ── Save ────────────────────────────────────────────────── */
  async function doSave(force: boolean, pending?: PermissionSetDraft) {
    const payload = pending ?? draft;
    setSaving(true);
    setError(null);
    try {
      // Package scope: merge only this package's slice back onto a fresh read
      // of the record so rows contributed by other packages survive byte-for-
      // byte (ADR-0086 P0). Environment scope keeps the whole-record save.
      let toSave = payload;
      if (packageId) {
        const scope = objects.map((o) => o.name);
        const fresh = await client
          .layered<PermissionSetDraft>(type, payload.name)
          .catch(() => null);
        const base = (fresh?.effective ?? payload) as PermissionSetDraft;
        toSave = mergePermissionSlice(base, payload, scope);
      }
      // ADR-0086 P2 (D6/D7). Package door → the set is metadata: write a DRAFT
      // (stamped with `packageId`) that the package's atomic Publish promotes,
      // exactly like the Data/Interfaces pillars — NOT a live record write.
      // Environment door (no packageId) stays live (config).
      await client.save<PermissionSetDraft>(type, payload.name, toSave, {
        force,
        ...(packageId ? { mode: 'draft' as const, packageId } : {}),
      });
      if (packageId) {
        // The draft is now the pending truth for display; the published baseline
        // hasn't moved. Show what we just staged and let the surface count it.
        resetDraftBaseline(toDisplayDraft(toSave));
        onDraftSaved?.();
      } else {
        const lay = await client.layered<PermissionSetDraft>(type, payload.name);
        resetDraftBaseline(toDisplayDraft((lay.effective ?? toSave) as PermissionSetDraft));
      }
      setDestructive(null);
    } catch (err: any) {
      if (err?.status === 409 && err?.code === 'destructive_change') {
        const issues = err?.body?.issues ?? [];
        setDestructive({ issues: Array.isArray(issues) ? issues : [], pending: payload });
      } else {
        setError(err?.message ?? String(err));
      }
    } finally {
      setSaving(false);
    }
  }

  /* ── Render helpers ──────────────────────────────────────── */
  const filteredObjects = React.useMemo(() => {
    const q = filter.trim().toLowerCase();
    return objects.filter((o) => {
      if (showOnlyEnabled) {
        const perm = draft.objects[o.name];
        if (!perm || !Object.values(perm).some(Boolean)) return false;
      }
      if (!q) return true;
      return (
        o.name.toLowerCase().includes(q) ||
        (o.label ?? '').toLowerCase().includes(q)
      );
    });
  }, [objects, filter, showOnlyEnabled, draft.objects]);

  const stats = [
    {
      label: t('perm.stat.objectsGranted'),
      value: Object.values(draft.objects).filter((p) => Object.values(p).some(Boolean)).length,
    },
    {
      label: t('perm.stat.fieldOverrides'),
      value: Object.keys(draft.fields ?? {}).length,
    },
  ];

  if (loading) {
    return (
      <PageShell entry={entry} itemName={name}>
        <div className="p-6 text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> {t('perm.loading').replace('{name}', name)}
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell
      entry={entry ?? { type, label: type }}
      itemName={name}
      subtitle={t('perm.subtitle.set')}
      stats={stats}
      actions={
        <>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`./history?type=${encodeURIComponent(type)}`)}
          >
            <HistoryIcon className="h-4 w-4 mr-1" /> {t('engine.edit.history')}
          </Button>
          {writable && (
            <Button
              size="sm"
              onClick={() => doSave(false)}
              disabled={saving || celErrorCount > 0}
              title={celErrorCount > 0 ? t('perm.cel.saveBlocked') : undefined}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-1" />
              )}
              {t('engine.edit.save')}
            </Button>
          )}
        </>
      }
    >
      <div className="flex flex-col h-full overflow-hidden">
        {error && (
          <div className="m-4 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Header strip — name / label / provenance + default badges */}
        <div className="px-6 py-3 border-b bg-muted/30 flex flex-wrap items-end gap-4">
          <div className="space-y-1">
            <Label htmlFor="perm-name" className="text-xs">{t('perm.field.name')}</Label>
            <Input
              id="perm-name"
              value={draft.name}
              disabled={!writable}
              onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))}
              className="h-8 w-56"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="perm-label" className="text-xs">{t('perm.field.label')}</Label>
            <Input
              id="perm-label"
              value={draft.label ?? ''}
              disabled={!writable}
              onChange={(e) => setDraft((p) => ({ ...p, label: e.target.value }))}
              className="h-8 w-72"
            />
          </div>
          {/* ADR-0090 D2: the profile toggle is gone. What matters instead is
              WHO OWNS the set (provenance, ADR-0086 D3) and whether it is the
              package's suggested default (ADR-0090 D5). */}
          <div className="flex items-center gap-1.5 pb-1">
            {/* [A4 framework#2920] Provenance tri-state — platform / package /
                admin(custom) — mirrors the unified sys_* `managed_by` vocab so
                the Studio matrix and the Setup record page read the same. */}
            <Badge variant="outline" className="text-[10px]">
              {draft.managedBy === 'platform'
                ? t('perm.badge.platform')
                : draft.managedBy === 'package' || packageId
                  ? t('perm.badge.package')
                  : t('perm.badge.custom')}
            </Badge>
            {!!draft.isDefault && (
              <Badge variant="secondary" className="text-[10px]">{t('perm.badge.default')}</Badge>
            )}
          </div>
          {!writable && (
            // Same badge slot, two distinct reasons: a read-only PACKAGE
            // (host gate — mirror the top-bar wording so the screen is not
            // self-contradictory) vs. metadata writes disabled environment-
            // wide (type gate).
            <Badge
              variant="secondary"
              className="ml-auto"
              title={readOnly ? t('engine.studio.pkg.readonlyHint') : undefined}
            >
              {readOnly ? t('engine.studio.pkg.readonly') : t('perm.readOnly')}
            </Badge>
          )}
        </div>

        {/* System Capabilities (ADR-0056 P2) — set-level platform/org
            capabilities (e.g. studio.access, manage_users). Designed here in
            Studio; Setup renders them read-only (PermissionFacetLink). Stored
            as PermissionSetDraft.systemPermissions (string[]); the picker
            round-trips via a JSON string, so parse back into the array the
            draft model uses. Persisted by the whole-record Save at env scope. */}
        <div className="px-6 py-3 border-b">
          <Label className="text-xs">{t('perm.field.systemCapabilities')}</Label>
          <p className="text-xs text-muted-foreground mt-0.5 mb-2">
            {t('perm.field.systemCapabilitiesHelp')}
          </p>
          <CapabilityMultiSelectField
            value={JSON.stringify(draft.systemPermissions ?? [])}
            onChange={(v: unknown) =>
              setDraft((p) => ({ ...p, systemPermissions: parseCapabilityNames(v) }))
            }
            field={{ name: 'system_permissions' } as any}
            dataSource={adapter as any}
            readonly={!writable}
          />
        </div>

        {/* Filter bar */}
        <div className="px-6 py-3 border-b flex items-center gap-3">
          <Input
            placeholder={t('perm.filter.placeholder')}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="h-8 w-72"
          />
          <div className="flex items-center gap-2">
            <Switch
              id="only-enabled"
              checked={showOnlyEnabled}
              onCheckedChange={(v) => setShowOnlyEnabled(!!v)}
            />
            <Label htmlFor="only-enabled" className="text-xs">{t('perm.filter.onlyGranted')}</Label>
          </div>
          <span className="text-xs text-muted-foreground ml-auto">
            {filteredObjects.length} / {objects.length} {t('perm.stat.objectsSuffix')}
          </span>
        </div>

        {/* Column legend — the matrix header cells already carry a native
            `title` tooltip per column, but a hover-only affordance on
            unfamiliar two-letter abbreviations (Tr/Re/Pu/VA/MA) is easy to
            miss. Spell them out once, up front. */}
        <div className="px-6 py-2 border-b flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {OBJECT_ACTIONS.map((a) => (
            <span key={a.key as string} className="whitespace-nowrap">
              <span className="font-medium text-foreground">{a.short}</span> {a.tip}
            </span>
          ))}
        </div>

        {/* Matrix */}
        <div className="flex-1 overflow-auto">
          <PermissionTable
            objects={filteredObjects}
            draft={draft}
            expanded={expanded}
            fieldsByObject={fieldsByObject}
            writable={writable}
            objectActions={OBJECT_ACTIONS}
            t={t}
            onToggleExpand={toggleExpand}
            onObjectPerm={updateObjectPerm}
            onFieldPerm={updateFieldPerm}
            onBulkSet={bulkSetObject}
            onOpenOwd={onOpenOwd}
          />
          {/* Advanced facets (ADR-0056 P3) — RLS / tab visibility / delegated
              admin scope, structured editors instead of raw JSON. Collapsed by
              default so they don't crowd the object matrix. */}
          <PermissionAdvancedFacets
            draft={draft}
            setDraft={setDraft}
            writable={writable}
            allSetNames={allSetNames}
            loadObjectFields={loadObjectFields}
            onCelErrorsChange={setCelErrorCount}
            t={t}
          />
        </div>
        {/* ADR-0056 P4 — user assignment MOVED to the Setup sys_permission_set
            record page (RecordPermissionAssignmentsRenderer, P1b). In the pure
            model this editor is the *design* surface (facets only); *assigning*
            users is a Setup act, so it no longer lives here. */}
      </div>

      {/* Destructive-change dialog */}
      <Dialog open={!!destructive} onOpenChange={(open) => !open && setDestructive(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" /> {t('engine.edit.destructive')}
            </DialogTitle>
            <DialogDescription>
              {t('engine.edit.destructiveHint')}
            </DialogDescription>
          </DialogHeader>
          <ul className="text-sm space-y-1 max-h-64 overflow-auto">
            {destructive?.issues.map((i, idx) => (
              <li key={idx} className="border-l-2 border-amber-500 pl-2">
                {i.kind && <Badge variant="outline" className="mr-2">{i.kind}</Badge>}
                {i.message ?? JSON.stringify(i)}
              </li>
            ))}
          </ul>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDestructive(null)}>{t('engine.cancel')}</Button>
            <Button
              variant="destructive"
              onClick={() => destructive && doSave(true, destructive.pending)}
              disabled={saving}
            >
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {t('engine.edit.forceSave')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}

/* ────────────────────────────────────────────────────────────────── */
/* Subcomponent: PermissionTable                                      */
/* ────────────────────────────────────────────────────────────────── */

interface PermissionTableProps {
  objects: ObjectSummary[];
  draft: PermissionSetDraft;
  expanded: Set<string>;
  fieldsByObject: Record<string, FieldSummary[]>;
  writable: boolean;
  objectActions: ReturnType<typeof getObjectActions>;
  t: (key: string) => string;
  onToggleExpand: (objectName: string) => void;
  onObjectPerm: (objectName: string, action: keyof ObjectPerm, value: boolean) => void;
  onFieldPerm: (objectName: string, fieldName: string, action: keyof FieldPerm, value: boolean) => void;
  onBulkSet: (objectName: string, action: 'all' | 'none' | 'crud' | 'read') => void;
  /** objectui#2505 — when set, the OWD badge links to the package OWD overview. */
  onOpenOwd?: (objectName: string) => void;
}

function PermissionTable({
  objects,
  draft,
  expanded,
  fieldsByObject,
  writable,
  objectActions,
  t,
  onToggleExpand,
  onObjectPerm,
  onFieldPerm,
  onBulkSet,
  onOpenOwd,
}: PermissionTableProps) {
  return (
    <table className="w-full text-sm">
      <thead className="sticky top-0 bg-background border-b z-10">
        <tr>
          <th className="text-left px-4 py-2 font-medium w-72">{t('perm.col.object')}</th>
          {objectActions.map((a) => (
            <th
              key={a.key as string}
              className="px-2 py-2 font-medium text-center w-14"
              title={a.tip}
            >
              {a.short}
            </th>
          ))}
          <th className="px-2 py-2 font-medium w-44 text-right">{t('perm.col.bulk')}</th>
        </tr>
      </thead>
      <tbody>
        {objects.length === 0 && (
          <tr>
            <td colSpan={objectActions.length + 2} className="px-4 py-8 text-center text-muted-foreground">
              {t('perm.filter.empty')}
            </td>
          </tr>
        )}
        {objects.map((o) => {
          const perm = draft.objects[o.name] ?? {};
          const open = expanded.has(o.name);
          return (
            <React.Fragment key={o.name}>
              <tr className="border-b hover:bg-muted/30">
                <td className="px-2 py-1.5 align-middle">
                  <button
                    type="button"
                    onClick={() => onToggleExpand(o.name)}
                    className="inline-flex items-center gap-1.5 hover:text-foreground"
                  >
                    {open ? (
                      <ChevronDown className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5" />
                    )}
                    <span className="font-medium">{o.label ?? o.name}</span>
                    {o.label && (
                      <span className="text-xs text-muted-foreground">({o.name})</span>
                    )}
                  </button>
                  {o.accessDefault === 'private' && (
                    <Badge
                      variant="outline"
                      className="ml-2 border-amber-500/50 text-amber-600 dark:text-amber-400 text-[10px] px-1.5 py-0 align-middle"
                      title={t('perm.posture.private.tip')}
                    >
                      {t('perm.posture.private')}
                    </Badge>
                  )}
                  <Badge
                    variant="outline"
                    className={
                      'ml-2 text-[10px] px-1.5 py-0 align-middle text-muted-foreground' +
                      (onOpenOwd
                        ? ' cursor-pointer hover:text-foreground hover:border-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary'
                        : '')
                    }
                    title={onOpenOwd ? t('perm.owd.editLink') : t('perm.owd.tip')}
                    {...(onOpenOwd
                      ? {
                          role: 'button',
                          tabIndex: 0,
                          'data-testid': `owd-badge-${o.name}`,
                          onClick: () => onOpenOwd(o.name),
                          onKeyDown: (ev: React.KeyboardEvent) => {
                            if (ev.key === 'Enter' || ev.key === ' ') {
                              ev.preventDefault();
                              onOpenOwd(o.name);
                            }
                          },
                        }
                      : {})}
                  >
                    {`OWD ${o.owd ? owdLabel(t, o.owd) : t('perm.owd.defaultPrivate')}`}
                  </Badge>
                  {o.owdExternal && (
                    <Badge
                      variant="outline"
                      className="ml-1 text-[10px] px-1.5 py-0 align-middle text-muted-foreground"
                      title={t('perm.owd.ext.tip')}
                    >
                      {`Ext ${owdLabel(t, o.owdExternal)}`}
                    </Badge>
                  )}
                </td>
                {objectActions.map((a) => (
                  <td key={a.key as string} className="text-center px-2 py-1.5">
                    <Checkbox
                      checked={!!perm[a.key]}
                      disabled={!writable}
                      onCheckedChange={(v) => onObjectPerm(o.name, a.key, !!v)}
                      aria-label={`${o.name} ${a.tip}`}
                    />
                  </td>
                ))}
                <td className="px-2 py-1.5 text-right space-x-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-1.5 text-xs"
                    disabled={!writable}
                    onClick={() => onBulkSet(o.name, 'read')}
                  >
                    {t('perm.bulk.read')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-1.5 text-xs"
                    disabled={!writable}
                    onClick={() => onBulkSet(o.name, 'crud')}
                  >
                    {t('perm.bulk.crud')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-1.5 text-xs"
                    disabled={!writable}
                    onClick={() => onBulkSet(o.name, 'all')}
                  >
                    {t('perm.bulk.all')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-1.5 text-xs"
                    disabled={!writable}
                    onClick={() => onBulkSet(o.name, 'none')}
                  >
                    {t('perm.bulk.none')}
                  </Button>
                </td>
              </tr>
              {open && (
                <tr className="bg-muted/10">
                  <td colSpan={objectActions.length + 2} className="px-12 py-3">
                    <FieldsSubTable
                      objectName={o.name}
                      fields={fieldsByObject[o.name]}
                      fieldsState={draft.fields ?? {}}
                      writable={writable}
                      t={t}
                      onFieldPerm={onFieldPerm}
                    />
                  </td>
                </tr>
              )}
            </React.Fragment>
          );
        })}
      </tbody>
    </table>
  );
}

function FieldsSubTable({
  objectName,
  fields,
  fieldsState,
  writable,
  t,
  onFieldPerm,
}: {
  objectName: string;
  fields: FieldSummary[] | undefined;
  fieldsState: Record<string, FieldPerm>;
  writable: boolean;
  t: (key: string) => string;
  onFieldPerm: (objectName: string, fieldName: string, action: keyof FieldPerm, value: boolean) => void;
}) {
  if (!fields) {
    return (
      <div className="text-xs text-muted-foreground flex items-center gap-2">
        <Loader2 className="h-3 w-3 animate-spin" /> {t('perm.field.loading')}
      </div>
    );
  }
  if (fields.length === 0) {
    return <div className="text-xs text-muted-foreground">{t('perm.field.empty')}</div>;
  }
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="text-muted-foreground">
          <th className="text-left py-1 font-medium">{t('perm.field.col.name')}</th>
          <th className="px-2 py-1 font-medium w-16 text-center" title={t('perm.field.read')}>{t('perm.field.read')}</th>
          <th className="px-2 py-1 font-medium w-16 text-center" title={t('perm.field.edit')}>{t('perm.field.edit')}</th>
        </tr>
      </thead>
      <tbody>
        {fields.map((f) => {
          const key = `${objectName}.${f.name}`;
          const cur = fieldsState[key] ?? { readable: true, editable: false };
          return (
            <tr key={f.name} className="border-t border-muted">
              <td className="py-1">
                {f.label ?? f.name}
                {f.label && (
                  <span className="ml-1 text-muted-foreground">({f.name})</span>
                )}
              </td>
              <td className="px-2 py-1 text-center">
                <Checkbox
                  checked={!!cur.readable}
                  disabled={!writable}
                  onCheckedChange={(v) => onFieldPerm(objectName, f.name, 'readable', !!v)}
                  aria-label={`${objectName}.${f.name} readable`}
                />
              </td>
              <td className="px-2 py-1 text-center">
                <Checkbox
                  checked={!!cur.editable}
                  disabled={!writable}
                  onCheckedChange={(v) => onFieldPerm(objectName, f.name, 'editable', !!v)}
                  aria-label={`${objectName}.${f.name} editable`}
                />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
