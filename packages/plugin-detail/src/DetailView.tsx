/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from 'react';
import { 
  cn, 
  Badge,
  Button, 
  Skeleton,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  useIsMobile,
} from '@object-ui/components';
import { 
  ArrowLeft, 
  Edit, 
  Star,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Lock,
  X,
} from 'lucide-react';
import { DetailSection } from './DetailSection';
import { DetailTabs } from './DetailTabs';
import { RelatedList } from './RelatedList';
import { SectionGroup } from './SectionGroup';
import { HeaderHighlight } from './HeaderHighlight';
import { RecordComments } from './RecordComments';
import { ActivityTimeline } from './ActivityTimeline';
import { HistoryTimeline } from './HistoryTimeline';
import { RecordMetaFooter } from './RecordMetaFooter';
import { SchemaRenderer, useSafeFieldLabel, useDataInvalidation, useInlineEdit } from '@object-ui/react';
import { buildExpandFields, getRecordDisplayName, formatTitleTemplate } from '@object-ui/core';
import { usePermissions } from '@object-ui/permissions';
import { useLocalization, resolveFieldCurrency } from '@object-ui/i18n';
import type { DetailViewSchema, DataSource, ActionSchema, SchemaNode } from '@object-ui/types';
import { useDetailTranslation } from './useDetailTranslation';

/** Default page size for related lists in the detail view */
const DEFAULT_RELATED_PAGE_SIZE = 5;

/** Stable empty draft so the section `data`-merge identity is preserved when
 *  no <InlineEditProvider> is mounted (bare / read-only DetailView). */
const EMPTY_DRAFT: Record<string, any> = {};

/**
 * Resolve the human-readable title for the detail header.
 *
 * Priority order:
 *   1. `schema.primaryField` value on the record (view-author override).
 *   2. `objectSchema.titleFormat` (e.g. `{full_name} - {company}`).
 *   3. `objectSchema.displayNameField` + type-aware field derivation, via the
 *      unified `@object-ui/core#getRecordDisplayName` (ADR-0079) — so the detail
 *      header matches gallery / calendar / lookup / search.
 *   4. `schema.title` (caller-provided override, typically the object label).
 *   5. `Record #<id>` floor, else the translated "Details" fallback.
 */
function resolveDisplayTitle(
  data: any,
  schema: DetailViewSchema,
  objectSchema: any,
  fallback: string,
): string {
  if (data && typeof data === 'object') {
    // 1. Explicit primary field wins (author's chosen header field).
    if (schema.primaryField) {
      const v = (data as any)[schema.primaryField];
      if (v !== null && v !== undefined && v !== '') return String(v);
    }
    // 2. titleFormat (kept first to preserve existing header behavior). The
    //    shared renderer walks dotted paths + embedded lookup objects and
    //    strips orphan separators around empty placeholders.
    const formatted = formatTitleTemplate(objectSchema?.titleFormat, data);
    if (formatted) return formatted;
  }
  // 3. Unified resolver (ADR-0079): displayNameField → type-aware field
  //    derivation, so an object whose name lives in e.g. `activity_name`
  //    (no titleFormat, no standard `name` field) still renders its real name
  //    here — matching gallery / calendar / lookup / search. We stop short of
  //    the resolver's `Record #<id>` floor because the detail header prefers
  //    the object label (`schema.title`) over a bare id; detect & skip it.
  if (data && typeof data === 'object') {
    const id = (data as any).id ?? (data as any)._id;
    // `deriveFromRecordKeys: false` → only the object-DECLARED identity
    // (displayNameField + type-aware field derivation) contributes here; a bare
    // record-key guess does NOT outrank the caller's `schema.title` object
    // label below. We also detect & skip the resolver's `Record #<id>` floor.
    const unified = getRecordDisplayName(objectSchema, data, { deriveFromRecordKeys: false });
    const isFloor =
      unified === 'Untitled' ||
      (id !== null && id !== undefined && unified === `Record #${id}`);
    if (!isFloor) return unified;
  }
  // 4. Caller-provided title override (object label).
  if (schema.title) return schema.title;
  // 5. `Record #<id>` floor, else the translated "Details" fallback.
  if (data && typeof data === 'object') {
    const id = (data as any).id ?? (data as any)._id;
    if (id !== null && id !== undefined && String(id).trim() !== '') {
      return `Record #${id}`;
    }
  }
  return fallback;
}

export interface DetailViewProps {
  schema: DetailViewSchema;
  dataSource?: DataSource;
  className?: string;
  onEdit?: () => void;
  onDelete?: () => void;
  onBack?: () => void;
  /**
   * Opt into inline editing. When true AND an `<InlineEditProvider>` is present
   * (with `canEdit`), fields surface the double-click / hover-pencil affordance
   * and edits stage into the shared draft (objectui#2407 P1). The Save/Cancel
   * bar + atomic persistence live in `<InlineEditSaveBar>`, rendered by the host.
   */
  inlineEdit?: boolean;
  /**
   * Optional discussion content rendered as a dedicated "Discussion" tab when
   * autoTabs is enabled. Lets the host page mount a rich chatter panel without
   * floating it below the detail body.
   */
  discussionSlot?: React.ReactNode;
  /**
   * Reserved: optional right-rail content (activity feed, related summary).
   * Currently accepted but rendered as a stacked block at the bottom; a
   * proper side-by-side layout is on the roadmap.
   */
  rightRail?: React.ReactNode;
  /**
   * Localized object label displayed in the header subtitle. When omitted,
   * `schema.objectName` is used as a fallback.
   */
  objectLabel?: string;
  /**
   * Optional callback fired whenever the detail record is loaded or refreshed
   * (after fetch, optimistic save, or schema-provided initial data). Lets the
   * host page surface the record's primary value (e.g. to a breadcrumb or
   * window title) without re-fetching.
   */
  onDataLoaded?: (record: any) => void;
  /**
   * Controlled favourite state for the header star button. When provided,
   * the legacy DetailView mirrors it instead of using its own local
   * state — letting hosts persist favourites (e.g. via `useFavorites`).
   */
  isFavorite?: boolean;
  /**
   * Called when the user clicks the header star. Receives the next state.
   */
  onToggleFavorite?: (next: boolean) => void;
}

export const DetailView: React.FC<DetailViewProps> = ({
  schema: rawSchema,
  dataSource,
  className,
  onEdit,
  onDelete,
  onBack,
  inlineEdit = false,
  discussionSlot,
  rightRail: _rightRail,
  objectLabel,
  onDataLoaded,
  isFavorite: isFavoriteProp,
  onToggleFavorite,
}) => {
  const [data, setData] = React.useState<any>(rawSchema.data);
  const [loading, setLoading] = React.useState(!rawSchema.data && !!((rawSchema.api && rawSchema.resourceId) || (dataSource && rawSchema.objectName && rawSchema.resourceId)));
  const [internalFavorite, setInternalFavorite] = React.useState(false);
  const isFavorite = isFavoriteProp ?? internalFavorite;
  // Inline-edit session is lifted to a shared record-level context
  // (objectui#2407 P1): DetailView no longer owns the edit draft/flags — it
  // reads them from <InlineEditProvider>. `inline` is null when a host renders
  // DetailView without a provider (bare / legacy usage) → read-only. The
  // Save/Cancel bar + atomic persistence live in <InlineEditSaveBar>.
  const inline = useInlineEdit();
  const isInlineEditing = inline?.editing ?? false;
  const editedValues = inline?.draft ?? EMPTY_DRAFT;
  const autoFocusField = inline?.autoFocusField ?? null;
  // Retained local error state for the approval-cancel flow ONLY — the
  // inline-edit draft now surfaces its own errors through the save bar.
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [objectSchema, setObjectSchema] = React.useState<any>(null);
  const [idCopied, setIdCopied] = React.useState(false);
  const [reloadTick, setReloadTick] = React.useState(0);
  // #2269 — refetch in place when this record (or its object) is invalidated
  // on the data bus (form save, record action, undo, any dataSource write).
  // Replaces the host's key={...} remount, which destroyed tab/scroll/inline
  // edit state on every refresh. Inert when the schema carries inline data
  // (the HOST owns fetching then and passes fresh data down).
  const invalidationNonce = useDataInvalidation(
    rawSchema.objectName || undefined,
    rawSchema.resourceId != null ? String(rawSchema.resourceId) : undefined,
  );
  const [isCancellingApproval, setIsCancellingApproval] = React.useState(false);
  const { t } = useDetailTranslation();
  // Tenant default currency (ADR-0053) for summary metrics whose field omits one.
  const { currency: tenantCurrency } = useLocalization();
  const { fieldOptionLabel } = useSafeFieldLabel();
  const isMobile = useIsMobile();

  // Field-level permission gate. Filter section.fields and top-level
  // fields based on the current user's read permissions BEFORE any
  // downstream use (summary fields, header highlight, autoTabs body,
  // section grouping, inline edit lookup, $expand build). When no
  // PermissionProvider is mounted, `perms.isLoaded` is false and the
  // schema passes through unchanged.
  const perms = usePermissions();
  const gatedSchema = React.useMemo<DetailViewSchema>(() => {
    if (!perms?.isLoaded || !rawSchema.objectName) return rawSchema;
    const canRead = (fieldName: string) =>
      perms.checkField(rawSchema.objectName!, fieldName, 'read');
    const filterFields = (arr?: any[]): any[] | undefined => {
      if (!arr) return arr;
      return arr.filter((f) => {
        const name = typeof f === 'string' ? f : f?.name;
        return !name || canRead(name);
      });
    };
    return {
      ...rawSchema,
      fields: filterFields(rawSchema.fields as any[]) as any,
      sections: rawSchema.sections?.map((s) => ({
        ...s,
        fields: filterFields(s.fields as any[]) as any,
      })),
      summaryFields: filterFields(rawSchema.summaryFields as any[]) as any,
    };
  }, [rawSchema, perms]);
  const schema = gatedSchema;


  // Fire onDataLoaded whenever the record changes so hosts can publish it
  // (e.g. to the navigation breadcrumb or document title).
  React.useEffect(() => {
    if (data && onDataLoaded) onDataLoaded(data);
  }, [data, onDataLoaded]);

  /**
   * Auto-detect "summary fields" for the header chip row when the schema does
   * not explicitly provide them. Heuristic: pick the first status/select-like
   * field, the first currency/number "main metric", and the first date.
   * Skipped entirely when explicit `summaryFields` are configured.
   */
  const autoSummaryFields = React.useMemo<string[]>(() => {
    if (schema.summaryFields && schema.summaryFields.length > 0) return [];
    const allFields = [
      ...(schema.sections?.flatMap((s) => s.fields) || []),
      ...(schema.fields || []),
    ];
    const fieldDefMap: Record<string, any> = {};
    for (const f of allFields) {
      if (!fieldDefMap[f.name]) fieldDefMap[f.name] = f;
    }
    if (objectSchema?.fields) {
      for (const [name, def] of Object.entries<any>(objectSchema.fields)) {
        fieldDefMap[name] = { ...(fieldDefMap[name] || {}), ...def, name };
      }
    }
    const has = (n: string) => data?.[n] !== undefined && data?.[n] !== null && data?.[n] !== '';
    const picks: string[] = [];
    // 1) status / stage / state / select with options
    const statusKeys = ['status', 'stage', 'state', 'phase'];
    const statusName = statusKeys.find((k) => fieldDefMap[k] && has(k))
      || Object.keys(fieldDefMap).find((n) => fieldDefMap[n]?.type === 'select' && has(n));
    if (statusName) picks.push(statusName);
    // 2) primary metric: currency or number whose name suggests value
    const moneyName = Object.keys(fieldDefMap).find(
      (n) => (fieldDefMap[n]?.type === 'currency' || /amount|revenue|value|total|price/i.test(n)) && has(n),
    );
    if (moneyName && !picks.includes(moneyName)) picks.push(moneyName);
    // 3) primary date
    const dateName = Object.keys(fieldDefMap).find(
      (n) => (fieldDefMap[n]?.type === 'date' || fieldDefMap[n]?.type === 'datetime')
        && /close|due|start|end|expected/i.test(n)
        && has(n),
    );
    if (dateName && !picks.includes(dateName)) picks.push(dateName);
    return picks;
  }, [schema.summaryFields, schema.sections, schema.fields, objectSchema, data]);

  const effectiveSummaryFields = schema.summaryFields && schema.summaryFields.length > 0
    ? schema.summaryFields
    : autoSummaryFields;

  const handleCopyRecordId = React.useCallback(() => {
    if (!schema.resourceId) return;
    navigator.clipboard.writeText(String(schema.resourceId)).then(() => {
      setIdCopied(true);
      setTimeout(() => setIdCopied(false), 1500);
    });
  }, [schema.resourceId]);


  // Fetch objectSchema + data with $expand when DataSource is provided
  React.useEffect(() => {
    let isMounted = true;

    // If inline data provided, use it directly. We still need to fetch the
    // objectSchema so that DetailSection can resolve field types (picklist
    // options, currency, references…). Without this, a remount that happens
    // *after* the parent has already loaded ctx.data (e.g. switching tabs
    // in record:details) would skip the schema fetch entirely and render
    // picklist values as raw enum keys like "existing_upgrade".
    if (schema.data) {
      setData(schema.data);
      setLoading(false);
      if (dataSource?.getObjectSchema && schema.objectName) {
        dataSource
          .getObjectSchema(schema.objectName)
          .then((resolvedSchema) => {
            if (isMounted) setObjectSchema(resolvedSchema);
          })
          .catch(() => {
            /* objectSchema is best-effort; renderer falls back to raw values */
          });
      }
      return () => {
        isMounted = false;
      };
    }

    if (dataSource && schema.objectName && schema.resourceId) {
      setLoading(true);
      // Clear stale state when navigating between objects/records
      setObjectSchema(null);
      setData(null);
      const objectName = schema.objectName;
      const resourceId = schema.resourceId;
      const prefix = `${objectName}-`;

      // Collect all visible fields from sections and top-level fields
      const allFields = [
        ...(schema.sections?.flatMap(s => s.fields) || []),
        ...(schema.fields || []),
      ];

      // Load objectSchema first, then fetch data with $expand
      const schemaPromise = dataSource.getObjectSchema
        ? dataSource.getObjectSchema(objectName).catch(() => null)
        : Promise.resolve(null);

      schemaPromise.then((resolvedSchema) => {
        if (!isMounted) return;
        setObjectSchema(resolvedSchema);

        // Compute $expand from objectSchema
        const expandFields = buildExpandFields(resolvedSchema?.fields, allFields);
        const params = expandFields.length > 0 ? { $expand: expandFields } : undefined;

        const findOnePromise = params
          ? dataSource.findOne(objectName, resourceId, params)
          : dataSource.findOne(objectName, resourceId);

        // Helper: try alternate ID format (strip or prepend objectName prefix)
        const tryAltId = () => {
          const resIdStr = String(resourceId);
          const altId = resIdStr.startsWith(prefix)
            ? resIdStr.slice(prefix.length)   // strip prefix
            : `${prefix}${resIdStr}`;          // prepend prefix
          return (params
            ? dataSource.findOne(objectName, altId, params)
            : dataSource.findOne(objectName, altId)
          ).then((fallbackResult) => {
            if (isMounted) {
              setData(fallbackResult);
              setLoading(false);
            }
          }).catch(() => {
            if (isMounted) {
              setData(null);
              setLoading(false);
            }
          });
        };

        return findOnePromise
          .catch(() => null) // Convert any error to null to trigger alternate ID fallback
          .then((result) => {
          if (!isMounted) return;
          if (result) {
            setData(result);
            setLoading(false);
            return;
          }
          // Fallback: try alternate ID format for backward compatibility
          return tryAltId();
        });
      }).catch((err) => {
         if (isMounted) {
           console.error('Failed to fetch detail data:', err);
           setLoading(false);
         }
      });
    } else if (schema.api && schema.resourceId) {
      setLoading(true);
      fetch(`${schema.api}/${schema.resourceId}`)
        .then(res => res.json())
        .then(result => {
          if (isMounted) {
            setData(result?.data || result);
          }
        })
        .catch(err => {
          console.error('Failed to fetch detail data:', err);
        })
        .finally(() => { if (isMounted) setLoading(false); });
    }

    return () => { isMounted = false; };
  }, [schema.api, schema.resourceId, schema.objectName, dataSource, schema.sections, schema.fields, reloadTick, invalidationNonce]);

  const handleBack = React.useCallback(() => {
    if (onBack) {
      onBack();
    } else if (schema.onNavigate) {
      // SPA-aware navigation
      const backUrl = schema.backUrl || (schema.objectName ? `/${schema.objectName}` : '/');
      schema.onNavigate(backUrl, { replace: true });
    } else if (schema.backUrl) {
      window.location.href = schema.backUrl;
    } else {
      window.history.back();
    }
  }, [onBack, schema]);

  const handleEdit = React.useCallback(() => {
    if (onEdit) {
      onEdit();
    } else if (schema.onNavigate && schema.editUrl) {
      // SPA-aware navigation
      schema.onNavigate(schema.editUrl);
    } else if (schema.onNavigate && schema.objectName && schema.resourceId) {
      // Build edit URL from object + resource
      schema.onNavigate(`/${schema.objectName}/${schema.resourceId}/edit`);
    } else if (schema.editUrl) {
      window.location.href = schema.editUrl;
    }
  }, [onEdit, schema]);

  const handleCancelApproval = React.useCallback(async () => {
    if (!dataSource?.cancelPendingApproval || !schema.objectName || !schema.resourceId) {
      setSaveError(t('detail.cancelApprovalUnavailable'));
      return;
    }
    setIsCancellingApproval(true);
    setSaveError(null);
    try {
      await dataSource.cancelPendingApproval(String(schema.objectName), String(schema.resourceId));
      // Refresh local data immediately so the lock badge disappears even
      // when our `data` was supplied via parent context (which bypasses
      // the load effect's reloadTick path).
      if (dataSource.findOne) {
        try {
          const fresh = await dataSource.findOne(
            String(schema.objectName),
            String(schema.resourceId),
          );
          if (fresh) setData(fresh);
        } catch {
          /* best-effort */
        }
      }
      // Bump the load-effect dep so any nested fetch (e.g. related lists)
      // re-runs against the now-recalled state.
      setReloadTick((n) => n + 1);
      // Notify upstream providers (e.g. RecordContextProvider in app-shell)
      // so they can re-sync their cached copy of the record. Listeners are
      // optional — this is fire-and-forget.
      try {
        window.dispatchEvent(new CustomEvent('objectui:record-changed', {
          detail: {
            objectName: String(schema.objectName),
            recordId: String(schema.resourceId),
            reason: 'approval-recalled',
          },
        }));
      } catch {
        /* SSR or restricted env */
      }
    } catch (err: any) {
      const raw = err?.message || err?.error || String(err ?? 'Cancel failed');
      const cleaned = raw
        .replace(/^\[[^\]]+\]\s*/, '')
        .replace(/^[A-Z][A-Z0-9_]+:\s*/, '');
      setSaveError(`${t('detail.cancelApprovalFailed')}: ${cleaned}`);
    } finally {
      setIsCancellingApproval(false);
    }
  }, [dataSource, schema.objectName, schema.resourceId, t]);

  const handleDelete = React.useCallback(() => {
    const confirmMessage = schema.deleteConfirmation || t('detail.deleteConfirmation');
    // Use window.confirm as fallback — the ActionProvider's onConfirm handler
    // will intercept this if wired up via the action system.
    if (window.confirm(confirmMessage)) {
      onDelete?.();
      // Navigate back after deletion if onNavigate available
      if (schema.onNavigate && schema.objectName) {
        schema.onNavigate(`/${schema.objectName}`, { replace: true });
      }
    }
  }, [onDelete, schema]);

  const handleShare = React.useCallback(() => {
    // Share functionality - could trigger share dialog or copy link
    if (navigator.share && schema.objectName && schema.resourceId) {
      navigator.share({
        title: schema.title || t('detail.details'),
        text: `${schema.objectName} #${schema.resourceId}`,
        url: window.location.href,
      }).catch((err) => console.log('Share failed:', err));
    } else {
      // Fallback: copy link to clipboard
      navigator.clipboard.writeText(window.location.href).then(() => {
        console.log('Link copied to clipboard');
      });
    }
  }, [schema]);

  // NOTE: Duplicate / Export / View History are intentionally hidden until
  // real implementations exist. See systemActions below.

  const handleToggleFavorite = React.useCallback(() => {
    const next = !isFavorite;
    if (onToggleFavorite) onToggleFavorite(next);
    if (isFavoriteProp === undefined) setInternalFavorite(next);
  }, [isFavorite, isFavoriteProp, onToggleFavorite]);

  // Thin bindings from the shared inline-edit context down into each
  // DetailSection, so the section render sites below stay unchanged. Staging a
  // field edit routes to the shared draft; entering edit is gated by `canEdit`
  // (object-lifecycle + permission) at the context source. Save/Cancel and
  // persistence are owned by <InlineEditSaveBar>, not DetailView.
  const handleInlineFieldChange = inline?.setField;
  const handleEnterInlineEditField =
    inline && inline.canEdit ? inline.enter : undefined;

  // Keyboard shortcuts for prev/next record navigation (← / →)
  React.useEffect(() => {
    if (!schema.recordNavigation) return;
    const nav = schema.recordNavigation;
    const handler = (e: KeyboardEvent) => {
      // Skip when focus is inside an input, textarea, or contenteditable
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) return;
      if (e.key === 'ArrowLeft' && nav.currentIndex > 0) {
        e.preventDefault();
        nav.onNavigate(nav.recordIds[nav.currentIndex - 1]);
      } else if (e.key === 'ArrowRight' && nav.currentIndex < nav.recordIds.length - 1) {
        e.preventDefault();
        nav.onNavigate(nav.recordIds[nav.currentIndex + 1]);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [schema.recordNavigation]);

  // Auto-discovery of related panels via INVERSE references (other objects
  // whose FK points to the current record) is the responsibility of the
  // page layer (e.g. RecordDetailView), which has access to the registry of
  // all objects. We deliberately do NOT auto-derive related panels from the
  // current object's *forward* lookups (account, owner, …) — those are
  // parent references already surfaced as detail fields, and listing them
  // here always produces empty 0-count panels with no usable "+ New" CTA
  // (the new child wouldn't have an FK to back-fill). Leaving them out
  // avoids the misleading "为什么有的能新建有的不能" experience.
  const effectiveRelated: NonNullable<DetailViewSchema['related']> = React.useMemo(() => {
    return schema.related ?? [];
  }, [schema.related]);

  /**
   * Chrome-level "system" actions (Duplicate, Export, View History, Delete,
   * and mobile-only fallbacks for Share / Edit / Inline Edit) expressed as
   * {@link ActionSchema} entries. These are funnelled into the *single*
   * overflow menu of the record-header `action:bar` via its `systemActions`
   * field, guaranteeing at most one "More" button on the header regardless
   * of how many business actions the object metadata contributes.
   *
   * `onClick` is used as a UI-local escape hatch because these handlers
   * depend on React state (e.g., `isInlineEditing`) and local DOM APIs
   * (`navigator.share`, `navigator.clipboard`) that are not part of the
   * server-driven action protocol.
   */
  const systemActions = React.useMemo<ActionSchema[]>(() => {
    // System action items use a UI-local shape (`type: 'script'`,
    // `variant: 'destructive'`, `onClick`) that doesn't perfectly conform
    // to the canonical ActionSchema discriminated union. Cast at the
    // boundary so call sites can keep treating them as ActionSchema[].
    const items: any[] = [];

    // Share lives in the unified overflow on every breakpoint — keeps the
    // header focused on the primary Edit CTA. (Was sm:hidden previously.)
    items.push({
      name: 'sys_share',
      label: t('detail.share'),
      icon: 'share-2',
      type: 'script',
      onClick: handleShare,
    });
    if (schema.showEdit) {
      items.push({
        name: 'sys_edit_mobile',
        label: t('detail.edit'),
        icon: 'edit',
        type: 'script',
        className: 'sm:hidden',
        onClick: handleEdit,
      });
    }
    // No mobile inline-edit toggle: on touch (no hover / double-click) the
    // primary Edit CTA — which opens the full form — is the single edit path,
    // so we don't reintroduce a competing "Edit fields" entry in the overflow.

    // Universal record-level utilities (desktop + mobile).
    // Duplicate / Export / View History are intentionally omitted until
    // real implementations land — previously they only emitted console.log
    // and surfacing fake actions to end users is misleading.

    // Destructive action — separated and styled via variant.
    if (schema.showDelete) {
      items.push({
        name: 'sys_delete',
        label: t('detail.delete'),
        icon: 'trash-2',
        type: 'script',
        variant: 'destructive',
        tags: ['separator-before'],
        onClick: handleDelete,
      });
    }

    return items as ActionSchema[];
  }, [
    t,
    schema.showEdit,
    schema.showDelete,
    handleShare,
    handleEdit,
    handleDelete,
  ]);

  /**
   * Inject `systemActions` into the record-header `action:bar` if one was
   * provided via `schema.actions`; otherwise append a new header `action:bar`
   * that carries only the system actions. The goal is to always render a
   * single, unified overflow menu containing both business-action overflow
   * and system actions.
   */
  const headerActionNodes = React.useMemo<SchemaNode[]>(() => {
    // `schema.actions` is typed as ActionSchema[] by DetailViewSchema, but
    // in practice RecordDetailView (and consumers) pass through full UI
    // schema nodes like `action:bar` so they can be rendered by
    // SchemaRenderer. Treat each entry as an opaque SchemaNode here.
    const actions = (schema.actions ?? []) as unknown as SchemaNode[];
    if (systemActions.length === 0) return actions;
    let injected = false;
    const mapped: SchemaNode[] = actions.map((node) => {
      const record = node as Record<string, unknown> | null;
      if (
        record &&
        typeof record === 'object' &&
        record.type === 'action:bar' &&
        (!record.location || record.location === 'record_header')
      ) {
        injected = true;
        const existingSystem = Array.isArray(record.systemActions)
          ? (record.systemActions as ActionSchema[])
          : [];
        return {
          ...record,
          systemActions: [...existingSystem, ...systemActions],
        } as unknown as SchemaNode;
      }
      return node;
    });
    if (!injected) {
      mapped.push({
        type: 'action:bar',
        location: 'record_header',
        systemActions,
      } as unknown as SchemaNode);
    }
    return mapped;
  }, [schema.actions, systemActions]);

  if (loading || schema.loading) {
    return (
      <div className={cn('space-y-4', className)}>
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!data && !schema.data) {
    return (
      <div className={cn('flex flex-col items-center justify-center py-16 text-center', className)}>
        <p className="text-lg font-semibold">{t('detail.recordNotFound')}</p>
        <p className="text-sm text-muted-foreground mt-1">
          {t('detail.recordNotFoundDescription')}
        </p>
        {(schema.showBack ?? true) && (
          <Button variant="outline" size="sm" onClick={handleBack} className="mt-4 gap-2">
            <ArrowLeft className="h-4 w-4" />
            {t('detail.goBack')}
          </Button>
        )}
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className={cn('space-y-6', className)}>
        {/* Header - Airtable-inspired layout. Suppressed when the host page
            renders its own `page:header` (e.g. record:details embedded
            under a Lightning-style page) to avoid a duplicate title chip. */}
        {schema.showHeader !== false && (
        <div className="flex flex-col sm:flex-row items-start justify-between gap-3 sm:gap-4 pb-4 border-b">
          <div className="flex items-start gap-2 sm:gap-3 flex-1 min-w-0">
            {(schema.showBack ?? true) && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={handleBack} className="shrink-0 mt-1">
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('detail.back')}</TooltipContent>
              </Tooltip>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold truncate">
                  {resolveDisplayTitle(data, schema, objectSchema, t('detail.details'))}
                </h1>
                {effectiveSummaryFields.map((fieldName) => {
                  const val = data?.[fieldName];
                  if (val === null || val === undefined || val === '') return null;
                  // Format value based on field type from schema or objectSchema.
                  // Best-effort: currency → localized currency, date/datetime →
                  // localized date string, others → String(val).
                  const sectionField = (schema.sections || [])
                    .flatMap((s) => s.fields)
                    .concat(schema.fields || [])
                    .find((f) => f.name === fieldName);
                  const objField = objectSchema?.fields?.[fieldName];
                  const ftype = sectionField?.type || objField?.type;
                  let display: string = String(val);
                  let percentValue: number | null = null;
                  try {
                    if (ftype === 'currency') {
                      const num = Number(val);
                      if (!Number.isNaN(num)) {
                        const cur = resolveFieldCurrency({ ...(objField as any), ...(sectionField as any) }, tenantCurrency);
                        display = cur
                          ? new Intl.NumberFormat(undefined, {
                              style: 'currency',
                              currency: cur,
                              maximumFractionDigits: 0,
                            }).format(num)
                          : new Intl.NumberFormat(undefined, {
                              maximumFractionDigits: 0,
                            }).format(num);
                      }
                    } else if (ftype === 'date' || ftype === 'datetime') {
                      const d = new Date(val);
                      if (!Number.isNaN(d.getTime())) {
                        display = ftype === 'datetime'
                          ? d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
                          : d.toLocaleDateString(undefined, { dateStyle: 'medium' } as any);
                      }
                    } else if (ftype === 'percent') {
                      const num = Number(val);
                      if (!Number.isNaN(num)) {
                        display = `${num}%`;
                        // Normalize to 0..100 for the bar; values <=1 are
                        // treated as ratios (0.6 → 60%), otherwise capped.
                        const normalized = num <= 1 ? num * 100 : num;
                        percentValue = Math.max(0, Math.min(100, normalized));
                      }
                    } else if (ftype === 'select' || ftype === 'status' || ftype === 'multiselect') {
                      // Resolve raw option label from field metadata as
                      // fallback, then translate via i18n resolver.
                      const opts = (sectionField as any)?.options || objField?.options;
                      let fallback = String(val);
                      if (Array.isArray(opts)) {
                        const m = opts.find((o: any) => String(o?.value ?? o) === String(val));
                        if (m?.label) fallback = m.label;
                      } else if (opts && typeof opts === 'object') {
                        const m = (opts as any)[String(val)];
                        if (m?.label) fallback = m.label;
                      }
                      display = schema.objectName
                        ? fieldOptionLabel(schema.objectName, fieldName, String(val), fallback)
                        : fallback;
                    }
                  } catch {
                    /* fall back to String(val) */
                  }
                  if (percentValue !== null) {
                    return (
                      <Badge
                        key={fieldName}
                        variant="secondary"
                        className="text-xs bg-primary/10 text-primary border-transparent hover:bg-primary/15 gap-1.5 pl-2 pr-2"
                        aria-label={`${fieldName}: ${display}`}
                      >
                        <span
                          className="relative inline-block h-1.5 w-12 rounded-full bg-primary/20 overflow-hidden"
                          aria-hidden
                        >
                          <span
                            className="absolute inset-y-0 left-0 rounded-full bg-primary"
                            style={{ width: `${percentValue}%` }}
                          />
                        </span>
                        {display}
                      </Badge>
                    );
                  }
                  return (
                    <Badge
                      key={fieldName}
                      variant="secondary"
                      className="text-xs bg-primary/10 text-primary border-transparent hover:bg-primary/15"
                      aria-label={`${fieldName}: ${display}`}
                    >
                      {display}
                    </Badge>
                  );
                })}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6 shrink-0"
                      onClick={handleToggleFavorite}
                      aria-label={isFavorite ? t('detail.removeFromFavorites') : t('detail.addToFavorites')}
                    >
                      {isFavorite ? (
                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      ) : (
                        <Star className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {isFavorite ? t('detail.removeFromFavorites') : t('detail.addToFavorites')}
                  </TooltipContent>
                </Tooltip>
              </div>
              {schema.objectName && (
                <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                  <span className="font-medium">{objectLabel || schema.objectName}</span>
                  {schema.resourceId && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 shrink-0 text-muted-foreground/60 hover:text-foreground"
                          onClick={handleCopyRecordId}
                          aria-label={t('detail.copyRecordId', { defaultValue: 'Copy record ID' })}
                        >
                          {idCopied ? (
                            <Check className="h-3 w-3 text-green-600" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {idCopied
                          ? t('detail.copied', { defaultValue: 'Copied' })
                          : t('detail.copyRecordId', { defaultValue: 'Copy record ID' })}
                      </TooltipContent>
                    </Tooltip>
                  )}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 shrink-0 w-full sm:w-auto">
            {/* Prev/Next Record Navigation */}
            {schema.recordNavigation && (
              <div className="flex items-center gap-1 mr-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      disabled={schema.recordNavigation.currentIndex <= 0}
                      onClick={() => {
                        const nav = schema.recordNavigation!;
                        if (nav.currentIndex > 0) {
                          nav.onNavigate(nav.recordIds[nav.currentIndex - 1]);
                        }
                      }}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t('detail.previousRecord')}</TooltipContent>
                </Tooltip>
                <span className="text-xs text-muted-foreground whitespace-nowrap px-1">
                  {t('detail.recordOf', { current: schema.recordNavigation.currentIndex + 1, total: schema.recordNavigation.recordIds.length })}
                </span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      disabled={schema.recordNavigation.currentIndex >= schema.recordNavigation.recordIds.length - 1}
                      onClick={() => {
                        const nav = schema.recordNavigation!;
                        if (nav.currentIndex < nav.recordIds.length - 1) {
                          nav.onNavigate(nav.recordIds[nav.currentIndex + 1]);
                        }
                      }}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t('detail.nextRecord')}</TooltipContent>
                </Tooltip>
              </div>
            )}

            {/* The inline-edit Save / Cancel bar now lives in the record-level
                <InlineEditSaveBar> (rendered by the host), not the header —
                so the highlights strip and the details body share one bar and
                one atomic Save (objectui#2407 P1). */}

            {/* Share moved into the unified overflow menu (sys_share) so the
                header focuses on the primary Edit CTA. */}

            {/* Edit Button — desktop-only primary CTA. Mobile fallback is in
                the unified overflow via `systemActions`. */}
            {schema.showEdit && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="default" onClick={handleEdit} className="gap-2 hidden sm:inline-flex">
                    <Edit className="h-4 w-4" />
                    <span className="hidden sm:inline">{t('detail.edit')}</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('detail.editRecord')}</TooltipContent>
              </Tooltip>
            )}

            {/* Header business actions (and the unified "..." overflow menu
                that holds systemActions) render LAST so the three-dot more
                menu sits at the far right edge — the standard placement
                for "more options" affordances. */}
            {headerActionNodes.map((action, index) => (
              <SchemaRenderer key={`header-action-${index}`} schema={action} data={data} />
            ))}
          </div>
        </div>
        )}

      {/* Custom Header */}
      {schema.header && (
        <div>
          <SchemaRenderer schema={schema.header} data={data} />
        </div>
      )}

      {/* Header Highlight Area */}
      {schema.highlightFields && schema.highlightFields.length > 0 && (
        <HeaderHighlight fields={schema.highlightFields} data={data} objectName={schema.objectName} objectSchema={objectSchema} />
      )}

      {/* Approval-lock band — when the DetailView's own header is suppressed
          (composed under a Lightning-style page:header), surface the approval
          lock reason + recall affordance inline. The inline-edit Save / Cancel
          bar itself now lives in the record-level <InlineEditSaveBar>
          (objectui#2407 P1); this band is lock-only. */}
      {inlineEdit && schema.showHeader === false && (() => {
        // Detect approval lock on the live record. When `approval_status`
        // is `pending`/`in_approval`, the backend will reject any update
        // with RECORD_LOCKED — show the lock badge inline so users see
        // a clear reason instead of editing and failing on save.
        const approvalStatus = data?.approval_status;
        const isLocked = approvalStatus === 'pending' || approvalStatus === 'in_approval';
        // Nothing to surface (not locked, no approval-cancel error): no band.
        if (!isLocked && !saveError) return null;
        return (
        <div className="flex flex-col items-end gap-1">
          {isLocked && (
            <div className="flex items-center justify-end gap-2">
              <span
                role="status"
                className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-800"
                title={t('detail.lockedTooltip')}
              >
                <Lock className="h-3 w-3" />
                <span>{t('detail.lockedByApproval')}</span>
              </span>
              {dataSource?.cancelPendingApproval && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancelApproval}
                  disabled={isCancellingApproval}
                  className="gap-2 border-amber-300 text-amber-800 hover:bg-amber-50"
                  title={t('detail.cancelApprovalTooltip')}
                >
                  <X className="h-4 w-4" />
                  <span>
                    {isCancellingApproval
                      ? t('detail.cancelApprovalInFlight')
                      : t('detail.cancelApproval')}
                  </span>
                </Button>
              )}
            </div>
          )}
          {saveError && (
            <div
              role="alert"
              className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-2 py-1 max-w-md text-right"
            >
              {saveError}
            </div>
          )}
        </div>
        );
      })()}

      {/* Auto Tabs mode: wrap sections, related, activity into tabs.
          When only the Details tab would render (no related, no activity, no
          discussion), skip the Tabs strip entirely — it's pure visual noise. */}
      {schema.autoTabs && !schema.tabs?.length ? (() => {
        const hasRelated = effectiveRelated.length > 0;
        const hasActivity = !!schema.activities && schema.activities.length > 0;
        const hasDiscussion = !!discussionSlot;
        const hasHistory = !!schema.history;
        // objectui#2257 — the host may supply the initial tab (restored from
        // `?tab=`) and a change callback (writes it back). Honored only when
        // the requested value names a tab that actually renders; the active
        // tab must survive this component remounting, so it cannot live only
        // in Radix's uncontrolled state.
        const tabValues = [
          'details',
          ...(hasRelated ? ['related'] : []),
          ...(hasActivity ? ['activity'] : []),
          ...(hasDiscussion ? ['discussion'] : []),
          ...(hasHistory ? ['history'] : []),
        ];
        const requestedTab = (schema as any).defaultTab as string | undefined;
        const initialTab = requestedTab && tabValues.includes(requestedTab) ? requestedTab : 'details';
        const onTabChange = (schema as any).onTabChange as ((value: string) => void) | undefined;
        const detailsContent = (
          <div className="space-y-3 sm:space-y-4">
            {/* Section Groups */}
            {schema.sectionGroups && schema.sectionGroups.length > 0 && (
              schema.sectionGroups.map((group, index) => (
                <SectionGroup
                  key={index}
                  group={group}
                  data={{ ...data, ...editedValues }}
                  objectSchema={objectSchema}
                  objectName={schema.objectName}
                  isEditing={isInlineEditing}
                  onFieldChange={handleInlineFieldChange}
                  onEnterInlineEdit={inlineEdit ? handleEnterInlineEditField : undefined}
                  autoFocusField={autoFocusField}
                  dataSource={dataSource}
                />
              ))
            )}
            {schema.sections && schema.sections.length > 0 && (
              schema.sections.map((section, index) => (
                <DetailSection
                  key={index}
                  section={section}
                  data={{ ...data, ...editedValues }}
                  objectSchema={objectSchema}
                  objectName={schema.objectName}
                  isEditing={isInlineEditing}
                  onFieldChange={handleInlineFieldChange}
                  onEnterInlineEdit={inlineEdit ? handleEnterInlineEditField : undefined}
                  autoFocusField={autoFocusField}
                  dataSource={dataSource}
                />
              ))
            )}
            {schema.fields && schema.fields.length > 0 && !schema.sections?.length && (
              <DetailSection
                section={{
                  fields: schema.fields,
                  columns: schema.columns,
                }}
                data={{ ...data, ...editedValues }}
                objectSchema={objectSchema}
                objectName={schema.objectName}
                isEditing={isInlineEditing}
                onFieldChange={handleInlineFieldChange}
                onEnterInlineEdit={inlineEdit ? handleEnterInlineEditField : undefined}
                autoFocusField={autoFocusField}
                dataSource={dataSource}
              />
            )}
            {/* Comments in details tab */}
            {schema.comments && (
              <RecordComments
                comments={schema.comments}
                onAddComment={schema.onAddComment}
              />
            )}
          </div>
        );

        if (!hasRelated && !hasActivity && !hasDiscussion && !hasHistory) {
          // Single-tab case: render just the details content without a tab strip.
          return <div className="mt-2">{detailsContent}</div>;
        }

        return (
          <Tabs defaultValue={initialTab} onValueChange={onTabChange} className="w-full">
            <TabsList className="w-full justify-start border-b rounded-none bg-transparent p-0">
              <TabsTrigger
                value="details"
                className="relative rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
              >
                {t('detail.details')}
              </TabsTrigger>
              {hasRelated && (
                <TabsTrigger
                  value="related"
                  className="relative rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
                >
                  <span className="flex items-center gap-1.5">
                    {t('detail.related')}
                    <Badge variant="secondary" className="text-xs bg-primary/10 text-primary border-transparent">{effectiveRelated.length}</Badge>
                  </span>
                </TabsTrigger>
              )}
              {hasActivity && (
                <TabsTrigger
                  value="activity"
                  className="relative rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
                >
                  <span className="flex items-center gap-1.5">
                    {t('detail.activity')}
                    <Badge variant="secondary" className="text-xs bg-primary/10 text-primary border-transparent">{schema.activities!.length}</Badge>
                  </span>
                </TabsTrigger>
              )}
              {hasDiscussion && (
                <TabsTrigger
                  value="discussion"
                  className="relative rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
                >
                  {t('detail.discussion', { defaultValue: 'Discussion' })}
                </TabsTrigger>
              )}
              {hasHistory && (
                <TabsTrigger
                  value="history"
                  className="relative rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
                >
                  <span className="flex items-center gap-1.5">
                    {t('detail.history', { defaultValue: 'History' })}
                    {!schema.history!.loading && schema.history!.entries.length > 0 && (
                      <Badge variant="secondary" className="text-xs bg-primary/10 text-primary border-transparent">
                        {schema.history!.entries.length}
                      </Badge>
                    )}
                  </span>
                </TabsTrigger>
              )}
            </TabsList>

            {/* Details Tab Content */}
            <TabsContent value="details" className="mt-4 motion-safe:data-[state=active]:animate-in motion-safe:data-[state=active]:fade-in-0 motion-safe:duration-150">
              {detailsContent}
            </TabsContent>

            {/* Related Tab Content */}
            {hasRelated && (
              <TabsContent value="related" className="mt-4 motion-safe:data-[state=active]:animate-in motion-safe:data-[state=active]:fade-in-0 motion-safe:duration-150">
                <div className="space-y-3">
                  {effectiveRelated.map((related, index) => (
                    <RelatedList
                      key={index}
                      title={related.title}
                      type={related.type}
                      api={related.api}
                      data={related.data}
                      columns={related.columns as any}
                      dataSource={dataSource}
                      objectName={related.api}
                      referenceField={(related as any).referenceField}
                      icon={(related as any).icon}
                      onNew={(related as any).onNew}
                      onViewAll={(related as any).onViewAll}
                      onRowClick={(related as any).onRowClick}
                      onRowEdit={(related as any).onRowEdit}
                      onRowDelete={(related as any).onRowDelete}
                      collapsible
                      defaultCollapsed={isMobile && index > 0}
                      pageSize={DEFAULT_RELATED_PAGE_SIZE}
                    />
                  ))}
                </div>
              </TabsContent>
            )}

            {/* Activity Tab Content */}
            {hasActivity && (
              <TabsContent value="activity" className="mt-4 motion-safe:data-[state=active]:animate-in motion-safe:data-[state=active]:fade-in-0 motion-safe:duration-150">
                <ActivityTimeline activities={schema.activities!} />
              </TabsContent>
            )}

            {/* Discussion Tab Content */}
            {hasDiscussion && (
              <TabsContent value="discussion" className="mt-4 motion-safe:data-[state=active]:animate-in motion-safe:data-[state=active]:fade-in-0 motion-safe:duration-150">
                {discussionSlot}
              </TabsContent>
            )}

            {/* History Tab Content */}
            {hasHistory && (
              <TabsContent value="history" className="mt-4 motion-safe:data-[state=active]:animate-in motion-safe:data-[state=active]:fade-in-0 motion-safe:duration-150">
                <HistoryTimeline
                  entries={schema.history!.entries}
                  loading={schema.history!.loading}
                  emptyText={schema.history!.emptyText ?? t('detail.historyEmpty', { defaultValue: 'No history yet' })}
                />
              </TabsContent>
            )}
          </Tabs>
        );
      })() : (
        <>
          {/* Section Groups */}
          {schema.sectionGroups && schema.sectionGroups.length > 0 && (
            <div className="space-y-3 sm:space-y-4">
              {schema.sectionGroups.map((group, index) => (
                <SectionGroup
                  key={index}
                  group={group}
                  data={{ ...data, ...editedValues }}
                  objectSchema={objectSchema}
                  objectName={schema.objectName}
                  isEditing={isInlineEditing}
                  onFieldChange={handleInlineFieldChange}
                  onEnterInlineEdit={inlineEdit ? handleEnterInlineEditField : undefined}
                  autoFocusField={autoFocusField}
                  dataSource={dataSource}
                />
              ))}
            </div>
          )}

          {/* Sections */}
          {schema.sections && schema.sections.length > 0 && (
            <div className="space-y-3 sm:space-y-4">
              {schema.sections.map((section, index) => (
                <DetailSection
                  key={index}
                  section={section}
                  data={{ ...data, ...editedValues }}
                  objectSchema={objectSchema}
                  objectName={schema.objectName}
                  isEditing={isInlineEditing}
                  onFieldChange={handleInlineFieldChange}
                  onEnterInlineEdit={inlineEdit ? handleEnterInlineEditField : undefined}
                  autoFocusField={autoFocusField}
                  dataSource={dataSource}
                />
              ))}
            </div>
          )}

          {/* Direct Fields (if no sections) */}
          {schema.fields && schema.fields.length > 0 && !schema.sections?.length && (
            <DetailSection
              section={{
                fields: schema.fields,
                columns: schema.columns,
              }}
              data={{ ...data, ...editedValues }}
              objectSchema={objectSchema}
              objectName={schema.objectName}
              isEditing={isInlineEditing}
              onFieldChange={handleInlineFieldChange}
              onEnterInlineEdit={inlineEdit ? handleEnterInlineEditField : undefined}
              autoFocusField={autoFocusField}
              dataSource={dataSource}
            />
          )}

          {/* Tabs */}
          {schema.tabs && schema.tabs.length > 0 && (
            <DetailTabs tabs={schema.tabs} data={data} />
          )}

          {/* Related Lists */}
          {effectiveRelated.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold">{t('detail.related')}</h2>
              {effectiveRelated.map((related, index) => (
                <RelatedList
                  key={index}
                  title={related.title}
                  type={related.type}
                  api={related.api}
                  data={related.data}
                  columns={related.columns as any}
                  dataSource={dataSource}
                  objectName={related.api}
                  referenceField={(related as any).referenceField}
                  icon={(related as any).icon}
                  onNew={(related as any).onNew}
                  onViewAll={(related as any).onViewAll}
                  onRowClick={(related as any).onRowClick}
                  onRowEdit={(related as any).onRowEdit}
                  onRowDelete={(related as any).onRowDelete}
                  collapsible
                  defaultCollapsed={isMobile && index > 0}
                  pageSize={DEFAULT_RELATED_PAGE_SIZE}
                />
              ))}
            </div>
          )}

          {/* Comments */}
          {schema.comments && (
            <RecordComments
              comments={schema.comments}
              onAddComment={schema.onAddComment}
            />
          )}

          {/* Activity Timeline */}
          {schema.activities && schema.activities.length > 0 && (
            <ActivityTimeline activities={schema.activities} />
          )}
        </>
      )}

      {/* Record provenance footer — replaces the old "System Information"
          section with a low-visual-weight single-line summary of audit
          fields (created/updated by + when). Renders nothing when none of
          the audit fields are present on the record. */}
      <RecordMetaFooter
        data={{ ...data, ...editedValues }}
        objectSchema={objectSchema}
        objectName={schema.objectName}
      />

      {/* Custom Footer */}
      {schema.footer && (
        <div>
          <SchemaRenderer schema={schema.footer} data={data} />
        </div>
      )}
      </div>
    </TooltipProvider>
  );
};
