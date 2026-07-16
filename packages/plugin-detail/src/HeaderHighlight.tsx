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
  Button,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@object-ui/components';
import type { HighlightField } from '@object-ui/types';
import { getCellRenderer, resolveCellRendererType } from '@object-ui/fields';
import { useSafeFieldLabel, useInlineEdit } from '@object-ui/react';
import { Check, X, Pencil } from 'lucide-react';
import { InlineFieldInput, TEXTUAL_REF_FALLBACK_TYPES } from './InlineFieldInput';
import { NON_EDITABLE_SYSTEM_FIELDS } from './systemFields';
import { useDetailTranslation } from './useDetailTranslation';

export interface HeaderHighlightProps {
  fields: HighlightField[];
  data?: any;
  className?: string;
  /** Object name for i18n field label resolution */
  objectName?: string;
  /** Object schema for field metadata enrichment */
  objectSchema?: any;
  /** DataSource used by reference (lookup / user) editors during inline edit */
  dataSource?: any;
}

export const HeaderHighlight: React.FC<HeaderHighlightProps> = ({
  fields,
  data,
  className,
  objectName,
  objectSchema,
  dataSource,
}) => {
  const { fieldLabel } = useSafeFieldLabel();
  const { t } = useDetailTranslation();
  // Shared record-level inline-edit session (objectui#2407 P2). Null when the
  // host doesn't wrap the page in an <InlineEditProvider> → strip stays
  // read-only, exactly as before.
  const inline = useInlineEdit();
  const editing = inline?.editing ?? false;
  const canEdit = inline?.canEdit ?? false;

  if (!fields.length || !data) return null;

  // In read mode we hide value-less fields to keep the strip dense; WHILE
  // EDITING we keep them so the user can fill an empty highlight in place.
  const hasValue = (f: HighlightField) => {
    const val = data?.[f.name];
    return val !== null && val !== undefined && val !== '';
  };
  const visibleFields = editing ? fields : fields.filter(hasValue);

  if (visibleFields.length === 0) return null;

  return (
    <TooltipProvider>
      <section
        className={cn(
          // De-boxed: render as a naked stats row with subtle bottom divider
          // instead of a filled Card. Keeps the page calm and lets the tab
          // strip below carry the visual anchor.
          '@container border-b border-border/60 pb-4',
          className,
        )}
        aria-label="Record highlights"
      >
        <div className={cn('flex flex-wrap gap-y-4')}>
          {visibleFields.map((field) => {
            const rawValue = data[field.name];
            // Enrich field metadata from objectSchema
            const objectDefField = objectSchema?.fields?.[field.name];
            const resolvedType = field.type || objectDefField?.type;
            // Backend object schemas use the ObjectStack-convention `reference`
            // key (DetailSection normalizes the same pair) — without it the
            // lookup editor has no target object to hydrate or search against.
            const refTarget =
              objectDefField?.reference_to || (objectDefField as any)?.reference;
            const enrichedField = {
              name: field.name,
              label: field.label,
              type: resolvedType || 'text',
              ...(objectDefField?.options && { options: objectDefField.options }),
              ...(objectDefField?.currency && { currency: objectDefField.currency }),
              // The SPEC channel for a per-field currency (a bare `currency`
              // key is designer/DB-only) — resolveFieldCurrency reads
              // currencyConfig.defaultCurrency second (#2548).
              ...(objectDefField?.currencyConfig && { currencyConfig: objectDefField.currencyConfig }),
              ...(objectDefField?.precision !== undefined && { precision: objectDefField.precision }),
              ...((objectDefField as any)?.scale !== undefined && { scale: (objectDefField as any).scale }),
              ...(objectDefField?.format && { format: objectDefField.format }),
              ...(refTarget && { reference_to: refTarget }),
              ...((objectDefField as any)?.reference_field && {
                reference_field: (objectDefField as any).reference_field,
              }),
              ...((objectDefField as any)?.widget && { widget: (objectDefField as any).widget }),
            };

            // Live value = the user's draft edit for this field, else the record
            // value. Read as `draft[name] ?? data[name]` (objectui#2407 P2).
            const draftVal = inline?.draft?.[field.name];
            const value = draftVal !== undefined ? draftVal : rawValue;

            // Field-level editability gate — mirrors DetailSection so the strip
            // and the body agree on which highlights are editable. Computed
            // types (formula/summary/rollup/auto_number), `readonly` (view OR
            // object metadata), and immutable system/audit fields never edit.
            const isComputed = TEXTUAL_REF_FALLBACK_TYPES.has(resolvedType as string);
            const isReadonly =
              (field as any).readonly === true || objectDefField?.readonly === true;
            const isSystem = NON_EDITABLE_SYSTEM_FIELDS.has(field.name);
            const fieldEditable = !isComputed && !isReadonly && !isSystem;
            const canInlineEditField = canEdit && fieldEditable;
            const editorActive = editing && canInlineEditField;

            // Use type-aware cell renderer — all renderers coerce values via
            // coerceToSafeValue() so even object/array data is safe (no error #310).
            const CellRenderer = getCellRenderer(
              resolveCellRendererType(enrichedField as any) || resolvedType || 'text',
            );

            const isKpi =
              resolvedType === 'number' ||
              resolvedType === 'integer' ||
              resolvedType === 'currency' ||
              resolvedType === 'percent' ||
              resolvedType === 'decimal';
            const isWide =
              resolvedType === 'email' ||
              resolvedType === 'url' ||
              resolvedType === 'textarea' ||
              resolvedType === 'reference' ||
              resolvedType === 'lookup' ||
              resolvedType === 'master_detail';
            const isBoolean = resolvedType === 'boolean';
            const isEmpty = value === null || value === undefined || value === '';

            // Compact-layout UX: an editor (select / date / lookup) needs more
            // room than a KPI number, so an actively-edited column widens to the
            // "wide" basis and renders the input full-width (Salesforce-style
            // expand-on-edit) instead of cramming it into a 9rem column.
            const useWide = isWide || editorActive;

            return (
              <div
                key={field.name}
                className={cn(
                  'group flex flex-col gap-1 min-w-[7rem] px-5 border-l border-border/60 first:border-l-0 first:pl-0',
                  useWide ? 'basis-[16rem] max-w-[24rem]' : 'basis-[9rem] max-w-[16rem]',
                )}
              >
                <span className="text-xs font-medium text-muted-foreground">
                  {fieldLabel(objectName || '', field.name, field.label)}
                </span>

                {editorActive ? (
                  <InlineFieldInput
                    field={enrichedField}
                    value={value}
                    onChange={(v) => inline!.setField(field.name, v)}
                    dataSource={dataSource}
                    autoFocus={inline!.autoFocusField === field.name}
                  />
                ) : (
                  <div
                    className={cn(
                      'flex items-start justify-between gap-1',
                      // Editable highlights hint interactivity on hover and enter
                      // edit on double-click (matches the details body).
                      canInlineEditField &&
                        'cursor-pointer rounded-md -mx-1.5 px-1.5 hover:bg-muted/40 transition-colors',
                    )}
                    onDoubleClick={
                      canInlineEditField ? () => inline!.enter(field.name) : undefined
                    }
                    title={canInlineEditField ? t('detail.editInlineHint') : undefined}
                  >
                    <div className="min-w-0 flex-1">
                      {isBoolean ? (
                        value ? (
                          <span className="inline-flex items-center gap-1 self-start rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600 ring-1 ring-inset ring-emerald-500/30 dark:text-emerald-400">
                            <Check className="h-3 w-3" aria-hidden />
                            Yes
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 self-start rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-500/30 dark:text-amber-400">
                            <X className="h-3 w-3" aria-hidden />
                            No
                          </span>
                        )
                      ) : isEmpty ? (
                        <span
                          className="block text-sm text-muted-foreground/60 select-none"
                          aria-label={t('detail.noValue', { defaultValue: 'No value' })}
                        >
                          —
                        </span>
                      ) : (
                        <span
                          // Hover reveals the full value; for option-backed
                          // fields prefer the option LABEL over the raw
                          // stored value ('Technology', not 'technology').
                          title={
                            (Array.isArray((enrichedField as any).options)
                              ? (enrichedField as any).options.find(
                                  (o: any) => o?.value === value,
                                )?.label
                              : undefined) ??
                            (typeof value === 'string' || typeof value === 'number'
                              ? String(value)
                              : undefined)
                          }
                          className={cn(
                            'block min-w-0 truncate text-sm font-semibold',
                            isKpi && 'tabular-nums tracking-tight',
                          )}
                        >
                          <CellRenderer value={value} field={enrichedField as any} />
                        </span>
                      )}
                    </div>
                    {canInlineEditField && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            aria-label={t('detail.editInlineHint')}
                            onClick={(e) => {
                              e.stopPropagation();
                              inline!.enter(field.name);
                            }}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{t('detail.editInlineHint')}</TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </TooltipProvider>
  );
};
