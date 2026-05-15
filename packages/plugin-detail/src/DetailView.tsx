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
} from '@object-ui/components';
import { 
  ArrowLeft, 
  Edit, 
  Star,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  X,
} from 'lucide-react';
import { DetailSection } from './DetailSection';
import { DetailTabs } from './DetailTabs';
import { RelatedList } from './RelatedList';
import { SectionGroup } from './SectionGroup';
import { HeaderHighlight } from './HeaderHighlight';
import { RecordComments } from './RecordComments';
import { ActivityTimeline } from './ActivityTimeline';
import { SchemaRenderer, useSafeFieldLabel } from '@object-ui/react';
import { buildExpandFields } from '@object-ui/core';
import type { DetailViewSchema, DataSource, ActionSchema, SchemaNode } from '@object-ui/types';
import { useDetailTranslation } from './useDetailTranslation';

/** Default page size for related lists in the detail view */
const DEFAULT_RELATED_PAGE_SIZE = 5;

/**
 * Resolve the human-readable title for the detail header.
 *
 * Priority order:
 *   1. `schema.primaryField` value on the record
 *   2. Render `objectSchema.titleFormat` (e.g. `{full_name} - {company}`),
 *      stripping orphan separators around empty placeholders.
 *   3. `schema.title` (caller-provided override, typically the object label)
 *   4. Common name-like fields on the record (`name`, `full_name`, …)
 *   5. Translated "Details" fallback.
 */
function resolveDisplayTitle(
  data: any,
  schema: DetailViewSchema,
  objectSchema: any,
  fallback: string,
): string {
  if (data && typeof data === 'object') {
    if (schema.primaryField) {
      const v = (data as any)[schema.primaryField];
      if (v !== null && v !== undefined && v !== '') return String(v);
    }
    const rawTitleFormat: any = objectSchema?.titleFormat;
    const titleFormat: string | undefined =
      typeof rawTitleFormat === 'string'
        ? rawTitleFormat
        : (rawTitleFormat && typeof rawTitleFormat === 'object' && typeof rawTitleFormat.source === 'string')
          ? rawTitleFormat.source
          : undefined;
    if (titleFormat) {
      const EMPTY = '\u0000';
      const SEP = '[-\\u2013\\u2014|/·,:]';
      let any = false;
      const raw = titleFormat.replace(/\{([^{}]+)\}/g, (_m, key) => {
        const v = (data as any)[key.trim()];
        if (v !== null && v !== undefined && v !== '') {
          any = true;
          return String(v);
        }
        return EMPTY;
      });
      if (any) {
        const out = raw
          .replace(new RegExp(`\\s*${SEP}\\s*${EMPTY}`, 'g'), '')
          .replace(new RegExp(`${EMPTY}\\s*${SEP}\\s*`, 'g'), '')
          .replace(new RegExp(EMPTY, 'g'), '')
          .replace(/\s+/g, ' ')
          .trim();
        if (out) return out;
      }
    }
  }
  if (schema.title) return schema.title;
  if (data && typeof data === 'object') {
    for (const k of ['name', 'full_name', 'fullName', 'title', 'subject', 'label', 'display_name', 'displayName']) {
      const v = (data as any)[k];
      if (typeof v === 'string' && v.trim()) return v.trim();
      if (v !== null && v !== undefined && v !== '') return String(v);
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
  /** Enable inline editing toggle for detail fields */
  inlineEdit?: boolean;
  /** Callback when a field value is saved inline */
  onFieldSave?: (field: string, value: any, record: any) => void | Promise<void>;
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
}

export const DetailView: React.FC<DetailViewProps> = ({
  schema,
  dataSource,
  className,
  onEdit,
  onDelete,
  onBack,
  inlineEdit = false,
  onFieldSave,
  discussionSlot,
  rightRail: _rightRail,
  objectLabel,
  onDataLoaded,
}) => {
  const [data, setData] = React.useState<any>(schema.data);
  const [loading, setLoading] = React.useState(!schema.data && !!((schema.api && schema.resourceId) || (dataSource && schema.objectName && schema.resourceId)));
  const [isFavorite, setIsFavorite] = React.useState(false);
  const [isInlineEditing, setIsInlineEditing] = React.useState(false);
  const [editedValues, setEditedValues] = React.useState<Record<string, any>>({});
  const [objectSchema, setObjectSchema] = React.useState<any>(null);
  const [idCopied, setIdCopied] = React.useState(false);
  const { t } = useDetailTranslation();
  const { fieldOptionLabel } = useSafeFieldLabel();

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

    // If inline data provided, use it
     if (schema.data) {
        setData(schema.data);
        setLoading(false);
        return;
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
  }, [schema.api, schema.resourceId, schema.objectName, dataSource, schema.sections, schema.fields]);

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
    setIsFavorite(!isFavorite);
  }, [isFavorite]);

  const handleInlineEditToggle = React.useCallback(() => {
    if (isInlineEditing) {
      // Save changes
      const changes = Object.entries(editedValues);
      if (changes.length > 0) {
        const updatedData = { ...data, ...editedValues };
        setData(updatedData);
        changes.forEach(([field, value]) => {
          onFieldSave?.(field, value, updatedData);
        });
      }
      setEditedValues({});
    }
    setIsInlineEditing(!isInlineEditing);
  }, [isInlineEditing, editedValues, data, onFieldSave]);

  const handleInlineEditCancel = React.useCallback(() => {
    setEditedValues({});
    setIsInlineEditing(false);
  }, []);

  const handleInlineFieldChange = React.useCallback((field: string, value: any) => {
    setEditedValues(prev => ({ ...prev, [field]: value }));
  }, []);

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
    if (inlineEdit) {
      items.push({
        name: 'sys_toggle_inline_edit_mobile',
        label: isInlineEditing ? t('detail.save') : t('detail.editInline'),
        icon: 'edit',
        type: 'script',
        className: 'sm:hidden',
        onClick: handleInlineEditToggle,
      });
    }

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
    inlineEdit,
    isInlineEditing,
    handleShare,
    handleEdit,
    handleInlineEditToggle,
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
        {/* Header - Airtable-inspired layout */}
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
                        display = new Intl.NumberFormat(undefined, {
                          style: 'currency',
                          currency: (sectionField as any)?.currency || objField?.currency || 'USD',
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

            {/* Inline Edit Toggle — desktop-only chrome.
                Mobile fallback lives inside the unified action:bar overflow
                menu as a `systemActions` entry with `sm:hidden`. */}
            {inlineEdit && (
              <>
                {isInlineEditing && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleInlineEditCancel}
                        className="gap-2 hidden sm:inline-flex"
                      >
                        <X className="h-4 w-4" />
                        <span className="hidden sm:inline">{t('detail.cancel')}</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{t('detail.cancelEdit')}</TooltipContent>
                  </Tooltip>
                )}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={isInlineEditing ? 'default' : 'outline'}
                      size="sm"
                      onClick={handleInlineEditToggle}
                      className="gap-2 hidden sm:inline-flex"
                    >
                      {isInlineEditing ? (
                        <>
                          <Check className="h-4 w-4" />
                          <span className="hidden sm:inline">{t('detail.save')}</span>
                        </>
                      ) : (
                        <>
                          <Edit className="h-4 w-4" />
                          <span className="hidden sm:inline">{t('detail.editInline')}</span>
                        </>
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {isInlineEditing ? t('detail.saveChanges') : t('detail.editFieldsInline')}
                  </TooltipContent>
                </Tooltip>
              </>
            )}

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

      {/* Auto Tabs mode: wrap sections, related, activity into tabs.
          When only the Details tab would render (no related, no activity, no
          discussion), skip the Tabs strip entirely — it's pure visual noise. */}
      {schema.autoTabs && !schema.tabs?.length ? (() => {
        const hasRelated = effectiveRelated.length > 0;
        const hasActivity = !!schema.activities && schema.activities.length > 0;
        const hasDiscussion = !!discussionSlot;
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

        if (!hasRelated && !hasActivity && !hasDiscussion) {
          // Single-tab case: render just the details content without a tab strip.
          return <div className="mt-2">{detailsContent}</div>;
        }

        return (
          <Tabs defaultValue="details" className="w-full">
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
            </TabsList>

            {/* Details Tab Content */}
            <TabsContent value="details" className="mt-4">
              {detailsContent}
            </TabsContent>

            {/* Related Tab Content */}
            {hasRelated && (
              <TabsContent value="related" className="mt-4">
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
                      pageSize={DEFAULT_RELATED_PAGE_SIZE}
                    />
                  ))}
                </div>
              </TabsContent>
            )}

            {/* Activity Tab Content */}
            {hasActivity && (
              <TabsContent value="activity" className="mt-4">
                <ActivityTimeline activities={schema.activities!} />
              </TabsContent>
            )}

            {/* Discussion Tab Content */}
            {hasDiscussion && (
              <TabsContent value="discussion" className="mt-4">
                {discussionSlot}
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
