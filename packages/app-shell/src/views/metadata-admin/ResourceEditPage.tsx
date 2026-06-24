// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * MetadataResourceEditPage — generic AutoForm-driven editor (Phase 3c).
 *
 * What it does:
 *   1. Fetches the layered view (`?layers=true`) so the user sees code
 *      vs overlay vs effective.
 *   2. Renders a SchemaForm against the JSONSchema in the type's
 *      `/meta/types` registry row.
 *   3. Save → PUT, with automatic destructive-change handling: a 409
 *      `destructive_change` response opens a confirmation dialog
 *      listing the issues, and on confirm we retry with `?force=true`.
 *   4. Reset overlay → DELETE (overlay only).
 *   5. References tab → calls `client.references()` and lists
 *      back-pointers so admins know what will break before deleting.
 *
 * Works for any of the 27 metadata types — bespoke editors (Object,
 * Field, View, Permission Matrix) opt out by registering a custom
 * EditPage via `registerMetadataResource()`.
 */

import * as React from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Save,
  RotateCcw,
  Trash2,
  History,
  Link2,
  Loader2,
  AlertTriangle,
  Layers3,
  GitCompareArrows,
  Boxes,
  Eye,
  Pencil,
  X,
  PanelRightClose,
  PanelRightOpen,
  Maximize2,
  Minimize2,
  MousePointer2,
  SlidersHorizontal,
  FileCode2,
  Zap,
  ZapOff,
  Send,
  Undo2,
  Lock,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@object-ui/components';
import { Badge } from '@object-ui/components';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@object-ui/components';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@object-ui/components';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@object-ui/components';
import { Empty, EmptyTitle, EmptyDescription } from '@object-ui/components';
import type {
  MetadataLayered,
  MetadataReference,
} from '@object-ui/data-objectstack';
import { PageShell } from './PageShell';
import { MetadataTypeActions } from './MetadataTypeActions';
import { LayeredDiff, countOverlaidFields } from './LayeredDiff';
import { DraftReviewPanel, computeDraftChangeCount } from './DraftReviewPanel';
import { SchemaForm, type SchemaFormIssue } from './SchemaForm';
import {
  useMetadataClient,
  useMetadataTypes,
  type RichMetadataTypeEntry,
} from './useMetadata';
import {
  getMetadataResource,
  resolveResourceConfig,
  listAnchorsFor,
} from './registry';
import { useCreateDerive, deriveDefaultCreateFields } from './createDerive';
import { RelatedPanel, type RelatedTarget } from './RelatedPanel';
import { MetadataDetailDrawer } from './MetadataDetailDrawer';
import { HistoryPanel } from './ResourceHistoryPage';
import { AuditPanel } from './AuditPanel';
import { getMetadataPreview, type MetadataSelection } from './preview-registry';
import { readFields } from './previews/object-fields-io';
import { useRegisterAssistantEditor, type AssistantEditorContext } from '../../assistant/assistantBus';
import { getMetadataInspector } from './inspector-registry';
import { getMetadataDefaultInspector } from './default-inspector-registry';
import { detectLocale, t, tFormat, translateValidationMessage } from './i18n';
import { JsonSourceEditor } from './JsonSourceEditor';
import { validateMetadataDraft, hasClientValidator } from './clientValidation';
import { describeIssuePath } from './issuePath';
import { buildCreateModeBody } from './createBody';

// react-resizable-panels' `direction` prop type does not always narrow
// cleanly in our TS config; cast at the boundary (precedent:
// packages/components/src/custom/navigation-overlay.tsx).
const PanelGroup = ResizablePanelGroup as React.FC<any>;

/**
 * Metadata types whose canvas IS the primary create-time authoring
 * surface, so we render the preview/inspector split during create
 * instead of the centered basic-info form. Object-level basics stay
 * editable via the no-selection default inspector. Other types keep
 * the conventional "name it first, design after save" create flow.
 */
const CREATE_MODE_CANVAS_TYPES = new Set<string>(['object', 'report', 'dataset']);

/**
 * Top-level metadata keys that a type's canvas PreviewComponent owns and
 * edits visually (e.g. the object designer owns `fields` + `fieldGroups`).
 * These must never surface in the inspector's fallback SchemaForm — the
 * no-selection panel would otherwise render a raw JSON editor for data
 * the user is already editing on the canvas.
 */
const CANVAS_OWNED_KEYS: Record<string, string[]> = {
  object: ['fields', 'fieldGroups'],
};

/**
 * Normalize the framework's draft envelope into either the draft body or
 * `null` (no pending draft). The envelope is:
 *
 *   - `{ type, name, item: {...} }` when a draft exists,
 *   - `{ type, name, label }`       when no draft exists (HTTP 200, item absent).
 *
 * The presence of the `item` key is the single signal; we do NOT fall back
 * to using the envelope itself as the body — doing so would mis-identify the
 * "no draft" stub (which still has `type`/`name`/`label` keys) as a real
 * pending draft and would corrupt the editor baseline.
 */
function extractDraftBody(
  draftResp: unknown,
): Record<string, unknown> | null {
  if (!draftResp || typeof draftResp !== 'object') return null;
  const env = draftResp as Record<string, unknown>;
  if (!('item' in env)) return null;
  const body = env.item;
  if (!body || typeof body !== 'object') return null;
  return Object.keys(body as object).length > 0
    ? (body as Record<string, unknown>)
    : null;
}

/**
 * Decide whether the validation-diagnostics banner should render at all.
 *
 * The gate has two reasons to stay hidden:
 *   - `loadFailed` — the layered/draft fetch itself failed, so the form is
 *     sitting on empty defaults. Any required-field issues the client
 *     validator produces are an artefact of the empty form, not a verdict on
 *     the item; the explicit "failed to load" banner already tells the real
 *     story. Suppress so a transport failure never masquerades as a broken
 *     item.
 *   - no diagnostics source — there is neither a server `_diagnostics`
 *     payload nor a client-side validator for this type, so there is nothing
 *     to show.
 */
export function shouldRenderDiagnostics(opts: {
  loadFailed: boolean;
  hasDiag: boolean;
  hasClientValidator: boolean;
}): boolean {
  if (opts.loadFailed) return false;
  return opts.hasDiag || opts.hasClientValidator;
}

export interface MetadataResourceEditPageProps {
  type?: string;
  name?: string;
  /** When true, this is the Create flow (skip initial fetch). */
  createMode?: boolean;
  /**
   * When true, the editor is rendered inside another surface (e.g.
   * the Related drawer). Hides Related-tab and URL-sync so the inner
   * page does not fight the outer page for `?tab` / `?open`.
   */
  embedded?: boolean;
}

export function MetadataResourceEditPage({
  type: typeProp,
  name: nameProp,
  createMode = false,
  embedded = false,
}: MetadataResourceEditPageProps) {
  // Tiny dispatcher: a registered Custom EditPage / CreatePage is a
  // different component type than MetadataResourceEditPageImpl, so React
  // will unmount/remount when the registry-driven branch wins or loses
  // (e.g. navigating from `/object/new` → `/object/sales_order`). Doing
  // the dispatch INSIDE the impl below would leak hooks between
  // branches and trigger "Rendered more hooks than during the previous
  // render". We therefore keep this outer dispatcher hook-free apart
  // from `useParams`, which is unconditional.
  const params = useParams<{ type?: string; name?: string }>();
  const type = typeProp ?? params.type ?? '';
  const name = nameProp ?? params.name ?? '';

  const customConfig = getMetadataResource(type);
  if (customConfig?.EditPage && !createMode) {
    const Custom = customConfig.EditPage;
    return <Custom type={type} name={name} />;
  }
  if (customConfig?.CreatePage && createMode) {
    const Custom = customConfig.CreatePage;
    return <Custom type={type} />;
  }

  return (
    <MetadataResourceEditPageImpl
      type={type}
      name={name}
      createMode={createMode}
      embedded={embedded}
    />
  );
}

interface MetadataResourceEditPageImplProps {
  type: string;
  name: string;
  createMode: boolean;
  embedded: boolean;
}

function MetadataResourceEditPageImpl({
  type,
  name,
  createMode,
  embedded,
}: MetadataResourceEditPageImplProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  // ADR-0048 — the owning package of the item being edited, carried on the
  // edit URL as `?package=` (emitted by the metadata list links). Scopes the
  // layered/draft read so a same-name collision resolves to the right
  // package's item. NOT the active Studio app's package — Studio edits items
  // across all installed packages.
  const ownerPackageId = searchParams.get('package') ?? undefined;
  const client = useMetadataClient();
  const { entries } = useMetadataTypes(client);
  const entry: RichMetadataTypeEntry | undefined = entries.find((t) => t.type === type);
  const config = resolveResourceConfig(type, entry);
  // Hoist `schema` to the top: it's a pure derivation of entry/config
  // and several create-mode hooks below need it. Keeping it down here
  // would put those hooks *after* the loading early-return, which
  // breaks the rules of hooks when navigating new→edit (a different
  // number of hooks runs across renders of the same instance).
  const schema =
    (createMode && config.createSchema
      ? config.createSchema
      : (entry?.schema as Record<string, unknown> | undefined)) ??
    (config.defaultSchema as Record<string, unknown> | undefined);
  const locale = React.useMemo(() => detectLocale(), []);

  const [layered, setLayered] = React.useState<MetadataLayered<any> | null>(null);
  const identityField = config.identityField ?? 'name';
  const [draft, setDraft] = React.useState<Record<string, unknown>>(() =>
    createMode ? { ...(config.createDefaults ?? {}), [identityField]: '' } : {},
  );
  const [refs, setRefs] = React.useState<MetadataReference[] | null>(null);
  const [loading, setLoading] = React.useState(!createMode);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  // Distinguishes "the layered/draft fetch itself failed" (network/500/
  // timeout) from "we loaded an item that fails validation". Without it a
  // failed load renders the form with empty defaults and the client
  // validator fires spurious "name/label/regions required" diagnostics,
  // making a transport failure look like a structurally broken item. Set
  // in the load catch block, reset at the start of each load.
  const [loadFailed, setLoadFailed] = React.useState(false);
  const [issues, setIssues] = React.useState<SchemaFormIssue[]>([]);
  // In create mode, hold back validation noise until the author has actually
  // edited a field. A blank new-item form firing 3 red "required" errors before
  // the user types anything reads as broken, not helpful (the save path still
  // validates). Flips true on the first real edit.
  const [createDirty, setCreateDirty] = React.useState(false);

  // Wrap setDraft so that editing a field clears any *server-side*
  // diagnostic issues whose path begins with that field. The user
  // gets immediate visual feedback — the red ring disappears as
  // they type — and the form re-validates on save. We diff at the
  // top-level segment, which matches how Zod's `issue.path[0]`
  // identifies the offending field.
  const handleDraftChange = React.useCallback(
    (next: Record<string, unknown> | ((prev: Record<string, unknown>) => Record<string, unknown>)) => {
      setDraft((prev) => {
        const resolved = typeof next === 'function' ? next(prev) : next;
        const changed = new Set<string>();
        const keys = new Set([...Object.keys(prev ?? {}), ...Object.keys(resolved ?? {})]);
        for (const k of keys) {
          if (!Object.is(prev?.[k], resolved?.[k])) changed.add(k);
        }
        if (changed.size > 0) {
          setCreateDirty(true);
          setIssues((prevIssues) =>
            prevIssues.filter((i) => {
              const head = (i.path ?? '').split('.')[0];
              return !changed.has(head);
            }),
          );
        }
        return resolved;
      });
    },
    [],
  );
  const [destructiveIssues, setDestructiveIssues] = React.useState<
    null | Array<{ kind?: string; path?: string; message?: string }>
  >(null);
  const [pendingItem, setPendingItem] = React.useState<unknown>(null);

  // ── Create-mode form harness ──────────────────────────────────────
  //
  // Apply the registry's `createDerive` rules live (label→name slug,
  // singular→plural, etc.). The hook is a no-op when not in create
  // mode or when no rules are declared, so we always mount it.
  const onCreatePatch = React.useCallback(
    (patch: Partial<Record<string, unknown>>) => {
      handleDraftChange((d) => ({ ...(d as Record<string, unknown>), ...patch }));
    },
    [handleDraftChange],
  );
  const { markTouched: markCreateFieldTouched } = useCreateDerive({
    rules: config.createDerive,
    draft,
    onPatch: onCreatePatch,
    enabled: !!createMode,
  });

  // Effective hidden-fields for create mode: collapse the form to just
  // the identity inputs declared by the type (or required-fields ∪
  // label/name as a sensible default). Edit mode keeps the full form.
  //
  // The complement-set is what SchemaForm consumes (it hides paths
  // listed in `hiddenFields`), so we invert the allowlist here.
  const createFieldList = React.useMemo(() => {
    if (!createMode) return undefined;
    if (config.createFields && config.createFields.length > 0) return config.createFields;
    const props = (schema?.properties as Record<string, unknown> | undefined) ?? undefined;
    const required = (schema?.required as readonly string[] | undefined) ?? undefined;
    return deriveDefaultCreateFields(props, required);
  }, [createMode, config.createFields, schema]);

  const effectiveHiddenFields = React.useMemo<string[] | undefined>(() => {
    // Keys edited on the canvas (fields, fieldGroups) are never shown in
    // the inspector's SchemaForm fallback — otherwise deselecting reveals
    // a raw JSON editor for data the canvas already owns.
    const canvasOwned = CANVAS_OWNED_KEYS[type] ?? [];
    if (!createMode || !createFieldList) {
      if (canvasOwned.length === 0) return config.hiddenFields;
      return Array.from(new Set([...(config.hiddenFields ?? []), ...canvasOwned]));
    }
    const props = (schema?.properties as Record<string, unknown> | undefined) ?? {};
    const allow = new Set(createFieldList);
    const hidden = Object.keys(props).filter((k) => !allow.has(k));
    // Preserve any registry-declared `hiddenFields` too — they remain
    // hidden in create mode even if they appeared in `createFields`.
    if (config.hiddenFields) {
      for (const k of config.hiddenFields) if (!hidden.includes(k)) hidden.push(k);
    }
    // Canvas-owned keys are hidden regardless of the create allowlist.
    for (const k of canvasOwned) if (!hidden.includes(k)) hidden.push(k);
    return hidden;
  }, [createMode, createFieldList, schema, config.hiddenFields, type]);

  const effectiveFieldOrder = React.useMemo<string[] | undefined>(() => {
    if (createMode && createFieldList) return createFieldList;
    return config.fieldOrder;
  }, [createMode, createFieldList, config.fieldOrder]);

  // Mark a top-level field as user-touched so create-mode derivations
  // (label→name slug, etc.) leave it alone going forward. Wraps the
  // standard onChange so the rest of the form is unaffected.
  const handleCreateAwareChange = React.useCallback(
    (next: Record<string, unknown> | ((prev: Record<string, unknown>) => Record<string, unknown>)) => {
      if (createMode) {
        const before = draft;
        const resolved = typeof next === 'function' ? next(before) : next;
        const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(resolved ?? {})]);
        for (const k of keys) {
          if (!Object.is(before?.[k], resolved?.[k])) markCreateFieldTouched(k);
        }
      }
      handleDraftChange(next);
    },
    [createMode, draft, handleDraftChange, markCreateFieldTouched],
  );
  // Live client-side Zod validation. Debounced 200ms so we don't run
  // on every keystroke through a complex AutoForm tree. When a client
  // schema exists for `type` (spec 7.x exports per-type schemas under
  // /data, /ui, /automation, /ai, /system, /kernel), we replace the
  // `issues` state with Zod's output — same schemas the server runs,
  // so behavior matches the post-save diagnostics but appears live.
  // Types without a client schema keep the existing server-only flow.
  React.useEffect(() => {
    if (!hasClientValidator(type)) return;
    let cancelled = false;
    const handle = window.setTimeout(() => {
      // Pass the live server schema so the client never flags fields the
      // running server now treats as optional (cross-repo spec-skew root-cure).
      void validateMetadataDraft(type, draft, entry?.schema as { required?: unknown } | undefined).then((res) => {
        if (cancelled) return;
        setIssues(res.issues);
      });
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [type, draft, entry?.schema]);
  // Issues to DISPLAY (banner + inline). Suppressed on a pristine create form
  // so a blank new item doesn't open covered in required-field errors.
  const displayIssues = React.useMemo(
    () => (createMode && !createDirty ? [] : issues),
    [createMode, createDirty, issues],
  );
  // Per-item draft pending publish (mode=draft saves land here).
  // When non-null, the editor is "viewing the draft" and we surface
  // Publish / Discard-draft actions.
  const [hasDraft, setHasDraft] = React.useState(false);
  const [publishing, setPublishing] = React.useState(false);
  // Bumped by destructive operations (rollback / discard-draft) to
  // force the load effect to refetch layered + draft state.
  const [reloadKey, setReloadKey] = React.useState(0);

  // Form edit mode. The form is read-only by default — admins land in a
  // "view" state and must click Edit to mutate, mirroring the Salesforce /
  // Notion convention. createMode is always editing (you can't view what
  // doesn't exist yet). Truly read-only types (no allowOrgOverride) stay
  // read-only regardless.
  const [editing, setEditing] = React.useState<boolean>(!!createMode);
  // Currently selected sub-element (e.g. a dashboard widget). The
  // preview emits this; the inspector consumes it. Must live above
  // any early returns to preserve hook order — reset on item
  // navigation or when leaving edit mode below.
  const [selection, setSelection] = React.useState<MetadataSelection | null>(null);
  React.useEffect(() => {
    setSelection(null);
  }, [type, name]);
  React.useEffect(() => {
    if (!editing) setSelection(null);
  }, [editing]);
  // Snapshot of the last saved draft. Used by Cancel to revert in-flight
  // edits, and as the source-of-truth when entering edit mode.
  const draftSnapshotRef = React.useRef<Record<string, unknown> | null>(null);

  // Last successful save timestamp — surfaced as "Saved HH:MM" indicator
  // next to the icon-only Save button.
  const [lastSavedAt, setLastSavedAt] = React.useState<Date | null>(null);

  // Auto-save toggle, persisted per-browser. Defaults to on for an
  // "it just works" experience; users can disable it from the toolbar.
  const [autoSaveEnabled, setAutoSaveEnabled] = React.useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    try {
      const v = window.localStorage.getItem('metadata-admin:autosave');
      return v === null ? true : v === '1';
    } catch {
      return true;
    }
  });
  React.useEffect(() => {
    try {
      window.localStorage.setItem('metadata-admin:autosave', autoSaveEnabled ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [autoSaveEnabled]);
  // Tracks the last draft snapshot we attempted to auto-save, so a
  // validation failure does not loop on the same payload — auto-save
  // only retries once the user mutates the draft again.
  const lastAutoSaveSnapshotRef = React.useRef<string | null>(null);

  // Prefetch object name list once — fuels the `ref:object` widget.
  // We don't block render on it; the widget shows a "Loading…" state.
  const [objectNames, setObjectNames] = React.useState<string[]>([]);
  const [objectsLoading, setObjectsLoading] = React.useState(true);
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = (await client.list('object')) as Array<{ name?: string }>;
        if (cancelled) return;
        setObjectNames(
          list.map((x) => x?.name).filter((n): n is string => !!n).sort(),
        );
      } catch {
        if (!cancelled) setObjectNames([]);
      } finally {
        if (!cancelled) setObjectsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client]);
  // Field catalog of the draft's bound/source object — fuels field-picker
  // widgets (e.g. the interface-page filter-mode selector). For a page the
  // source is `interfaceConfig.source` (interface mode) or the bound
  // `object`; other types fall back to their own `object`/`objectName`.
  const sourceObjectName: string | undefined =
    ((draft as any)?.interfaceConfig?.source as string | undefined) ||
    ((draft as any)?.object as string | undefined) ||
    ((draft as any)?.objectName as string | undefined);
  const [objectFields, setObjectFields] = React.useState<Array<{ name: string; label?: string; type?: string }>>([]);
  const [objectFieldsLoading, setObjectFieldsLoading] = React.useState(false);
  // Action catalog of the source object — fuels the `action-multi` picker so
  // interface-page `buttons` reference the object's real actions.
  const [objectActions, setObjectActions] = React.useState<Array<{ name: string; label?: string; locations?: string[] }>>([]);
  React.useEffect(() => {
    let cancelled = false;
    if (!sourceObjectName) { setObjectFields([]); setObjectActions([]); return; }
    setObjectFieldsLoading(true);
    (async () => {
      try {
        const obj = (await client.get('object', sourceObjectName)) as { fields?: Record<string, any> | Array<any> } | null;
        if (cancelled) return;
        const raw = obj?.fields;
        const list = Array.isArray(raw)
          ? raw.map((f: any) => ({ name: f?.name, label: f?.label, type: f?.type }))
          : raw && typeof raw === 'object'
            ? Object.entries(raw).map(([name, f]: [string, any]) => ({ name, label: f?.label, type: f?.type }))
            : [];
        setObjectFields(list.filter((f) => !!f.name));
        const rawActions = (obj as any)?.actions;
        const acts = Array.isArray(rawActions)
          ? rawActions.map((a: any) => ({ name: a?.name, label: a?.label, locations: a?.locations })).filter((a: any) => !!a.name)
          : [];
        if (!cancelled) setObjectActions(acts);
      } catch {
        if (!cancelled) { setObjectFields([]); setObjectActions([]); }
      } finally {
        if (!cancelled) setObjectFieldsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [client, sourceObjectName]);

  // View catalog of the source object — fuels the `view-ref` picker for
  // `interfaceConfig.sourceView` so the author chooses an existing view
  // instead of typing (and mistyping) a name. Views are standalone metadata
  // keyed to their object via `objectName`/`object`; the LIST endpoint returns
  // name + label, which is all the picker needs.
  const [objectViews, setObjectViews] = React.useState<Array<{ name: string; label?: string }>>([]);
  const [objectViewsLoading, setObjectViewsLoading] = React.useState(false);
  React.useEffect(() => {
    let cancelled = false;
    if (!sourceObjectName) { setObjectViews([]); return; }
    setObjectViewsLoading(true);
    (async () => {
      try {
        const all = (await client.list('view')) as Array<Record<string, any>>;
        if (cancelled) return;
        const forObject = (all || []).filter((v) => {
          const obj = v?.objectName ?? v?.object ?? v?.object_name;
          return obj === sourceObjectName;
        });
        const seen = new Set<string>();
        const list = forObject
          .map((v) => ({ name: v?.name as string, label: (v?.label as string) || undefined }))
          .filter((v) => !!v.name && !seen.has(v.name) && seen.add(v.name));
        setObjectViews(list);
      } catch {
        if (!cancelled) setObjectViews([]);
      } finally {
        if (!cancelled) setObjectViewsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [client, sourceObjectName]);

  const widgetContext = React.useMemo(
    () => ({ objectNames, objectsLoading, objectFields, objectFieldsLoading, objectViews, objectViewsLoading, objectActions }),
    [objectNames, objectsLoading, objectFields, objectFieldsLoading, objectViews, objectViewsLoading, objectActions],
  );

  // Load layered view + initial draft.
  React.useEffect(() => {
    if (createMode) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setLoadFailed(false);
    (async () => {
      try {
        const scope = ownerPackageId ? { packageId: ownerPackageId } : {};
        const [lay, draftResp] = await Promise.all([
          client.layered<any>(type, name, scope),
          // Draft reads are best-effort — a 404/error must not block
          // the page; readers without overlay-write permission still
          // see the published item.
          client.getDraft<any>(type, name, scope).catch(() => null),
        ]);
        if (cancelled) return;
        setLayered(lay);
        // Surface server-computed load-time validation errors as inline
        // SchemaForm issues — operators see what's wrong with the
        // saved metadata immediately, not just on the next Save round-trip.
        const loadDiag = (lay as any)?._diagnostics as
          | { valid: boolean; errors?: Array<{ path: string; message: string }> }
          | undefined;
        if (loadDiag && loadDiag.valid === false && Array.isArray(loadDiag.errors)) {
          setIssues(
            loadDiag.errors.map((e) => ({
              path: e.path || '',
              message: e.message,
            })),
          );
        } else {
          setIssues([]);
        }
        // Draft envelope from the framework is `{ type, name, item }`;
        // an empty/missing item means "no pending draft".
        const draftReal = extractDraftBody(draftResp);
        // Prefer the pending draft as the editing baseline — the
        // operator is mid-flight on this item and should see their
        // own in-progress state, not the last published version.
        // A pending draft overlay can carry only the edited fields, so using
        // it wholesale would drop inherited fields that were never touched —
        // notably `type`, which section-level `visibleOn` predicates depend on
        // (ADR-0047 hides Data Context / Layout when `data.type == 'list'`).
        // Merge the draft over the effective baseline so those fields survive;
        // the draft still wins for anything it does carry.
        const baseline = (lay.effective ?? lay.code ?? {}) as Record<string, unknown>;
        const rawInitial: Record<string, unknown> = draftReal
          ? { ...baseline, ...(draftReal as Record<string, unknown>) }
          : baseline;
        // Normalise the wire shape into the editor's draft shape (e.g.
        // `view` unwraps an expanded ViewItem's `config` into a
        // `{ list | form }` family key). No-op for types without a hook.
        const initial = config.toDraft ? config.toDraft(rawInitial) : rawInitial;
        setDraft(initial);
        draftSnapshotRef.current = initial;
        setHasDraft(!!draftReal);
        setLoading(false);
      } catch (err: any) {
        if (!cancelled) {
          // A failed fetch is a LOAD error, not a validation error: flag it
          // so the diagnostics banner suppresses the spurious required-field
          // issues the empty-default form would otherwise produce, and make
          // the top error banner explicit about what actually went wrong.
          setLoadFailed(true);
          setError(
            tFormat('engine.edit.loadFailed', locale, {
              type,
              name: name ?? '',
              message: err?.message ?? String(err),
            }),
          );
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client, type, name, ownerPackageId, createMode, reloadKey, locale]);

  // Lazy-load references the first time the References sheet opens.
  const [refsLoading, setRefsLoading] = React.useState(false);
  async function loadReferences() {
    if (refs != null || refsLoading) return;
    setRefsLoading(true);
    try {
      const r = await client.references(type, name);
      setRefs(r);
    } catch (err: any) {
      // Surface as empty list; non-blocking.
      setRefs([]);
      console.error('references() failed', err);
    } finally {
      setRefsLoading(false);
    }
  }

  // Related drawer state. `null` = closed. We avoid querystring round-
  // trips on every keystroke; URL state is best-effort sync via effect
  // below.
  const [relatedTarget, setRelatedTarget] = React.useState<RelatedTarget | null>(null);

  const hasAnchors = React.useMemo(
    () => !createMode && !embedded && listAnchorsFor(type).length > 0,
    [type, createMode, embedded],
  );

  // Read ?tab and ?open on first mount so deep-links work. Embedded
  // items are not deep-linkable (they live in the parent body and need
  // the parent payload to materialise) so we only restore metadata
  // targets here.
  const initialTabRef = React.useRef<string | null>(null);

  const [openSheet, setOpenSheet] =
    React.useState<'layers' | 'references' | 'related' | 'history' | 'audit' | 'review' | null>(null);

  // ADR-0033 Phase B — `?review=1` arrival (from the chat's "Review N change(s)"
  // affordance). The AI may have drafted this item *after* the page mounted, so
  // we first force a fresh fetch, then — once the draft is loaded — open the
  // generic review/diff sheet and consume the query param (so a refresh/back
  // doesn't re-trigger it). The same-item-already-open case is covered by the
  // reload bump (the load effect keys off `reloadKey`, not the search string).
  const reviewParam = searchParams.get('review');
  const reviewBumpedRef = React.useRef(false);
  React.useEffect(() => {
    if (reviewParam !== '1' || createMode) return;
    if (!reviewBumpedRef.current) {
      reviewBumpedRef.current = true;
      setReloadKey((k) => k + 1);
      return; // wait for the reload to settle before reading hasDraft
    }
    if (!loading) {
      if (hasDraft) setOpenSheet('review');
      const next = new URLSearchParams(searchParams);
      next.delete('review');
      setSearchParams(next, { replace: true });
      reviewBumpedRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviewParam, createMode, loading, hasDraft]);

  // Inspector tabs: properties form vs raw JSON source view. Source view
  // is for power users who need to edit fields the form doesn't expose
  // (e.g. nested arrays). Tracked locally — not persisted between
  // navigations since most users live in the form 99% of the time.
  const [inspectorTab, setInspectorTab] =
    React.useState<'properties' | 'source'>('properties');

  // When the References sheet opens, lazy-load the data (idempotent).
  // Also keep the URL `?tab=` query in sync so deep-links round-trip.
  React.useEffect(() => {
    if (openSheet === 'references') {
      void loadReferences();
    }
    if (typeof window !== 'undefined' && !embedded) {
      const url = new URL(window.location.href);
      if (openSheet) url.searchParams.set('tab', openSheet);
      else url.searchParams.delete('tab');
      window.history.replaceState({}, '', url.toString());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openSheet, embedded]);

  // Designer-style split-panel state. The inspector (right form panel)
  // can collapse to give the preview the full canvas. The collapsed
  // state is persisted in localStorage so the user's preference sticks
  // across navigations.
  const inspectorStorageKey = 'metadata-edit:inspector-collapsed';
  const inspectorSizeStorageKey = 'metadata-edit:inspector-size';
  const [inspectorCollapsed, setInspectorCollapsed] = React.useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(inspectorStorageKey) === '1';
  });
  // Remember the user's preferred inspector size so collapsing then
  // re-expanding restores it instead of leaving a sliver. react-resizable-
  // panels' built-in expand() returns to the size right before collapse
  // which is often near 0, hence the explicit memory.
  const lastInspectorSizeRef = React.useRef<number>(38);
  // Hydrate from localStorage on mount.
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const v = Number(window.localStorage.getItem(inspectorSizeStorageKey));
    if (Number.isFinite(v) && v >= 22 && v <= 80) {
      lastInspectorSizeRef.current = v;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inspectorPanelRef = React.useRef<any>(null);
  const toggleInspector = React.useCallback(() => {
    setInspectorCollapsed((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(inspectorStorageKey, next ? '1' : '0');
      }
      return next;
    });
  }, []);
  // Drive the imperative panel resize from a state-change effect rather
  // than inside the setter — the latter runs before React has committed
  // the new state and react-resizable-panels can race with its own
  // onResize observer, producing tiny re-expanded sizes.
  // ⚠️ resize() treats numeric values as **pixels**; pass a string to
  // get a percentage. resize(38) → 38px (~2.7%); resize('38%') → 38%.
  React.useEffect(() => {
    const handle = inspectorPanelRef.current;
    if (!handle) return;
    if (inspectorCollapsed) {
      handle.resize?.('0%');
    } else {
      const target = lastInspectorSizeRef.current || 38;
      handle.resize?.(`${target}%`);
    }
  }, [inspectorCollapsed]);

  // Canvas-local UX state — preview-only view (hides design chrome
  // without dropping dirty edits) and fullscreen (canvas takes over the
  // viewport so designers can focus). Both are session-scoped.
  const [previewOnly, setPreviewOnly] = React.useState(false);
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  // Lock body scroll while fullscreen so the underlying page can't peek
  // through and the user's scroll position is preserved on exit.
  React.useEffect(() => {
    if (typeof document === 'undefined') return;
    if (!isFullscreen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isFullscreen]);
  // Escape exits fullscreen.
  React.useEffect(() => {
    if (typeof window === 'undefined' || !isFullscreen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsFullscreen(false);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isFullscreen]);

  // Auto-enable design mode for designer-capable types. We do this once
  // per (type,name) navigation so the user lands in the productive
  // state instead of having to click "Edit". Truly read-only types
  // (canWrite=false) keep the old behavior. The check happens inside
  // the effect to avoid hook-order issues with the early `loading`
  // return below.
  const designerAutoOnRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    designerAutoOnRef.current = null;
  }, [type, name]);
  React.useEffect(() => {
    if (createMode || embedded || loading) return;
    const key = `${type}/${name ?? ''}`;
    if (designerAutoOnRef.current === key) return;
    const PC = getMetadataPreview(type);
    if (!PC) return;
    // See `isArtifactItem` below — a `sys_metadata`-tagged code layer is a
    // published org object, NOT a packaged artifact, so it stays editable.
    const isArtifact =
      layered?.code != null
      && (layered.code as { _packageId?: string } | null)?._packageId !== 'sys_metadata';
    const cw = isArtifact
      ? !!entry?.allowOrgOverride
      : !!(entry?.allowOrgOverride || entry?.allowRuntimeCreate);
    if (!cw) return;
    designerAutoOnRef.current = key;
    setEditing(true);
  }, [type, name, createMode, embedded, loading, entry, layered]);

  // Keyboard shortcut: Cmd/Ctrl+\ toggles the inspector. This is the
  // designer convention shared by Figma, VS Code (Cmd+B), Sketch — `\`
  // sits next to Return so it's reachable one-handed.
  React.useEffect(() => {
    if (typeof window === 'undefined' || embedded) return;
    function onKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod || e.shiftKey || e.altKey) return;
      if (e.key !== '\\') return;
      // Ignore when typing in an editor (textarea / contenteditable).
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      e.preventDefault();
      toggleInspector();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [embedded, toggleInspector]);

  React.useEffect(() => {
    if (typeof window === 'undefined' || embedded) return;
    const sp = new URLSearchParams(window.location.search);
    const tab = sp.get('tab');
    if (tab === 'layers' || tab === 'references' || tab === 'related' || tab === 'audit') {
      setOpenSheet(tab);
    }
    initialTabRef.current = tab;
    const open = sp.get('open');
    if (open && open.includes(':')) {
      const [t, n] = open.split(':', 2);
      if (t && n) setRelatedTarget({ kind: 'metadata', type: t, name: n });
    }
    // intentionally empty deps — first mount only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reflect drawer target into the URL so refresh/share works.
  React.useEffect(() => {
    if (typeof window === 'undefined' || embedded) return;
    const url = new URL(window.location.href);
    if (relatedTarget?.kind === 'metadata') {
      url.searchParams.set('open', `${relatedTarget.type}:${relatedTarget.name}`);
    } else {
      url.searchParams.delete('open');
    }
    window.history.replaceState({}, '', url.toString());
  }, [relatedTarget, embedded]);

  function labelForIssuePath(path: string): string {
    const key = path.split('.')[0];
    if (!key) return path;
    // Resolve the human label for the HEAD segment from the form/schema.
    const headLabel = ((): string => {
      const formForLabels = (createMode && config.createSchema ? undefined : (entry?.form as any));
      const sections = Array.isArray(formForLabels?.sections) ? formForLabels.sections : [];
      for (const section of sections) {
        const fields = Array.isArray(section?.fields) ? section.fields : [];
        for (const field of fields) {
          if (typeof field === 'string') {
            if (field === key) return field;
          } else if (field?.field === key) {
            return String(field.label ?? key);
          }
        }
      }
      const props = (schema?.properties ?? {}) as Record<string, any>;
      return String(props[key]?.title ?? key);
    })();
    // For a NESTED path (e.g. `widgets.2.layout`) append a readable trail naming
    // the offending element + sub-field, so a terse "Widgets: Invalid input"
    // becomes "Widgets → priority_split → layout".
    return describeIssuePath(headLabel, path, draft);
  }

  async function doSave(force: boolean) {
    setSaving(true);
    setError(null);
    setIssues([]);
    try {
      // Ensure identity is set on create, and that any `createDefaults`
      // / `createBuildBody` shape (e.g. `{ fields: {} }` for object,
      // or `{ list: { data: { object } } }` for view) is present so
      // the saved body satisfies its JSONSchema. User-supplied values
      // always win over the defaults.
      // Prefer the server's authoritative create seed (from /meta/types — the
      // single source of truth in @objectstack/spec) over the locally hardcoded
      // createDefaults, so the create shape can't drift from the spec's required
      // fields (the dashboard-`layout` / action-`body` 422 family). `createSeed`
      // is a runtime field absent from the bundled GetMetaTypes type, hence the cast.
      const specCreateSeed = (entry as { createSeed?: Record<string, unknown> } | undefined)?.createSeed;
      let builtBody = createMode
        ? buildCreateModeBody(config, draft, specCreateSeed)
        // Edit mode: serialise the editor draft back to the wire shape
        // (inverse of `toDraft` — e.g. `view` folds the `{ list | form }`
        // family key back into the ViewItem `config` wrapper).
        : (config.fromDraft ? config.fromDraft(draft) : draft);
      // Async create-time augmentation (e.g. seed a record page's regions from
      // the bound object's synthesized default). Best-effort — a failure leaves
      // the un-augmented body. User/builder-supplied keys win over the seed.
      if (createMode && config.createSeed) {
        try {
          const seeded = await config.createSeed(draft, { client });
          if (seeded && typeof seeded === 'object') {
            // Seed wins over the empty defaults (`builtBody` already folded the
            // user's draft in, which only carries default-empty `regions`).
            builtBody = { ...(builtBody as Record<string, unknown>), ...seeded };
          }
        } catch { /* seed is best-effort; proceed with the un-augmented body */ }
      }
      const savedName = String(
        (builtBody as Record<string, unknown>)[identityField] ?? draft[identityField] ?? name,
      );
      const itemToSave = createMode
        ? { ...builtBody, [identityField]: savedName }
        : builtBody;
      if (!savedName) {
        setError(t('engine.validation.nameRequired', locale));
        setSaving(false);
        return;
      }
      // Save lands in the draft buffer — the runtime keeps serving the
      // last published version until the operator clicks Publish. The
      // backend defaults to publish mode for backward-compatibility, so
      // Studio must opt into draft explicitly.
      // Bind to the active software package (sys_metadata.package_id) when a
      // real package scope is carried in the URL (`?package=`). The backend
      // stamps it on create and preserves an existing binding on update, so
      // env-local overlays (no `?package=`) are unaffected.
      const activePackage = (() => {
        try {
          const p = new URLSearchParams(window.location.search).get('package');
          return p && p !== 'all' ? p : undefined;
        } catch {
          return undefined;
        }
      })();
      await client.save<any>(type, savedName, itemToSave, {
        force,
        mode: 'draft',
        ...(activePackage ? { packageId: activePackage } : {}),
      });
      // Refresh layered + draft state after save — scope to the same package
      // as the initial load (ADR-0048) so a same-name collision re-reads this
      // package's own row, not another's.
      const refreshScope = ownerPackageId ? { packageId: ownerPackageId } : {};
      const [lay, draftResp] = await Promise.all([
        client.layered<any>(type, savedName, refreshScope),
        client.getDraft<any>(type, savedName, refreshScope).catch(() => null),
      ]);
      setLayered(lay);
      const draftReal = extractDraftBody(draftResp);
      setHasDraft(!!draftReal);
      // Merge the draft over the effective baseline (see the load effect):
      // a partial draft overlay must not drop inherited fields like `type`.
      const freshBaseline = (lay.effective ?? itemToSave) as Record<string, unknown>;
      const rawFresh: Record<string, unknown> = draftReal
        ? { ...freshBaseline, ...(draftReal as Record<string, unknown>) }
        : freshBaseline;
      // Re-normalise the refreshed wire shape so the editor keeps showing
      // the canonical draft shape after a save (e.g. the backend re-expands
      // a view into the ViewItem `config` wrapper).
      const fresh = config.toDraft ? config.toDraft(rawFresh) : rawFresh;
      setDraft(fresh);
      draftSnapshotRef.current = fresh;
      setLastSavedAt(new Date());
      lastAutoSaveSnapshotRef.current = JSON.stringify(fresh);
      setDestructiveIssues(null);
      setPendingItem(null);
      // Stay in design mode after save for designer-capable types so the
      // user keeps their inspector context. Non-designer types fall back
      // to the previous "exit edit on save" UX.
      const stayInEditing = !createMode && !!getMetadataPreview(type);
      if (!createMode && !stayInEditing) setEditing(false);
      if (createMode) {
        // Preserve the active query string (notably `?package=…`) so the
        // post-create navigation lands on the item in the SAME package the
        // author was working in. Without this the param is dropped and the
        // editor falls back to the user's default package, where the freshly
        // saved draft doesn't exist — so it reloads a blank form.
        const qs = searchParams.toString();
        navigate(`../${encodeURIComponent(savedName)}${qs ? `?${qs}` : ''}`, {
          relative: 'path',
        });
      }
    } catch (err: any) {
      // Map destructive change → confirmation dialog.
      if (err?.status === 409 && err?.code === 'destructive_change') {
        const i = err?.body?.issues ?? [];
        setDestructiveIssues(Array.isArray(i) ? i : []);
        setPendingItem(draft);
      }
      // Map schema validation → inline field errors.
      else if (err?.status === 422 || err?.code === 'invalid_metadata' || err?.code === 'invalid_payload') {
        const i = err?.body?.issues ?? [];
        let mapped: SchemaFormIssue[] = (Array.isArray(i) ? i : []).map((x: any) => ({
          path: Array.isArray(x.path) ? x.path.join('.') : String(x.path ?? ''),
          message: translateValidationMessage(String(x.message ?? 'Invalid'), locale),
        }));
        // Backend's invalid_metadata sometimes returns a flat string like
        // "<type>/<name> failed spec validation: <path>: <message>".
        // Parse it into a single inline issue + summary so users see the
        // real problem instead of "0 issues".
        const raw: string = String(err?.body?.error ?? err?.message ?? '');
        if (mapped.length === 0 && raw) {
          const m = raw.match(/failed spec validation:\s*(.+?):\s*(.+)$/);
          if (m) {
            mapped = [{ path: m[1].trim(), message: translateValidationMessage(m[2].trim(), locale) }];
          } else {
            mapped = [{ path: '', message: translateValidationMessage(raw, locale) }];
          }
        }
        setIssues(mapped);
        if (mapped.length === 1 && !mapped[0].path) {
          setError(mapped[0].message);
        } else if (mapped.length === 1) {
          setError(`${labelForIssuePath(mapped[0].path)}: ${mapped[0].message}`);
        } else {
          setError(tFormat('engine.validation.failed', locale, { count: mapped.length }));
        }
      } else {
        setError(err?.message ?? String(err));
      }
    } finally {
      setSaving(false);
    }
  }

  async function doReset() {
    // Two semantics:
    //   - artifact-backed item: "Reset overlay" — keep the code default.
    //   - DB-only item: "Delete" — the item disappears entirely (no
    //     artifact baseline to fall back to). Navigate back to the list
    //     since the current URL no longer refers to anything.
    const itemIsArtifact = !createMode && layered?.code != null;
    const confirmKey = itemIsArtifact
      ? 'engine.edit.resetConfirm'
      : 'engine.edit.deleteConfirm';
    if (!confirm(tFormat(confirmKey, locale, { type, name: name ?? '' }))) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await client.reset(type, name);
      if (itemIsArtifact) {
        const lay = await client.layered<any>(type, name);
        setLayered(lay);
        const fresh = (lay.effective ?? lay.code ?? {}) as Record<string, unknown>;
        setDraft(fresh);
        draftSnapshotRef.current = fresh;
        // Designer-capable types stay in design mode; allow the auto-on
        // effect to re-trigger after this reset.
        if (getMetadataPreview(type)) {
          designerAutoOnRef.current = null;
        } else {
          setEditing(false);
        }
      } else {
        // No artifact baseline → return to the list view.
        navigate(`../`, { relative: 'path' });
      }
    } catch (err: any) {
      setError(err?.message ?? String(err));
    } finally {
      setSaving(false);
    }
  }

  // Promote the pending draft to the active overlay. Mirrors `doSave`'s
  // refresh pattern so the editor stays in sync with the new baseline.
  async function doPublish() {
    setPublishing(true);
    setError(null);
    try {
      await client.publish<any>(type, name);
      const [lay, draftResp] = await Promise.all([
        client.layered<any>(type, name),
        client.getDraft<any>(type, name).catch(() => null),
      ]);
      setLayered(lay);
      const draftReal = extractDraftBody(draftResp);
      setHasDraft(!!draftReal);
      // Merge the draft over the effective baseline so a partial draft overlay
      // doesn't drop inherited fields like `type` (section visibleOn depends
      // on it — ADR-0047).
      const freshBaseline = (lay.effective ?? draft) as Record<string, unknown>;
      const fresh: Record<string, unknown> = draftReal
        ? { ...freshBaseline, ...(draftReal as Record<string, unknown>) }
        : freshBaseline;
      setDraft(fresh);
      draftSnapshotRef.current = fresh;
    } catch (err: any) {
      setError(err?.message ?? String(err));
    } finally {
      setPublishing(false);
    }
  }

  // Discard the pending draft (`DELETE ?state=draft`). The published
  // overlay is untouched; the editor reverts to showing the live body.
  async function doDiscardDraft() {
    if (!confirm(tFormat('engine.edit.discardDraftConfirm', locale, { type, name: name ?? '' }))) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await client.reset(type, name, { state: 'draft' });
      const lay = await client.layered<any>(type, name);
      setLayered(lay);
      const fresh = (lay.effective ?? lay.code ?? {}) as Record<string, unknown>;
      setDraft(fresh);
      draftSnapshotRef.current = fresh;
      setHasDraft(false);
    } catch (err: any) {
      setError(err?.message ?? String(err));
    } finally {
      setSaving(false);
    }
  }

  // Dirty detection: cheap structural comparison via JSON. The draft is
  // small (a single metadata record) so this is fine on each render.
  // Used to surface an "unsaved" indicator next to the Save button.
  // Must be declared BEFORE any early returns to preserve hook order.
  const isDirty = React.useMemo(() => {
    if (createMode) return Object.keys(draft).length > 0;
    const snap = draftSnapshotRef.current;
    if (!snap) return false;
    try {
      return JSON.stringify(draft) !== JSON.stringify(snap);
    } catch {
      return false;
    }
  }, [draft, createMode]);

  // Two-tier authorization (PR-10d.7) — hoisted above the early `loading`
  // return so the auto-save / keyboard / blocker effects below can read
  // them. Recomputed cheaply on every render.
  //   - artifact-backed items (layered.code != null) need allowOrgOverride
  //   - DB-only items (no artifact) need allowOrgOverride OR allowRuntimeCreate
  //   - createMode is always writable (the server will gate on intent)
  // A non-null `code` layer alone is NOT proof of a code (artifact) package:
  // a published org object also surfaces its active version in `code`, but
  // tagged with the `sys_metadata` provenance sentinel. Mirror the server's
  // `isArtifactBacked` (which excludes `_packageId === 'sys_metadata'`) so an
  // org-authored object stays editable after publish instead of being mis-read
  // as a read-only packaged item.
  const isArtifactItem =
    !createMode
    && layered?.code != null
    && (layered.code as { _packageId?: string } | null)?._packageId !== 'sys_metadata';
  // ADR-0010 — server-computed lock flags. undefined means "no opinion"
  // (older server / non-lockable item) → preserve legacy behaviour.
  const lockEditable = layered?.editable !== false;
  const lockDeletable = layered?.deletable !== false;
  const lockResettable = layered?.resettable !== false;
  const lockReason = layered?.lockReason;
  const isLocked = layered?.lock && layered.lock !== 'none';
  const canWriteByType = createMode
    ? !!(entry?.allowOrgOverride || entry?.allowRuntimeCreate)
    : isArtifactItem
      ? !!entry?.allowOrgOverride
      : !!(entry?.allowOrgOverride || entry?.allowRuntimeCreate);
  const canWrite = canWriteByType && (createMode || lockEditable);
  const readOnly = !canWrite && !createMode;

  // Auto-save: debounce edits and persist silently once the user pauses
  // for AUTOSAVE_DEBOUNCE_MS. Skipped for create mode (need an explicit
  // name first), read-only forms, and while a save is already in flight.
  // We track the last attempted snapshot so a validation failure doesn't
  // loop on the same payload — the user has to mutate the draft again.
  const AUTOSAVE_DEBOUNCE_MS = 1500;
  // Keep doSave fresh inside the effect without re-arming the timer on
  // every render.
  const doSaveRef = React.useRef(doSave);
  React.useEffect(() => {
    doSaveRef.current = doSave;
  });
  React.useEffect(() => {
    if (!autoSaveEnabled) return;
    if (createMode || readOnly || !editing || !isDirty || saving) return;
    let snap: string;
    try {
      snap = JSON.stringify(draft);
    } catch {
      return;
    }
    if (snap === lastAutoSaveSnapshotRef.current) return;
    const handle = window.setTimeout(() => {
      lastAutoSaveSnapshotRef.current = snap;
      doSaveRef.current(false);
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [draft, isDirty, editing, saving, createMode, readOnly, autoSaveEnabled]);

  // Keyboard shortcut — ⌘S / Ctrl+S triggers save when dirty.
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        if (!canWrite || readOnly) return;
        if (!editing && !createMode) return;
        e.preventDefault();
        if (!saving && (createMode || isDirty)) {
          doSaveRef.current(false);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [canWrite, readOnly, editing, createMode, saving, isDirty]);

  // Beforeunload guard — browser-native "leave site?" prompt when the
  // user closes the tab / reloads with unsaved changes.
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

  // In-app navigation guard — intercept anchor / link clicks before the
  // router consumes them. Cheaper and more compatible than useBlocker,
  // which requires a data router (the host app uses BrowserRouter).
  React.useEffect(() => {
    if (!isDirty) return;
    const handler = (e: MouseEvent) => {
      if (e.defaultPrevented) return;
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      const anchor = target?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!anchor) return;
      // Allow new-tab / download / external links — they don't replace
      // the current page.
      if (anchor.target && anchor.target !== '_self') return;
      if (anchor.hasAttribute('download')) return;
      try {
        const url = new URL(anchor.href, window.location.href);
        if (url.origin !== window.location.origin) return;
        if (url.pathname === window.location.pathname) return;
      } catch {
        return;
      }
      if (!confirm(t('engine.edit.unsavedLeaveConfirm', locale))) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    document.addEventListener('click', handler, true);
    return () => document.removeEventListener('click', handler, true);
  }, [isDirty, locale]);

  // Publish "what's being edited" to the global AI chat so the agent can
  // act on the open item (and offer item-specific starter prompts). Kept
  // to a light summary — the agent can `describe_object` for full detail.
  // Declared above the early returns to satisfy the Rules of Hooks.
  const assistantEditorCtx = React.useMemo<AssistantEditorContext | null>(() => {
    if (embedded) return null;
    const itemName = String((draft as any).name ?? name ?? '');
    if (!itemName) return null;
    const ctx: AssistantEditorContext = {
      type,
      name: itemName,
      label: typeof (draft as any).label === 'string' ? (draft as any).label : undefined,
    };
    if (type === 'object') {
      ctx.fields = readFields((draft as any).fields).entries.slice(0, 60).map((e) => ({
        name: e.name,
        type: typeof e.def.type === 'string' ? (e.def.type as string) : undefined,
        label: typeof e.def.label === 'string' ? (e.def.label as string) : undefined,
        required: !!e.def.required || undefined,
      }));
    }
    return ctx;
  }, [embedded, type, name, draft]);
  useRegisterAssistantEditor(assistantEditorCtx);

  if (loading) {
    return (
      <PageShell entry={entry} itemName={name}>
        <div className="p-6 text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading {type}/{name}…
        </div>
      </PageShell>
    );
  }

  // `schema`, `createFieldList`, `effectiveHiddenFields`,
  // `effectiveFieldOrder`, and `handleCreateAwareChange` are all
  // hoisted to the top of the component (next to the rest of the
  // create-mode harness) to avoid placing hooks *after* the loading
  // early-return.

  // Banner variant: when type ships with allowRuntimeCreate but this
  // specific item is locked because it comes from a code package, we
  // show a different message inviting the user to create their own.
  const showArtifactLockedBanner =
    readOnly && isArtifactItem && !!entry?.allowRuntimeCreate;

  // Preview tab — opt-in via `registerMetadataPreview()`. Hidden in
  // create mode (nothing to preview yet) and inside the embedded
  // drawer (the parent context owns the preview surface).
  //
  // Exception: a few types host their primary authoring surface IN the
  // canvas (object → field designer). For those we light the canvas up
  // during create too, so authors design fields immediately instead of
  // round-tripping through a save first. Object-level basics (name,
  // label, …) stay editable via the default inspector shown when no
  // field is selected, so naming still works before any field exists.
  const showPreviewInCreate = CREATE_MODE_CANVAS_TYPES.has(type);
  const PreviewComponent =
    !embedded && (!createMode || showPreviewInCreate)
      ? getMetadataPreview(type)
      : undefined;

  // Optional scoped inspector for the selected sub-element (e.g. a
  // dashboard widget). Registered separately via
  // `registerMetadataInspector()` so a type can opt in independently
  // of having a Preview, and so plugins can swap implementations.
  const InspectorComponent = getMetadataInspector(type);
  // Optional "home" inspector shown when there is NO selection, replacing
  // the generic whole-draft SchemaForm with a curated panel (e.g. the View
  // type + fields manager). Falls back to SchemaForm when unregistered.
  const DefaultInspectorComponent = getMetadataDefaultInspector(type);

  // Cancel edits: revert the draft to the last saved snapshot and exit
  // edit mode. Safe to call even with no snapshot (no-op).
  function doCancelEdit() {
    if (draftSnapshotRef.current) {
      setDraft(draftSnapshotRef.current);
    }
    setIssues([]);
    setError(null);
    setEditing(false);
  }

  // When the form is "live" but not yet in edit mode, it renders as
  // read-only. createMode is always editing; truly read-only types
  // (no allowOrgOverride) ignore the editing toggle entirely.
  const formReadOnly = readOnly || (!editing && !createMode);

  // Note: URL `?tab=` deep-links were repurposed to open side-panel
  // sheets (Layers / References / Related). Anything else is ignored —
  // the main work area is always the form+preview.

  // Action group rendered identically in either the PageShell header
  // (form-only types) or the canvas toolbar (types with a PreviewComponent).
  // Centralising it lets us merge the two top bars into one when a
  // designer is present, saving a full row of vertical chrome.
  const actionsNode = (
    <>
      {/* Declarative type-level actions (GAP-1) — e.g. datasource
          "Test connection". Only on a saved item: record_header actions
          template `${ctx.recordId}` from the item name, which `(new)`
          drafts don't have yet. */}
      {!createMode && (
        <MetadataTypeActions
          entry={entry}
          location="record_header"
          recordId={name}
          onAfter={() => setReloadKey((k) => k + 1)}
        />
      )}
      {/* Info sheets — icon-only group, mirrors the canvas
          toolbar style (small ghost icons + tooltip). Keeps
          the primary edit / save actions visually dominant. */}
      {(!createMode || hasAnchors) && (
        <div className="flex items-center rounded-md border bg-background p-0.5">
          {!createMode && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setOpenSheet('layers')}
              title={t('engine.edit.layers', locale)}
              className="h-7 w-7 p-0 relative"
            >
              <Layers3 className="h-3.5 w-3.5" />
              {layered?.overlay && (() => {
                const n = countOverlaidFields(layered.code, layered.effective);
                return n > 0 ? (
                  <span
                    className="absolute -top-1 -right-1 min-w-[14px] h-[14px] px-1 rounded-full bg-emerald-600 text-emerald-50 text-[9px] leading-[14px] text-center font-medium"
                    title={t('engine.layers.diff', locale)}
                  >
                    {n}
                  </span>
                ) : null;
              })()}
            </Button>
          )}
          {!createMode && hasDraft && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setOpenSheet('review')}
              title={t('designer.draftReview.title', locale)}
              className="h-7 w-7 p-0 relative"
              data-testid="resource-review-trigger"
            >
              <GitCompareArrows className="h-3.5 w-3.5" />
              {(() => {
                const n = computeDraftChangeCount(
                  layered?.effective ?? null,
                  draft,
                );
                return n > 0 ? (
                  <span
                    className="absolute -top-1 -right-1 min-w-[14px] h-[14px] px-1 rounded-full bg-amber-500 text-amber-50 text-[9px] leading-[14px] text-center font-medium"
                    title={tFormat('designer.draftReview.badge', locale, { n })}
                  >
                    {n}
                  </span>
                ) : null;
              })()}
            </Button>
          )}
          {!createMode && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setOpenSheet('references')}
              title={t('engine.edit.references', locale)}
              className="h-7 w-7 p-0 relative"
            >
              <Link2 className="h-3.5 w-3.5" />
              {refs && refs.length > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] px-1 rounded-full bg-muted text-foreground text-[9px] leading-[14px] text-center font-medium border">
                  {refs.length}
                </span>
              )}
            </Button>
          )}
          {hasAnchors && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setOpenSheet('related')}
              title={t('engine.edit.related', locale)}
              className="h-7 w-7 p-0"
            >
              <Boxes className="h-3.5 w-3.5" />
            </Button>
          )}
          {!createMode && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setOpenSheet('history')}
              title={t('engine.edit.history', locale)}
              className="h-7 w-7 p-0"
            >
              <History className="h-3.5 w-3.5" />
            </Button>
          )}
          {!createMode && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setOpenSheet('audit')}
              title={t('engine.edit.auditTab', locale)}
              className="h-7 w-7 p-0"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      )}
      {!createMode && canWrite && layered?.overlay && (isArtifactItem ? lockResettable : lockDeletable) && (
        <Button
          variant="ghost"
          size="sm"
          onClick={doReset}
          disabled={saving}
          title={
            isArtifactItem
              ? t('engine.edit.reset', locale)
              : t('engine.edit.delete', locale)
          }
          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
        >
          {isArtifactItem ? (
            <RotateCcw className="h-3.5 w-3.5" />
          ) : (
            <Trash2 className="h-3.5 w-3.5" />
          )}
        </Button>
      )}
      {/* Edit-mode toggle.
          - Designer types (with PreviewComponent): always editing.
            The Design / Preview toggle in the canvas toolbar takes the
            place of an Edit / Cancel binary — users switch to Preview
            to see the rendered result, no "leave edit mode" needed.
          - Form-only types: keep the Salesforce-style Edit / Cancel
            convention (View → click Edit → mutate → Save or Cancel).
          - createMode: always editing, Save only.
          - Truly read-only types (no allowOrgOverride): no buttons. */}
      {canWrite && !createMode && !editing && !PreviewComponent && (
        <Button size="sm" onClick={() => setEditing(true)} className="h-7">
          <Pencil className="h-3.5 w-3.5 mr-1" />
          {t('engine.edit.edit', locale)}
        </Button>
      )}
      {canWrite && (editing || createMode) && (
        <SaveStatusIndicator
          saving={saving}
          isDirty={isDirty}
          autoSaveEnabled={autoSaveEnabled}
          lastSavedAt={lastSavedAt}
          createMode={!!createMode}
          locale={locale}
        />
      )}
      {canWrite && (editing || createMode) && !createMode && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setAutoSaveEnabled((v) => !v)}
          className="h-7 w-7 p-0 text-muted-foreground"
          title={
            autoSaveEnabled
              ? t('engine.edit.autoSaveOn', locale)
              : t('engine.edit.autoSaveOff', locale)
          }
        >
          {autoSaveEnabled ? (
            <Zap className="h-3.5 w-3.5 text-emerald-600" />
          ) : (
            <ZapOff className="h-3.5 w-3.5" />
          )}
        </Button>
      )}
      {canWrite && !createMode && editing && !PreviewComponent && (
        <Button
          variant="ghost"
          size="sm"
          onClick={doCancelEdit}
          disabled={saving}
          className="h-7 w-7 p-0"
          title={t('engine.cancel', locale)}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      )}
      {canWrite && (editing || createMode) && (
        <Button
          size="sm"
          onClick={() => doSave(false)}
          disabled={saving || (!createMode && !isDirty)}
          className="h-7 w-7 p-0 relative"
          title={
            saving
              ? t('engine.edit.saving', locale)
              : !createMode && !isDirty
                ? t('engine.edit.noChanges', locale)
                : `${t('engine.edit.save', locale)} (⌘S)`
          }
        >
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          {isDirty && !saving && (
            <span
              aria-hidden
              className="absolute -top-0.5 -right-0.5 inline-block h-2 w-2 rounded-full bg-amber-300 ring-2 ring-background"
            />
          )}
        </Button>
      )}
      {/* Publish / Discard draft — only when there is a pending draft.
          Save writes to the draft buffer; the runtime keeps serving the
          published version until the operator clicks Publish. */}
      {canWrite && !createMode && hasDraft && (
        <Button
          variant="ghost"
          size="sm"
          onClick={doDiscardDraft}
          disabled={saving || publishing}
          className="h-7 w-7 p-0 text-muted-foreground"
          title={t('engine.edit.discardDraft', locale)}
        >
          <Undo2 className="h-3.5 w-3.5" />
        </Button>
      )}
      {canWrite && !createMode && hasDraft && (
        <Button
          size="sm"
          onClick={doPublish}
          disabled={saving || publishing || isDirty}
          className="h-7 px-2 relative bg-emerald-600 hover:bg-emerald-700 text-emerald-50"
          title={
            isDirty
              ? t('engine.edit.publishBlockedDirty', locale)
              : t('engine.edit.publish', locale)
          }
        >
          {publishing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <>
              <Send className="h-3.5 w-3.5 mr-1" />
              <span className="text-xs">{t('engine.edit.publish', locale)}</span>
            </>
          )}
        </Button>
      )}
    </>
  );

  return (
    <PageShell
      entry={entry ?? { type, label: type }}
      itemName={createMode ? '(new)' : name}
      subtitle={createMode ? t('engine.edit.createNew', locale) : undefined}
      actions={PreviewComponent ? null : actionsNode}
    >
      <div
        className={
          PreviewComponent
            ? 'flex h-full min-h-0 flex-col'
            : 'p-6 space-y-6 max-w-7xl'
        }
      >
        {(error || readOnly || hasDraft || isLocked) && (
          <div
            className={
              PreviewComponent
                ? 'px-6 pt-4 space-y-3'
                : 'space-y-3'
            }
          >
            {error && (
              <div className="text-sm text-destructive border border-destructive/30 rounded p-3 bg-destructive/5">
                {error}
              </div>
            )}
            {isLocked && (
              <div className="text-xs text-amber-900 border border-amber-300/70 bg-amber-50/70 rounded-md px-3 py-2.5 dark:text-amber-200 dark:border-amber-700/40 dark:bg-amber-950/20 flex items-start gap-2.5">
                <Lock className="h-3.5 w-3.5 mt-0.5 shrink-0 opacity-80" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium">
                    {layered?.lock === 'full' && t('engine.edit.lockFull', locale)}
                    {layered?.lock === 'no-overlay' && t('engine.edit.lockNoOverlay', locale)}
                    {layered?.lock === 'no-delete' && t('engine.edit.lockNoDelete', locale)}
                  </div>
                  {lockReason && <div className="mt-0.5 opacity-90">{lockReason}</div>}
                  {layered?.lockDocsUrl && (
                    <a
                      href={layered.lockDocsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-amber-800 underline hover:text-amber-900 dark:text-amber-200 dark:hover:text-amber-100"
                    >
                      {locale === 'zh-CN' ? '查看文档' : 'View docs'} →
                    </a>
                  )}
                  {layered?.packageId && (
                    <div className="mt-0.5 text-amber-700 dark:text-amber-300/80">
                      <code className="font-mono">{layered.packageId}{layered.packageVersion ? `@${layered.packageVersion}` : ''}</code>
                    </div>
                  )}
                </div>
                {/* When this locked item ships from a code package the
                    user can still author their own copy — fold that CTA
                    into the lock banner instead of stacking a second,
                    near-identical amber notice below it. */}
                {showArtifactLockedBanner && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0 h-7 bg-background/60"
                    onClick={() => navigate(`../new`, { relative: 'path' })}
                  >
                    {t('engine.list.create', locale)}
                  </Button>
                )}
              </div>
            )}
            {hasDraft && !createMode && (
              <div className="text-xs text-emerald-900 border border-emerald-300 bg-emerald-50 rounded p-3 dark:text-emerald-200 dark:border-emerald-700/50 dark:bg-emerald-950/30 flex items-center gap-3">
                <Send className="h-3.5 w-3.5 shrink-0" />
                <span className="flex-1">{t('engine.edit.draftPending', locale)}</span>
                {canWrite && (
                  <>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={doDiscardDraft}
                      disabled={saving || publishing}
                      className="h-7"
                    >
                      {t('engine.edit.discardDraft', locale)}
                    </Button>
                    <Button
                      size="sm"
                      onClick={doPublish}
                      disabled={saving || publishing || isDirty}
                      className="h-7 bg-emerald-600 hover:bg-emerald-700 text-emerald-50"
                    >
                      {publishing ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        t('engine.edit.publish', locale)
                      )}
                    </Button>
                  </>
                )}
              </div>
            )}
            {/* When the item is already flagged via the lock banner above,
                this read-only notice is redundant (and its CTA has been
                folded into the lock banner). Only render it for the
                non-locked read-only cases. */}
            {readOnly && !isLocked && (
              <div data-testid="readonly-banner" className="text-xs text-amber-800 border border-amber-300/70 bg-amber-50/70 rounded-md px-3 py-2.5 dark:text-amber-200 dark:border-amber-700/40 dark:bg-amber-950/20 flex items-start gap-3">
                <div className="flex-1">
                  {showArtifactLockedBanner ? (
                    /* Type allows runtime-create but THIS item ships from
                       a code package. Tell the user clearly and provide
                       a CTA to author their own. */
                    t('engine.edit.artifactLockedBanner', locale)
                      .split(/(\{type\})/)
                      .map((part, i) => {
                        if (part === '{type}') return <code key={i} className="font-mono">{type}</code>;
                        return <React.Fragment key={i}>{part}</React.Fragment>;
                      })
                  ) : (
                    /* The platform i18n bundle ships `engine.edit.readOnlyTypeBanner`
                       with `{flag} / {type} / {override}` placeholders so the
                       monospace tokens are inlined inside the translated sentence
                       in any locale. Splitting on the three tokens preserves the
                       sentence order across translations. */
                    t('engine.edit.readOnlyTypeBanner', locale)
                      .split(/(\{flag\}|\{type\}|\{override\})/)
                      .map((part, i) => {
                        if (part === '{flag}') return <code key={i} className="font-mono">OBJECTSTACK_METADATA_WRITABLE</code>;
                        if (part === '{type}') return <code key={i} className="font-mono">{type}</code>;
                        if (part === '{override}') return <code key={i} className="font-mono">allowOrgOverride</code>;
                        return <React.Fragment key={i}>{part}</React.Fragment>;
                      })
                  )}
                </div>
                {showArtifactLockedBanner && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0"
                    onClick={() => navigate(`../new`, { relative: 'path' })}
                  >
                    {t('engine.list.create', locale)}
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        <div
          className={
            PreviewComponent
              ? 'flex w-full flex-1 min-h-0 flex-col'
              : 'w-full'
          }
        >
          <div
            className={
              PreviewComponent
                ? 'mt-2 flex-1 min-h-0 flex flex-col px-6 pb-4'
                : 'mt-4 space-y-3'
            }
          >
            {/* Read-only banner. In split mode we suppress it — the
                "可写" badge in the header plus the Edit button in the
                action bar already convey both signal and call-to-action,
                and saving every vertical pixel for the canvas matters. */}
            {!PreviewComponent && formReadOnly && !readOnly && canWrite && !createMode && (
              <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground border rounded p-2.5 bg-muted/30">
                <span>
                  {t('engine.edit.readOnlyBanner', locale).split(/\{edit\}/).map((part, i, arr) => (
                    <React.Fragment key={i}>
                      {part}
                      {i < arr.length - 1 && <strong>{t('engine.edit.edit', locale)}</strong>}
                    </React.Fragment>
                  ))}
                </span>
                <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                  <Pencil className="h-3.5 w-3.5 mr-1" />
                  {t('engine.edit.edit', locale)}
                </Button>
              </div>
            )}
            {(() => {
              // Server-computed load-time validation errors on the
              // effective payload — surfaced here so operators can see
              // a structural problem without saving first. The same
              // errors are also threaded into SchemaForm as `issues`
              // and rendered inline next to each broken field.
              const diag = (layered as any)?._diagnostics as
                | {
                    valid: boolean;
                    errors?: Array<{ path: string; message: string }>;
                    warnings?: Array<{ path: string; message: string }>;
                  }
                | undefined;
              // When client-side Zod validation is available for this
              // type, drive the error portion of the banner from the
              // live `issues` state instead of the stale load-time
              // diagnostics, so it stays in sync with every keystroke.
              // Warnings remain server-sourced (Zod doesn't model them).
              const liveErrors = hasClientValidator(type)
                ? issues.map((i) => ({
                    path: i.path,
                    message: translateValidationMessage(i.message, locale),
                  }))
                : (diag?.errors ?? []).map((i) => ({
                    ...i,
                    message: translateValidationMessage(i.message, locale),
                  }));
              const liveValid = hasClientValidator(type)
                ? liveErrors.length === 0
                : diag?.valid !== false;
              // Gate the whole diagnostics block on a successful load with
              // a diagnostics source. A failed load shows the explicit
              // "failed to load" banner above instead; the empty-default
              // form's required-field issues here would be noise, not a
              // verdict on the item (see shouldRenderDiagnostics).
              if (createMode && !createDirty) {
                return null;
              }
              if (
                !shouldRenderDiagnostics({
                  loadFailed,
                  hasDiag: !!diag,
                  hasClientValidator: hasClientValidator(type),
                })
              ) {
                return null;
              }
              const errs = liveErrors;
              const warns = diag?.warnings ?? [];
              const hasErrs = !liveValid && errs.length > 0;
              const hasWarns = warns.length > 0;
              if (!hasErrs && !hasWarns) return null;
              const renderBlock = (
                kind: 'error' | 'warning',
                items: Array<{ path: string; message: string }>,
              ) => {
                const head = items.slice(0, 3);
                const rest = Math.max(0, items.length - head.length);
                const cls =
                  kind === 'error'
                    ? 'border-destructive/40 bg-destructive/[0.06] text-destructive'
                    : 'border-amber-500/40 bg-amber-500/[0.08] text-amber-800 dark:text-amber-200';
                const titleKey =
                  kind === 'error'
                    ? 'engine.edit.diagnostics.title'
                    : 'engine.edit.diagnostics.warnTitle';
                return (
                  <div
                    key={kind}
                    data-testid={kind === 'error' ? 'metadata-validation-banner' : undefined}
                    className={`flex items-start gap-2 text-xs border rounded p-2.5 ${cls}`}
                  >
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">
                        {tFormat(titleKey, locale, { count: items.length })}
                      </div>
                      <ul className="mt-1 space-y-0.5 font-mono text-[11px]">
                        {head.map((e, i) => (
                          <li key={i} className="truncate">
                            <span className="opacity-70">{e.path ? labelForIssuePath(e.path) : '(root)'}</span>: {e.message}
                          </li>
                        ))}
                        {rest > 0 && (
                          <li className="opacity-70">
                            {tFormat('engine.edit.diagnostics.more', locale, { count: rest })}
                          </li>
                        )}
                      </ul>
                    </div>
                  </div>
                );
              };
              return (
                <div className="space-y-2">
                  {hasErrs && renderBlock('error', errs)}
                  {hasWarns && renderBlock('warning', warns)}
                </div>
              );
            })()}
            {PreviewComponent ? (
              <div
                className={
                  isFullscreen
                    ? 'fixed inset-0 z-50 bg-background flex flex-col p-3'
                    : 'relative flex-1 min-h-0 flex'
                }
              >
                <PanelGroup
                  direction="horizontal"
                  className="flex-1 min-h-0 rounded-md border bg-background overflow-hidden"
                  id={`metadata-edit-${type}`}
                >
                  <ResizablePanel defaultSize={62} minSize={30}>
                    <div className="relative h-full flex flex-col">
                      {/* Canvas toolbar — owns the design/preview toggle
                          and fullscreen affordance so designers can drive
                          the canvas without round-tripping to the page
                          header. In fullscreen we also surface Save /
                          Cancel / Inspector controls here since the
                          PageShell header is hidden. */}
                      <div className="flex items-center justify-between gap-2 border-b bg-background/95 backdrop-blur px-3 py-2 sticky top-0 z-10">
                        <div className="flex items-center gap-1">
                          {canWrite && (
                            <div
                              role="tablist"
                              aria-label={t('engine.edit.designer', locale)}
                              className="inline-flex items-center rounded-md border bg-muted/40 p-0.5"
                            >
                              <button
                                type="button"
                                role="tab"
                                aria-selected={!previewOnly}
                                onClick={() => setPreviewOnly(false)}
                                className={
                                  'inline-flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors ' +
                                  (!previewOnly
                                    ? 'bg-background shadow-sm text-foreground'
                                    : 'text-muted-foreground hover:text-foreground')
                                }
                                title={t('engine.edit.designMode', locale)}
                              >
                                <MousePointer2 className="h-3.5 w-3.5" />
                                {t('engine.edit.designMode', locale)}
                              </button>
                              <button
                                type="button"
                                role="tab"
                                aria-selected={previewOnly}
                                onClick={() => setPreviewOnly(true)}
                                className={
                                  'inline-flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors ' +
                                  (previewOnly
                                    ? 'bg-background shadow-sm text-foreground'
                                    : 'text-muted-foreground hover:text-foreground')
                                }
                                title={t('engine.edit.previewMode', locale)}
                              >
                                <Eye className="h-3.5 w-3.5" />
                                {t('engine.edit.previewMode', locale)}
                              </button>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          {/* All page-level actions live here when the
                              designer is present — merged from the
                              PageShell header to reclaim a full row. */}
                          {actionsNode}
                          <span className="mx-1 h-5 w-px bg-border" aria-hidden />
                          {PreviewComponent && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={toggleInspector}
                              className="h-7 w-7 p-0"
                              title={
                                (inspectorCollapsed
                                  ? t('engine.edit.showInspector', locale)
                                  : t('engine.edit.hideInspector', locale)) + ' (⌘\\)'
                              }
                            >
                              {inspectorCollapsed ? (
                                <PanelRightOpen className="h-3.5 w-3.5" />
                              ) : (
                                <PanelRightClose className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setIsFullscreen((v) => !v)}
                            className="h-7 w-7 p-0"
                            title={
                              isFullscreen
                                ? t('engine.edit.exitFullscreen', locale)
                                : t('engine.edit.fullscreen', locale)
                            }
                          >
                            {isFullscreen ? (
                              <Minimize2 className="h-3.5 w-3.5" />
                            ) : (
                              <Maximize2 className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </div>
                      </div>
                      <div className="flex-1 min-h-0 overflow-auto p-4 bg-[radial-gradient(circle_at_1px_1px,theme(colors.border)_1px,transparent_0)] [background-size:16px_16px] bg-muted/30">
                        <PreviewComponent
                          type={type}
                          name={name}
                          draft={draft}
                          baseline={
                            !createMode
                              ? ((layered?.effective as Record<string, unknown> | undefined) ?? undefined)
                              : undefined
                          }
                          editing={editing && !previewOnly}
                          selection={previewOnly ? null : selection}
                          onSelectionChange={setSelection}
                          locale={locale}
                          onPatch={(patch) =>
                            handleDraftChange((d) => ({ ...(d as Record<string, unknown>), ...patch }))
                          }
                        />
                      </div>
                    </div>
                  </ResizablePanel>
                  <ResizableHandle
                    withHandle
                    className={
                      inspectorCollapsed
                        ? 'hidden'
                        : 'w-1.5 bg-border/40 hover:bg-primary/40 active:bg-primary/60 transition-colors'
                    }
                  />
                  <ResizablePanel
                    panelRef={inspectorPanelRef}
                    defaultSize={lastInspectorSizeRef.current}
                    minSize={22}
                    collapsible
                    collapsedSize={0}
                    onResize={(size) => {
                      const pct = size.asPercentage;
                      const collapsed = pct <= 0.5;
                      if (!collapsed) {
                        lastInspectorSizeRef.current = pct;
                        if (typeof window !== 'undefined') {
                          window.localStorage.setItem(
                            inspectorSizeStorageKey,
                            String(Math.round(pct)),
                          );
                        }
                      }
                      setInspectorCollapsed((prev) => {
                        if (prev === collapsed) return prev;
                        if (typeof window !== 'undefined') {
                          window.localStorage.setItem(
                            inspectorStorageKey,
                            collapsed ? '1' : '0',
                          );
                        }
                        return collapsed;
                      });
                    }}
                  >
                    <div className="h-full overflow-auto">
                      {/* Inspector header — anchors the user to "this is
                          where the metadata for the selected item lives".
                          The collapse affordance lives in the canvas
                          toolbar (left of Fullscreen) so it stays
                          reachable when the panel is closed; we
                          deliberately do not duplicate it here. */}
                      <div className="sticky top-0 z-10 flex items-center gap-2 border-b bg-background/95 backdrop-blur px-3 py-2">
                        <div
                          role="tablist"
                          className="inline-flex items-center rounded-md border bg-muted/40 p-0.5"
                        >
                          <button
                            type="button"
                            role="tab"
                            aria-selected={inspectorTab === 'properties'}
                            onClick={() => setInspectorTab('properties')}
                            className={
                              'inline-flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors ' +
                              (inspectorTab === 'properties'
                                ? 'bg-background shadow-sm text-foreground'
                                : 'text-muted-foreground hover:text-foreground')
                            }
                            title={t('engine.edit.inspector.properties', locale)}
                          >
                            <SlidersHorizontal className="h-3.5 w-3.5" />
                            {t('engine.edit.inspector.properties', locale)}
                          </button>
                          <button
                            type="button"
                            role="tab"
                            aria-selected={inspectorTab === 'source'}
                            onClick={() => setInspectorTab('source')}
                            className={
                              'inline-flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors ' +
                              (inspectorTab === 'source'
                                ? 'bg-background shadow-sm text-foreground'
                                : 'text-muted-foreground hover:text-foreground')
                            }
                            title={t('engine.edit.inspector.source', locale)}
                          >
                            <FileCode2 className="h-3.5 w-3.5" />
                            {t('engine.edit.inspector.source', locale)}
                          </button>
                        </div>
                        {isDirty && (
                          <Badge variant="outline" className="text-[10px] border-amber-400/60 text-amber-600 dark:text-amber-300">
                            <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />
                            {t('engine.edit.unsaved', locale)}
                          </Badge>
                        )}
                      </div>
                      <div className="p-4">
                        {inspectorTab === 'source' ? (
                          <JsonSourceEditor
                            value={draft}
                            onChange={handleDraftChange}
                            readOnly={formReadOnly}
                            issues={displayIssues.map((i) => ({
                              path: i.path ?? '',
                              message: i.message,
                            }))}
                          />
                        ) : selection && InspectorComponent ? (
                          <InspectorComponent
                            type={type}
                            name={name}
                            draft={draft}
                            selection={selection}
                            onPatch={(patch) =>
                              handleDraftChange((d) => ({
                                ...(d as Record<string, unknown>),
                                ...patch,
                              }))
                            }
                            onClearSelection={() => setSelection(null)}
                            onSelectionChange={setSelection}
                            readOnly={formReadOnly}
                            locale={locale}
                          />
                        ) : !selection && DefaultInspectorComponent ? (
                          <DefaultInspectorComponent
                            type={type}
                            name={name}
                            draft={draft}
                            onPatch={(patch) =>
                              handleDraftChange((d) => ({
                                ...(d as Record<string, unknown>),
                                ...patch,
                              }))
                            }
                            onSelectionChange={setSelection}
                            readOnly={formReadOnly}
                            locale={locale}
                            serverSchema={entry?.schema as Record<string, unknown> | undefined}
                          />
                        ) : (
                          <SchemaForm
                            schema={schema}
                            form={createMode && config.createSchema ? undefined : (entry?.form as any)}
                            value={draft}
                            onChange={handleCreateAwareChange}
                            issues={displayIssues}
                            hiddenFields={effectiveHiddenFields}
                            fieldOrder={effectiveFieldOrder}
                            readOnly={formReadOnly}
                            createMode={createMode}
                            widgetContext={widgetContext}
                          />
                        )}
                      </div>
                    </div>
                  </ResizablePanel>
                </PanelGroup>
                {/* The floating reopen pill that used to live here was
                    removed: the canvas toolbar already hosts a permanent
                    VSCode-style inspector toggle next to the fullscreen
                    button, so this duplicate affordance was just noise. */}
              </div>
            ) : (
              <SchemaForm
                schema={schema}
                form={createMode && config.createSchema ? undefined : (entry?.form as any)}
                value={draft}
                onChange={handleCreateAwareChange}
                issues={displayIssues}
                hiddenFields={effectiveHiddenFields}
                fieldOrder={effectiveFieldOrder}
                readOnly={formReadOnly}
                createMode={createMode}
                widgetContext={widgetContext}
              />
            )}
          </div>
        </div>
      </div>

      {/* Layers / References / Related are right-side sheets, opened from
          the page-shell header. They used to live in tabs above the form,
          which stole vertical space from the primary work area. */}
      <Sheet
        open={openSheet === 'layers'}
        onOpenChange={(o) => !o && setOpenSheet(null)}
      >
        <SheetContent side="right" className="w-[92vw] sm:max-w-[720px] p-0 flex flex-col gap-0">
          <SheetHeader className="px-4 py-3 border-b">
            <SheetTitle className="text-base">{t('engine.edit.layers', locale)}</SheetTitle>
            <SheetDescription className="text-xs">
              {type} / {name}
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 min-h-0 overflow-auto p-4">
            <LayeredDiff layered={layered} locale={locale} />
          </div>
        </SheetContent>
      </Sheet>

      {/* ADR-0033 Phase B — generic draft↔published review/diff. Available for
          ANY type whenever a pending draft exists; opened by the chat's
          "Review N change(s)" affordance (?review=1) or the toolbar button. */}
      <Sheet
        open={openSheet === 'review'}
        onOpenChange={(o) => !o && setOpenSheet(null)}
      >
        <SheetContent side="right" className="w-[92vw] sm:max-w-[720px] p-0 flex flex-col gap-0">
          <SheetHeader className="px-4 py-3 border-b">
            <SheetTitle className="text-base">{t('designer.draftReview.title', locale)}</SheetTitle>
            <SheetDescription className="text-xs">
              {type} / {name} · {t('designer.canvas.reviewVsPublished', locale)}
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 min-h-0 overflow-auto p-4">
            <DraftReviewPanel
              published={layered?.effective ?? null}
              draft={draft}
              locale={locale}
            />
          </div>
        </SheetContent>
      </Sheet>

      <Sheet
        open={openSheet === 'references'}
        onOpenChange={(o) => !o && setOpenSheet(null)}
      >
        <SheetContent side="right" className="w-[92vw] sm:max-w-[720px] p-0 flex flex-col gap-0">
          <SheetHeader className="px-4 py-3 border-b">
            <SheetTitle className="text-base">
              {t('engine.edit.references', locale)}
              {refs && (
                <Badge variant="outline" className="ml-2 text-[10px]">
                  {refs.length}
                </Badge>
              )}
            </SheetTitle>
            <SheetDescription className="text-xs">
              {type} / {name}
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 min-h-0 overflow-auto p-4">
            <ReferencesPanel refs={refs} loading={refsLoading} />
          </div>
        </SheetContent>
      </Sheet>

      {hasAnchors && (
        <Sheet
          open={openSheet === 'related'}
          onOpenChange={(o) => !o && setOpenSheet(null)}
        >
          <SheetContent side="right" className="w-[92vw] sm:max-w-[860px] p-0 flex flex-col gap-0">
            <SheetHeader className="px-4 py-3 border-b">
              <SheetTitle className="text-base">{t('engine.edit.related', locale)}</SheetTitle>
              <SheetDescription className="text-xs">
                {type} / {name}
              </SheetDescription>
            </SheetHeader>
            <div className="flex-1 min-h-0 overflow-auto p-4">
              <RelatedPanel
                type={type}
                name={name}
                parentItem={draft}
                onOpen={(t) => setRelatedTarget(t)}
              />
            </div>
          </SheetContent>
        </Sheet>
      )}

      {!createMode && (
        <Sheet
          open={openSheet === 'history'}
          onOpenChange={(o) => !o && setOpenSheet(null)}
        >
          <SheetContent side="right" className="w-[92vw] sm:max-w-[720px] p-0 flex flex-col gap-0">
            <SheetHeader className="px-4 py-3 border-b">
              <SheetTitle className="text-base">{t('engine.edit.history', locale)}</SheetTitle>
              <SheetDescription className="text-xs">
                {type} / {name}
              </SheetDescription>
            </SheetHeader>
            <div className="flex-1 min-h-0 overflow-auto p-4">
              <HistoryPanel
                type={type}
                name={name}
                client={client}
                onRollback={() => setReloadKey((k) => k + 1)}
                rollbackLabel={t('engine.edit.rollback', locale)}
                rollbackConfirm={(version) =>
                  t('engine.edit.rollbackConfirm', locale).replace(
                    '{version}',
                    String(version),
                  )
                }
              />
            </div>
          </SheetContent>
        </Sheet>
      )}

      {!createMode && (
        <Sheet
          open={openSheet === 'audit'}
          onOpenChange={(o) => !o && setOpenSheet(null)}
        >
          <SheetContent side="right" className="w-[92vw] sm:max-w-[860px] p-0 flex flex-col gap-0">
            <SheetHeader className="px-4 py-3 border-b">
              <SheetTitle className="text-base">{t('engine.edit.auditTab', locale)}</SheetTitle>
              <SheetDescription className="text-xs">
                {type} / {name}
              </SheetDescription>
            </SheetHeader>
            <div className="flex-1 min-h-0 overflow-hidden p-3">
              <AuditPanel
                type={type}
                name={name}
                client={client}
                locale={locale}
              />
            </div>
          </SheetContent>
        </Sheet>
      )}

      <MetadataDetailDrawer
        target={relatedTarget}
        onClose={() => setRelatedTarget(null)}
        parentContext={{ type, name }}
      />

      {/* Destructive-change confirmation dialog */}
      <Dialog
        open={destructiveIssues != null}
        onOpenChange={(open) => {
          if (!open) {
            setDestructiveIssues(null);
            setPendingItem(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              Destructive change detected
            </DialogTitle>
            <DialogDescription>
              The framework refused this save because it would drop or narrow
              data already in use. Review the issues and confirm to override.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[300px] overflow-auto space-y-2 my-2">
            {destructiveIssues?.map((i, idx) => (
              <div
                key={idx}
                className="rounded border bg-amber-50 border-amber-200 p-2 text-xs"
              >
                <div className="font-mono text-amber-900">{i.kind ?? 'change'}</div>
                {i.path && (
                  <div className="text-amber-800 font-mono mt-0.5">{i.path}</div>
                )}
                <div className="text-amber-900 mt-1">{i.message}</div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDestructiveIssues(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => doSave(true)}
              disabled={saving}
            >
              {saving ? 'Forcing…' : 'Force save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}

function ReferencesPanel({
  refs,
  loading,
}: {
  refs: MetadataReference[] | null;
  loading: boolean;
}) {
  if (loading || refs == null) {
    return (
      <div className="text-sm text-muted-foreground flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" /> Scanning references…
      </div>
    );
  }
  if (refs.length === 0) {
    return (
      <Empty>
        <EmptyTitle>No references found</EmptyTitle>
        <EmptyDescription>
          Nothing in the metadata graph points at this item. Safe to delete.
        </EmptyDescription>
      </Empty>
    );
  }
  return (
    <div className="border rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left">From type</th>
            <th className="px-3 py-2 text-left">From name</th>
            <th className="px-3 py-2 text-left">Path</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {refs.map((r, i) => (
            <tr key={i} className="hover:bg-accent/50">
              <td className="px-3 py-2">
                <Badge variant="outline" className="text-[10px] font-mono">
                  {r.fromType}
                </Badge>
              </td>
              <td className="px-3 py-2 font-mono text-xs">{r.fromName}</td>
              <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                {r.path}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * SaveStatusIndicator — small inline label next to the Save icon that
 * communicates auto-save state so the icon-only button is not a black
 * box. Five states:
 *   - saving      → "Saving…" with spinner
 *   - dirty + on  → "Auto-saving in 1.5s" (subtle, amber)
 *   - dirty + off → "Unsaved" (amber)
 *   - clean + ts  → "Saved 14:32" (muted)
 *   - createMode  → hidden until first save
 */
function SaveStatusIndicator({
  saving,
  isDirty,
  autoSaveEnabled,
  lastSavedAt,
  createMode,
  locale,
}: {
  saving: boolean;
  isDirty: boolean;
  autoSaveEnabled: boolean;
  lastSavedAt: Date | null;
  createMode: boolean;
  locale: 'en-US' | 'zh-CN' | string;
}) {
  // Re-render every 30s so "Saved 14:32" stays accurate without
  // requiring the caller to manage a ticker.
  const [, force] = React.useReducer((n: number) => n + 1, 0);
  React.useEffect(() => {
    if (!lastSavedAt) return;
    const id = window.setInterval(force, 30_000);
    return () => window.clearInterval(id);
  }, [lastSavedAt]);

  if (saving) {
    return (
      <span className="text-xs text-muted-foreground hidden md:inline-flex items-center gap-1">
        <Loader2 className="h-3 w-3 animate-spin" />
        {t('engine.edit.saving', locale)}
      </span>
    );
  }
  if (isDirty) {
    if (createMode) return null;
    return (
      <span className="text-xs text-amber-600 dark:text-amber-300 hidden md:inline-flex items-center gap-1">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />
        {autoSaveEnabled
          ? t('engine.edit.autoSavingShortly', locale)
          : t('engine.edit.unsaved', locale)}
      </span>
    );
  }
  if (lastSavedAt) {
    const hh = String(lastSavedAt.getHours()).padStart(2, '0');
    const mm = String(lastSavedAt.getMinutes()).padStart(2, '0');
    return (
      <span className="text-xs text-muted-foreground hidden md:inline-flex items-center gap-1">
        {tFormat('engine.edit.savedAt', locale, { time: `${hh}:${mm}` })}
      </span>
    );
  }
  return null;
}
