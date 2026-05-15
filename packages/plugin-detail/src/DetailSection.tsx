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
  Badge,
  Button,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  useIsMobile,
} from '@object-ui/components';
import { ChevronDown, ChevronRight, Copy, Check, Eye, EyeOff } from 'lucide-react';
import { SchemaRenderer } from '@object-ui/react';
import { getCellRenderer, resolveCellRendererType } from '@object-ui/fields';
import type { DetailViewSection as DetailViewSectionType, DetailViewField, FieldMetadata } from '@object-ui/types';
import { applyDetailAutoLayout } from './autoLayout';
import { useDetailTranslation } from './useDetailTranslation';
import { useSafeFieldLabel } from '@object-ui/react';

/**
 * Compute responsive col-span classes so that col-span never exceeds the
 * visible column count at each Tailwind breakpoint.
 *
 * For columns=1: no span class (always single column)
 * For columns=2: md:col-span-{min(span,2)}
 * For columns>=3: md:col-span-{min(span,2)} lg:col-span-{min(span,3)}
 */
export function getResponsiveSpanClass(span: number | undefined, columns: number): string {
  if (!span || span <= 1 || columns <= 1) return '';

  if (columns === 2) {
    return span >= 2 ? 'md:col-span-2' : '';
  }

  // columns >= 3: grid-cols-1 md:grid-cols-2 lg:grid-cols-3
  if (span === 2) return 'md:col-span-2';
  if (span >= 3) return 'md:col-span-2 lg:col-span-3';

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

  // Auto-hide-empty heuristic: when a section has many empty rows AND at least
  // some filled rows, default to hiding empties so the page does not become a
  // label-graveyard. The user can still reveal them with the toggle. If a
  // section is entirely empty (e.g., loading state, brand-new record), do NOT
  // auto-hide — the labels themselves are useful as a structural skeleton.
  // Explicit `hideEmpty` honored as before.
  // On mobile, vertical real estate is precious — drop the thresholds.
  const isMobile = useIsMobile();
  const AUTO_HIDE_MIN_FIELDS = isMobile ? 3 : 6;
  const AUTO_HIDE_RATIO = isMobile ? 0.2 : 0.5;
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

  // Hide entire section when all fields are empty AND user did not request to show them.
  if (visibleFields.length === 0 && emptyCount === section.fields.length) return null;

  // Apply auto-layout: infer columns and auto-span wide fields
  const { fields: layoutFields, columns: effectiveColumns } = applyDetailAutoLayout(
    visibleFields,
    section.columns
  );

  const renderField = (field: DetailViewField) => {
    const value = data?.[field.name] ?? field.value;
    
    // If custom renderer provided
    if (field.render) {
      return <SchemaRenderer schema={field.render} data={{ ...data, value }} />;
    }

    // Calculate responsive span class so col-span never exceeds the visible
    // column count at each breakpoint, preventing implicit columns on mobile.
    const spanClass = getResponsiveSpanClass(field.span, effectiveColumns);

    const displayValue = (() => {
      if (value === null || value === undefined) return <span className="text-muted-foreground/50 text-xs italic">—</span>;
      // Enrich field with objectSchema metadata — merge missing properties
      // even when field.type is explicitly set (e.g., type: 'lookup' without reference_to)
      const objectDefField = objectSchema?.fields?.[field.name];
      const enrichedField: Record<string, any> = { ...field };
      if (objectDefField) {
        if (!field.type && objectDefField.type) enrichedField.type = objectDefField.type;
        if (objectDefField.options && !enrichedField.options) enrichedField.options = objectDefField.options;
        if (objectDefField.currency && !enrichedField.currency) enrichedField.currency = objectDefField.currency;
        if (objectDefField.precision !== undefined && enrichedField.precision === undefined) enrichedField.precision = objectDefField.precision;
        if (objectDefField.format && !enrichedField.format) enrichedField.format = objectDefField.format;
        const refTarget = objectDefField.reference_to || objectDefField.reference;
        if (refTarget && !enrichedField.reference_to) enrichedField.reference_to = refTarget;
        if (objectDefField.reference_field && !enrichedField.reference_field) enrichedField.reference_field = objectDefField.reference_field;
      }
      // i18n: translate select-field option labels so cell renderers
      // (e.g. SelectCellRenderer / status badge) display localized text.
      if (objectName && Array.isArray(enrichedField.options) && enrichedField.options.length > 0) {
        enrichedField.options = translateOptions(objectName, field.name, enrichedField.options as any);
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
    const isCopied = copiedField === field.name;

    // Default field rendering with copy button and touch-friendly targets
    return (
      <div key={field.name} className={cn("space-y-1.5 group", spanClass)}>
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {fieldLabel(objectName || '', field.name, field.label || field.name)}
        </div>
        {isEditing && !field.readonly ? (
          <div className="min-h-[44px] sm:min-h-0">
            {(() => {
              const isDate = field.type === 'date' || field.type === 'datetime';
              const inputType = field.type === 'number' ? 'number' : isDate ? 'date' : 'text';
              // <input type="date"> needs a YYYY-MM-DD string; raw ISO
              // timestamps ("2026-02-14T14:46:20.862Z") leave the picker
              // blank. Slice down to the date portion so existing values
              // round-trip correctly.
              const inputValue = value == null
                ? ''
                : isDate
                  ? (() => {
                      const s = String(value);
                      if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
                      const d = new Date(s);
                      return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-CA');
                    })()
                  : String(value);
              return (
                <input
                  type={inputType}
                  className="w-full px-2 py-1.5 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  value={inputValue}
                  onChange={(e) => {
                    const v = e.target.value;
                    // Re-emit dates as full ISO so backend validation that
                    // expects ISO timestamps keeps working.
                    if (isDate && v) {
                      const iso = new Date(v + 'T00:00:00').toISOString();
                      onFieldChange?.(field.name, iso);
                    } else {
                      onFieldChange?.(field.name, v);
                    }
                  }}
                />
              );
            })()}
          </div>
        ) : (
        <div
          className={cn(
            "flex items-start justify-between gap-2 min-h-[44px] sm:min-h-0 rounded-md",
            canCopy && "cursor-pointer active:bg-muted/60 transition-colors"
          )}
          onClick={canCopy ? () => handleCopyField(field.name, value) : undefined}
          onKeyDown={canCopy ? (e: React.KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleCopyField(field.name, value);
            }
          } : undefined}
          role={canCopy ? "button" : undefined}
          tabIndex={canCopy ? 0 : undefined}
        >
          <div className="text-sm flex-1 break-words py-1">
            {displayValue}
          </div>
          {canCopy && (
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
          )}
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

  const renderedFields = visibleCount !== undefined
    ? layoutFields.slice(0, visibleCount)
    : layoutFields;

  const showEmptyToggle = emptyCount > 0 && (section.hideEmpty || shouldAutoHideEmpty);

  const content = (
    <>
      <div
        className={cn(
          "grid gap-3 sm:gap-4",
          effectiveColumns === 1 ? "grid-cols-1" :
          effectiveColumns === 2 ? "grid-cols-1 md:grid-cols-2" :
          effectiveColumns === 3 ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3" :
          "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
        )}
      >
        {renderedFields.map(renderField)}
      </div>
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
          <CardHeader className={cn(section.headerColor && `bg-${section.headerColor}`)}>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {section.icon && <span className="text-muted-foreground">{section.icon}</span>}
                <span>{section.title}</span>
              </div>
            </CardTitle>
            {section.description && (
              <p className="text-sm text-muted-foreground mt-1.5">{section.description}</p>
            )}
          </CardHeader>
        )}
        <CardContent className="pt-4 sm:pt-6 px-3 sm:px-6">
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
            "cursor-pointer hover:bg-muted/50 transition-colors",
            section.headerColor && `bg-${section.headerColor}`
          )}>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {section.icon && <span className="text-muted-foreground">{section.icon}</span>}
                <span>{section.title}</span>
                {section.fields && (
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {section.fields.length}
                  </Badge>
                )}
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
              <p className="text-sm text-muted-foreground mt-1.5">{section.description}</p>
            )}
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-4 sm:pt-6 px-3 sm:px-6">
            {content}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};
