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
 *     isProfile?: boolean,
 *     objects: { [object_name]: ObjectPermission },
 *     fields?:  { [`${object_name}.${field_name}`]: FieldPermission },
 *     systemPermissions?: string[],
 *     tabPermissions?: Record<string, 'visible'|'hidden'|'default_on'|'default_off'>,
 *   }
 *
 * Wiring: registered from `builtinComponents.tsx` as
 *   registerMetadataResource({ type: 'permission', EditPage: PermissionMatrixEditPage })
 *
 * The component reads `/api/v1/meta/object` + `/api/v1/meta/field` to
 * enumerate available objects and their fields. Saves through the
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
import { PageShell } from './PageShell';
import { useMetadataClient, useMetadataTypes, type RichMetadataTypeEntry } from './useMetadata';
import { resolveResourceConfig } from './registry';
import { t as translate, detectLocale } from './i18n';
import { AssignedUsersSection } from './AssignedUsersSection';
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
}

/* ────────────────────────────────────────────────────────────────── */
/* Component                                                          */
/* ────────────────────────────────────────────────────────────────── */

export function PermissionMatrixEditPage({ type, name, packageId, onDraftSaved, publishNonce }: PermissionMatrixEditPageProps) {
  const navigate = useNavigate();
  const client = useMetadataClient();
  const { entries } = useMetadataTypes(client);
  const entry: RichMetadataTypeEntry | undefined = entries.find((t) => t.type === type);
  const resolved = resolveResourceConfig(type, entry);
  const writable = !!resolved.allowOrgOverride;
  const locale = React.useMemo(() => detectLocale(), []);
  const t = React.useCallback((k: string) => translate(k, locale), [locale]);
  const OBJECT_ACTIONS = React.useMemo(() => getObjectActions(locale), [locale]);

  const [draft, setDraft] = React.useState<PermissionSetDraft>({
    name,
    objects: {},
    fields: {},
  });
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
            return { name: String(item?.name ?? ''), label: item?.label };
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
          setDraft({ ...full, objects: sliced.objects, fields: sliced.fields });
        } else {
          setDraft(full);
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
  }, [client, type, name, packageId, publishNonce]);

  /* ── Lazy-load fields when an object is expanded ─────────── */
  async function ensureFields(objectName: string) {
    if (fieldsByObject[objectName]) return;
    try {
      // Fields are stored as `${object}__${field}` keys under the
      // `field` metadata type. We resolve by listing then filtering
      // on the `object` attribute of the item.
      const items = await client.list<any>('field');
      const list: FieldSummary[] = ((items as any[]) ?? [])
        .map((row) => row?.item ?? row)
        .filter((f) => String(f?.object ?? '') === objectName)
        .map((f) => ({ name: String(f?.name ?? ''), label: f?.label }))
        .filter((f) => !!f.name)
        .sort((a, b) => a.name.localeCompare(b.name));
      setFieldsByObject((prev) => ({ ...prev, [objectName]: list }));
    } catch {
      setFieldsByObject((prev) => ({ ...prev, [objectName]: [] }));
    }
  }

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
        setDraft(toDisplayDraft(toSave));
        onDraftSaved?.();
      } else {
        const lay = await client.layered<PermissionSetDraft>(type, payload.name);
        setDraft(toDisplayDraft((lay.effective ?? toSave) as PermissionSetDraft));
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
      subtitle={draft.isProfile ? t('perm.subtitle.profile') : t('perm.subtitle.set')}
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
            <Button size="sm" onClick={() => doSave(false)} disabled={saving}>
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

        {/* Header strip — name / label / isProfile */}
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
          <div className="flex items-center gap-2 pb-1">
            <Switch
              id="perm-is-profile"
              checked={!!draft.isProfile}
              disabled={!writable}
              onCheckedChange={(v) => setDraft((p) => ({ ...p, isProfile: !!v }))}
            />
            <Label htmlFor="perm-is-profile" className="text-xs">{t('perm.field.isProfile')}</Label>
          </div>
          {!writable && (
            <Badge variant="secondary" className="ml-auto">
              {t('perm.readOnly')}
            </Badge>
          )}
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
          />
        </div>
        {/* Manage Assignments — generic "Assigned Users" via the related-list
            primitive (works for every permission set; `ai_seat` is one of them). */}
        <div className="shrink-0 border-t max-h-80 overflow-auto bg-background">
          <AssignedUsersSection permissionSetName={name} />
        </div>
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
