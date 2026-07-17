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
  Card, 
  CardHeader, 
  CardTitle, 
  CardContent, 
  Collapsible, 
  CollapsibleTrigger, 
  CollapsibleContent,
  Button,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  useIsMobile,
  LazyIcon,
} from '@object-ui/components';
import { ChevronDown, ChevronRight, Copy, Check, Eye, EyeOff, Pencil } from 'lucide-react';
import { SchemaRenderer } from '@object-ui/react';
import { getCellRenderer, resolveCellRendererType } from '@object-ui/fields';
import type { DetailViewSection as DetailViewSectionType, DetailViewField, FieldMetadata } from '@object-ui/types';
import { applyDetailAutoLayout } from './autoLayout';
import { useDetailTranslation } from './useDetailTranslation';
import { useSafeFieldLabel } from '@object-ui/react';
import { PermissionFacetLink } from './renderers/PermissionFacetLink';
import { NON_EDITABLE_SYSTEM_FIELDS } from './systemFields';
import { InlineFieldInput, TEXTUAL_REF_FALLBACK_TYPES } from './InlineFieldInput';

/**
 * Section-header icon. `fieldGroups[].icon` declares a Lucide name (spec),
 * so ASCII-identifier-ish values render as the real icon; anything else
 * (emoji / CJK text from hand-authored sections that predate the spec key)
 * keeps the historical text rendering instead of degrading to the generic
 * fallback icon.
 */
const SectionIcon: React.FC<{ name: string }> = ({ name }) => {
  if (!/^[a-z0-9][a-z0-9-]*$/i.test(name)) {
    return <span className="text-muted-foreground">{name}</span>;
  }
  return <LazyIcon name={name} className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />;
};

/**
 * Compute responsive col-span classes so that col-span never exceeds the
 * visible column count at each Tailwind breakpoint.
 *
 * For columns=1: no span class (always single column)
 * For columns=2: md:col-span-{min(span,2)}
 * For columns=3: md:col-span-{min(span,2)} lg:col-span-{min(span,3)}
 * For columns>=4: …lg:col-span-{min(span,3)} xl:col-span-{min(span,4)}
 *
 * Mirrors the grid's breakpoint ladder (md→2, lg→3, xl→4) so a wide field
 * never spans more cells than exist at any breakpoint (objectui#2578).
 */
export function getResponsiveSpanClass(span: number | undefined, columns: number): string {
  if (!span || span <= 1 || columns <= 1) return '';

  if (columns === 2) {
    return span >= 2 ? 'md:col-span-2' : '';
  }

  if (columns === 3) {
    if (span === 2) return 'md:col-span-2';
    if (span >= 3) return 'md:col-span-2 lg:col-span-3';
    return '';
  }

  // columns >= 4: grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4
  if (span === 2) return 'md:col-span-2';
  if (span === 3) return 'md:col-span-2 lg:col-span-3';
  if (span >= 4) return 'md:col-span-2 lg:col-span-3 xl:col-span-4';

  return '';
}

export interface VirtualScrollOptions {
  /** Enable virtual scrolling for large field sets */
  enabled?: boolean;
  /** Height of each field row in px (default: 60) */
  itemHeight?: number;
  /** Number of fields to render in the initial batch before revealing all (default: 20) */
  batchSize?: number;
}

export interface DetailSectionProps {
  section: DetailViewSectionType;
  data?: any;
  className?: string;
  /** Object schema from DataSource for field type enrichment */
  objectSchema?: any;
  /** Object name for i18n field label resolution */
  objectName?: string;
  /** Whether inline editing is active */
  isEditing?: boolean;
  /** Callback when a field value changes during inline editing */
  onFieldChange?: (field: string, value: any) => void;
  /**
   * Enter inline-edit mode focused on a specific field — wired to the per-field
   * double-click / hover-pencil affordances. Supplied ONLY when the record is
   * inline-editable (object lifecycle + permission gated upstream), so its
   * presence is what surfaces those affordances.
   */
  onEnterInlineEdit?: (fieldName: string) => void;
  /** Field to auto-focus when inline edit is entered from a field. */
  autoFocusField?: string | null;
  /** DataSource used by reference (lookup/master_detail/user) widgets during inline editing */
  dataSource?: any;
  /** Virtual scrolling configuration for sections with many fields */
  virtualScroll?: VirtualScrollOptions;
}

export const DetailSection: React.FC<DetailSectionProps> = ({
  section,
  data,
  className,
  objectSchema,
  objectName,
  isEditing = false,
  onFieldChange,
  onEnterInlineEdit,
  autoFocusField,
  dataSource,
  virtualScroll,
}) => {
  const [isCollapsed, setIsCollapsed] = React.useState(section.defaultCollapsed ?? false);
  const [copiedField, setCopiedField] = React.useState<string | null>(null);
  const [visibleCount, setVisibleCount] = React.useState<number | undefined>(undefined);
  const [showEmptyOverride, setShowEmptyOverride] = React.useState(false);
  const { t } = useDetailTranslation();
  const { fieldLabel, translateOptions } = useSafeFieldLabel();

  const handleCopyField = React.useCallback((fieldName: string, value: any) => {
    const textValue = value !== null && value !== undefined ? String(value) : '';
    navigator.clipboard.writeText(textValue).then(() => {
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), 2000);
    });
  }, []);

  // Identify empty fields once for both filtering and the toggle counter.
  const isEmptyValue = React.useCallback((field: DetailViewField) => {
    const value = data?.[field.name] ?? field.value;
    return value === null || value === undefined || value === '';
  }, [data]);

  const emptyCount = React.useMemo(
    () => section.fields.filter(isEmptyValue).length,
    [section.fields, isEmptyValue]
  );

  // Auto-hide-empty heuristic: when a section has empty rows AND at least one
  // filled row, default to hiding empties so the page does not become a
  // label-graveyard. The user can still reveal them with the toggle. If a
  // section is entirely empty (e.g., loading state, brand-new record), do NOT
  // auto-hide — the labels themselves are useful as a structural skeleton.
  // Explicit `hideEmpty` honored as before.
  //
  // Thresholds were tightened in Phase N (2026-05): smaller sections (≥4
  // fields) and a lower empty ratio (≥25%) now trigger auto-hide so pages
  // start dense by default rather than sparse. Mobile remains the most
  // aggressive variant since vertical real estate is scarce.
  const isMobile = useIsMobile();
  const AUTO_HIDE_MIN_FIELDS = isMobile ? 3 : 4;
  const AUTO_HIDE_RATIO = isMobile ? 0.2 : 0.25;
  const filledCount = section.fields.length - emptyCount;
  const shouldAutoHideEmpty =
    !section.hideEmpty &&
    !isEditing &&
    section.fields.length >= AUTO_HIDE_MIN_FIELDS &&
    emptyCount / section.fields.length >= AUTO_HIDE_RATIO &&
    filledCount > 0;
  const hideEmptyEffective = !showEmptyOverride && (section.hideEmpty || shouldAutoHideEmpty);

  // Filter out empty fields when hideEmpty is set or auto-hide kicked in.
  const visibleFields = hideEmptyEffective
    ? section.fields.filter((field) => !isEmptyValue(field))
    : section.fields;

  // Apply auto-layout: infer columns and auto-span wide fields
  const { fields: layoutFields, columns: rawColumns } = applyDetailAutoLayout(
    visibleFields,
    section.columns
  );
  // Never render more columns than there are visible fields — the object-wide
  // column count (objectui#2578) can exceed a section's visible count when
  // empty fields are hidden; a lone field shouldn't sit at 1/N width.
  const effectiveColumns = Math.min(rawColumns, Math.max(1, visibleFields.length));

  const renderField = (field: DetailViewField) => {
    const value = data?.[field.name] ?? field.value;
    
    // If custom renderer provided
    if (field.render) {
      return <SchemaRenderer schema={field.render} data={{ ...data, value }} />;
    }

    // Calculate responsive span class so col-span never exceeds the visible
    // column count at each breakpoint, preventing implicit columns on mobile.
    const spanClass = getResponsiveSpanClass(field.span, effectiveColumns);

    // Enrich field with objectSchema metadata once — used by both the
    // read-only cell renderer and the inline-edit widget so that things
    // like select options, currency code, lookup target, etc. are
    // available in either mode.
    const objectDefField = objectSchema?.fields?.[field.name];
    const enrichedField: Record<string, any> = { ...field };
    if (objectDefField) {
      if (!field.type && objectDefField.type) enrichedField.type = objectDefField.type;
      if (objectDefField.options && !enrichedField.options) enrichedField.options = objectDefField.options;
      if (objectDefField.currency && !enrichedField.currency) enrichedField.currency = objectDefField.currency;
      if (objectDefField.precision !== undefined && enrichedField.precision === undefined) enrichedField.precision = objectDefField.precision;
      if ((objectDefField as any).scale !== undefined && (enrichedField as any).scale === undefined) (enrichedField as any).scale = (objectDefField as any).scale;
      // Numeric range/step constraints (objectui#2572 item 3) — without these
      // the metadata's `min: 0` never reaches the numeric edit widgets.
      if ((objectDefField as any).min !== undefined && (enrichedField as any).min === undefined) (enrichedField as any).min = (objectDefField as any).min;
      if ((objectDefField as any).max !== undefined && (enrichedField as any).max === undefined) (enrichedField as any).max = (objectDefField as any).max;
      if ((objectDefField as any).step !== undefined && (enrichedField as any).step === undefined) (enrichedField as any).step = (objectDefField as any).step;
      if (objectDefField.format && !enrichedField.format) enrichedField.format = objectDefField.format;
      // Per-field widget override (ADR-0056 P2) — carry it from the object
      // metadata so the inline-edit widget branch (and read cell) can honor a
      // structured editor even when the synthesized section field didn't include it.
      if ((objectDefField as any).widget && !enrichedField.widget) enrichedField.widget = (objectDefField as any).widget;
      const refTarget = objectDefField.reference_to || objectDefField.reference;
      if (refTarget && !enrichedField.reference_to) enrichedField.reference_to = refTarget;
      if (objectDefField.reference_field && !enrichedField.reference_field) enrichedField.reference_field = objectDefField.reference_field;
      if ((objectDefField as any).dueLike !== undefined && enrichedField.dueLike === undefined) enrichedField.dueLike = (objectDefField as any).dueLike;
    }
    if (objectName && Array.isArray(enrichedField.options) && enrichedField.options.length > 0) {
      enrichedField.options = translateOptions(objectName, field.name, enrichedField.options as any);
    }

    // Inline-edit eligibility for THIS field. Mirrors the input-branch gate so
    // the pencil / double-click affordance appears iff the field can actually
    // become an input: computed types (formula/summary/rollup/auto_number) and
    // fields explicitly flagged `readonly` are never editable. `onEnterInlineEdit`
    // is only threaded when the record itself is inline-editable, so its presence
    // carries the object-lifecycle + permission gate.
    const inlineEditType = enrichedField.type || field.type;
    const isComputedField = TEXTUAL_REF_FALLBACK_TYPES.has(inlineEditType as string);
    // Honor the OBJECT metadata's read-only flag too — the enrichment above
    // intentionally doesn't copy `readonly` into enrichedField, so read it
    // straight off objectDefField (covers formula / non-updateable fields the
    // framework flags `readonly:true` even when the view schema doesn't). And
    // never offer inline edit on immutable audit/identity fields by name
    // (created_at / id / …), in case a schema surfaces one as a section row.
    const isReadonly = field.readonly === true || objectDefField?.readonly === true;
    const isSystemField = NON_EDITABLE_SYSTEM_FIELDS.has(field.name);
    const fieldEditable = !isReadonly && !isComputedField && !isSystemField;
    const canInlineEditField = fieldEditable && !!onEnterInlineEdit;

    const displayValue = (() => {
      // Per-field widget override (ADR-0056 P1) — a facet designed in Studio
      // renders read-only as a summary + deep-link, even when empty (so the
      // admin still sees where to author it), never as raw [Object]/JSON.
      const displayWidget = (enrichedField as any).widget || (field as any).widget;
      if (displayWidget === 'permission-facet-link') {
        return <PermissionFacetLink value={value} field={enrichedField as any} />;
      }
      const isEmpty = value === null || value === undefined || value === '';
      if (isEmpty) {
        return (
          <span
            className="text-muted-foreground/60 text-sm select-none"
            aria-label={t('detail.noValue', { defaultValue: 'No value' })}
            title={t('detail.noValue', { defaultValue: 'No value' })}
          >
            —
          </span>
        );
      }
      // Use type-aware cell renderer; respect format hints (e.g.
      // text + format: 'phone' → PhoneCellRenderer with tel: link).
      const resolvedType = resolveCellRendererType(enrichedField as { type?: string; format?: string }) || field.type;
      if (resolvedType) {
        const CellRenderer = getCellRenderer(resolvedType);
        if (CellRenderer) {
          return <CellRenderer value={value} field={enrichedField as unknown as FieldMetadata} />;
        }
      }
      return String(value);
    })();
    const canCopy = value !== null && value !== undefined && value !== '';
    // An editable field surfaces the pencil (edit) affordance instead of the
    // copy affordance, and reserves single-click for text selection — so
    // click-to-copy only applies to non-editable fields.
    const copyInteractive = canCopy && !canInlineEditField;
    const isCopied = copiedField === field.name;
    const fieldLabelText = fieldLabel(objectName || '', field.name, field.label || field.name);

    // iOS-style grouped-inset row (mobile, read mode): label left, value right,
    // hairline-separated rows inside the section card. The native-feeling
    // settings/detail form for the mobile target. Editing falls back to the
    // stacked layout below so inputs have room.
    if (isMobile && !(isEditing && fieldEditable)) {
      return (
        <div
          key={field.name}
          className={cn(
            "flex items-baseline justify-between gap-4 py-2.5 min-h-[44px] group",
            canCopy && "cursor-pointer active:bg-muted/40 transition-colors",
          )}
          onClick={canCopy ? () => handleCopyField(field.name, value) : undefined}
          onKeyDown={canCopy ? (e: React.KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCopyField(field.name, value); }
          } : undefined}
          role={canCopy ? 'button' : undefined}
          tabIndex={canCopy ? 0 : undefined}
        >
          <span className="text-[15px] text-muted-foreground shrink-0">{fieldLabelText}</span>
          <span className="text-[15px] text-foreground text-right break-words min-w-0 leading-snug">{displayValue}</span>
        </div>
      );
    }

    // Default field rendering with copy button and touch-friendly targets
    // min-w-0: a grid item defaults to min-width:auto, so a long unbreakable
    // value (raw JSON, a GPS pair, a URL) sets the track's min width and
    // overflows into the neighbouring cell — visible once columns narrow
    // (objectui#2578). Allowing the item to shrink lets the value wrap.
    return (
      <div key={field.name} className={cn("space-y-1.5 group min-w-0", spanClass)}>
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {fieldLabel(objectName || '', field.name, field.label || field.name)}
        </div>
        {isEditing && fieldEditable ? (
          <div className="min-h-[44px] sm:min-h-0">
            <InlineFieldInput
              field={enrichedField}
              value={value}
              onChange={(v) => onFieldChange?.(field.name, v)}
              dataSource={dataSource}
              autoFocus={autoFocusField === field.name}
            />
          </div>
        ) : (
        <div
          className={cn(
            "flex items-start justify-between gap-2 min-h-[44px] sm:min-h-0 rounded-md",
            copyInteractive && "cursor-pointer active:bg-muted/60 transition-colors",
            // Editable fields hint interactivity on hover and enter edit on
            // double-click (Salesforce/Airtable pattern). The negative margin
            // keeps the hover highlight flush with the label above.
            canInlineEditField && "cursor-pointer hover:bg-muted/40 transition-colors -mx-1.5 px-1.5"
          )}
          onClick={copyInteractive ? () => handleCopyField(field.name, value) : undefined}
          onDoubleClick={canInlineEditField ? () => onEnterInlineEdit?.(field.name) : undefined}
          onKeyDown={copyInteractive ? (e: React.KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleCopyField(field.name, value);
            }
          } : undefined}
          role={copyInteractive ? "button" : undefined}
          tabIndex={copyInteractive ? 0 : undefined}
          title={canInlineEditField ? t('detail.editInlineHint') : undefined}
        >
          <div className="text-sm flex-1 min-w-0 break-words py-1">
            {displayValue}
          </div>
          {canInlineEditField ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    aria-label={t('detail.editInlineHint')}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEnterInlineEdit?.(field.name);
                    }}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {t('detail.editInlineHint')}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : canCopy ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCopyField(field.name, value);
                    }}
                  >
                    {isCopied ? (
                      <Check className="h-3 w-3 text-green-600" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {isCopied ? t('detail.copied') : t('detail.copyToClipboard')}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : null}
        </div>
        )}
      </div>
    );
  };

  // Virtual scroll: progressive batch rendering for large field sets
  const vsEnabled = virtualScroll?.enabled === true;
  const vsBatchSize = virtualScroll?.batchSize ?? 20;
  /** Delay (ms) before revealing remaining fields after the initial batch */
  const VS_REVEAL_DELAY = 100;

  React.useEffect(() => {
    if (!vsEnabled) {
      setVisibleCount(undefined);
      return;
    }
    // Start with a batch, then progressively reveal more
    if (layoutFields.length <= vsBatchSize) {
      setVisibleCount(undefined);
      return;
    }
    setVisibleCount(vsBatchSize);
    const timer = setTimeout(() => setVisibleCount(undefined), VS_REVEAL_DELAY);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vsEnabled, layoutFields.length, vsBatchSize]);

  // Hide entire section when all fields are empty AND the user has not asked to
  // reveal them. This early return MUST come AFTER every hook above (including
  // the virtual-scroll useEffect) — never before. When a section is all-empty
  // on one render (early return, N hooks) but has data on the next render (the
  // useEffect runs, N+1 hooks) of the SAME reconciled fiber, the hook count
  // changes between renders and React throws error #300 ("rendered more hooks
  // than during the previous render"). This is the master-detail drill-in
  // crash: navigating account → project reuses this DetailSection fiber, and
  // its sections flip from empty to populated. Keeping the guard below all
  // hooks makes the hook count invariant.
  if (visibleFields.length === 0 && emptyCount === section.fields.length) return null;

  const renderedFields = visibleCount !== undefined
    ? layoutFields.slice(0, visibleCount)
    : layoutFields;

  const showEmptyToggle = emptyCount > 0 && (section.hideEmpty || shouldAutoHideEmpty);

  const content = (
    <>
      {isMobile ? (
        <div className="flex flex-col divide-y divide-border/60">
          {renderedFields.map(renderField)}
        </div>
      ) : (
        <div
          className={cn(
            "grid gap-3 sm:gap-4",
            effectiveColumns === 1 ? "grid-cols-1" :
            effectiveColumns === 2 ? "grid-cols-1 md:grid-cols-2" :
            effectiveColumns === 3 ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3" :
            "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          )}
        >
          {renderedFields.map(renderField)}
        </div>
      )}
      {showEmptyToggle && (
        <div className="mt-3 -ml-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowEmptyOverride((s) => !s)}
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            {showEmptyOverride ? (
              <EyeOff className="h-3.5 w-3.5 mr-1.5" />
            ) : (
              <Eye className="h-3.5 w-3.5 mr-1.5" />
            )}
            {showEmptyOverride
              ? t('detail.hideEmptyFields', { defaultValue: 'Hide empty fields' })
              : t('detail.showEmptyFields', { count: emptyCount, defaultValue: `Show ${emptyCount} empty field${emptyCount === 1 ? '' : 's'}` })}
          </Button>
        </div>
      )}
    </>
  );

  // Flat render: when section has no title, no border, and is not collapsible,
  // skip the Card chrome entirely. This is the universal case for an
  // auto-generated single section (no need for a "Details" wrapper around
  // a single block of fields).
  const isFlat = !section.title && !section.collapsible && section.showBorder === false;
  if (isFlat) {
    return <div className={cn(className)}>{content}</div>;
  }

  if (!section.collapsible) {
    return (
      <Card className={cn(section.showBorder === false ? 'border-none shadow-none' : '', className)}>
        {section.title && (
          <CardHeader className={cn('py-3 px-4 sm:py-4 sm:px-6', section.headerColor && `bg-${section.headerColor}`)}>
            <CardTitle className="flex items-center justify-between text-base font-semibold tracking-tight">
              <div className="flex items-center gap-2">
                {section.icon && <SectionIcon name={section.icon} />}
                <span>{section.title}</span>
              </div>
            </CardTitle>
            {section.description && (
              <p className="text-xs text-muted-foreground mt-1">{section.description}</p>
            )}
          </CardHeader>
        )}
        <CardContent className="pt-3 sm:pt-4 px-3 sm:px-6 pb-4 sm:pb-5">
          {content}
        </CardContent>
      </Card>
    );
  }

  return (
    <Collapsible
      open={!isCollapsed}
      onOpenChange={(open) => setIsCollapsed(!open)}
      className={className}
    >
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className={cn(
            "py-3 px-4 sm:py-4 sm:px-6 cursor-pointer hover:bg-muted/50 transition-colors",
            section.headerColor && `bg-${section.headerColor}`
          )}>
            <CardTitle className="flex items-center justify-between text-base font-semibold tracking-tight">
              <div className="flex items-center gap-2">
                {section.icon && <SectionIcon name={section.icon} />}
                <span>{section.title}</span>
              </div>
              <div className="flex items-center gap-2">
                {isCollapsed ? (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </CardTitle>
            {section.description && !isCollapsed && (
              <p className="text-xs text-muted-foreground mt-1">{section.description}</p>
            )}
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-3 sm:pt-4 px-3 sm:px-6 pb-4 sm:pb-5">
            {content}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};
