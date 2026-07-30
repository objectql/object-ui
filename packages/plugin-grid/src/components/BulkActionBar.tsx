/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { Button } from '@object-ui/components';
import { Trash2, CheckSquare, X } from 'lucide-react';
import { LazyIcon, toKebabIconName } from '@object-ui/components';
import { useObjectTranslation, usePredicateScope } from '@object-ui/react';
import type { BulkActionDef } from '@object-ui/types';
import { partitionBulkRows } from '../bulkEligibility';
import { formatActionLabel } from './RowActionMenu';

/**
 * One rich bulk-action button. Extracted into its own component so the def's
 * `visible` CEL predicate can be evaluated with a hook without violating the
 * rules-of-hooks inside a `.map()` — previously `bulkActionDefs` rendered
 * unconditionally, ignoring `visible` entirely.
 *
 * `visible` is evaluated ONCE PER SELECTED RECORD with that record in scope
 * (objectui#3067), fail-closed per record — the same contract the row kebab
 * uses. The button is offered when at least one selected record passes; the
 * run then acts only on those. A record-free predicate (`features.x`) answers
 * identically for every row, so it still behaves as a plain button-level gate.
 * See `partitionBulkRows` for why the previous record-free evaluation was not
 * merely lenient but wrong.
 */
const BulkActionButton: React.FC<{
  def: BulkActionDef;
  selectedRows: any[];
  onActionDef?: (def: BulkActionDef, selectedRows: any[]) => void;
}> = ({ def, selectedRows, onActionDef }) => {
  const scope = usePredicateScope();
  const { eligible } = React.useMemo(
    () => partitionBulkRows(def, selectedRows, { scope }),
    [def, selectedRows, scope],
  );
  // Only a def that actually declares `visible` can be gated away — an
  // ungated def always renders, even against an empty selection (the bar
  // itself is what decides there is a selection at all).
  if (def.visible && eligible.length === 0) return null;
  const isDestructive = def.variant === 'danger' || def.operation === 'delete';
  const iconName = def.icon ? toKebabIconName(def.icon) : null;
  return (
    <Button
      variant={isDestructive ? 'destructive' : 'outline'}
      size="sm"
      className="h-7 px-2.5 text-xs gap-1.5"
      onClick={() => onActionDef?.(def, selectedRows)}
      data-testid={`bulk-action-${def.name}`}
    >
      {iconName ? (
        <LazyIcon name={iconName} className="h-3 w-3" />
      ) : isDestructive ? (
        <Trash2 className="h-3 w-3" />
      ) : null}
      {def.label ?? formatActionLabel(def.name)}
    </Button>
  );
};

export interface BulkActionBarProps {
  /** Array of selected row records */
  selectedRows: any[];
  /**
   * Bulk/batch action identifiers (legacy string list) that resolved to no
   * declared action — dispatched by name for consumers that registered a
   * runner handler under it. Names that DID resolve arrive in `actionDefs`
   * instead (see `resolveBulkActions`), so the two lists never overlap.
   */
  actions: string[];
  /** Rich action definitions — authored inline or derived from the object. */
  actionDefs?: BulkActionDef[];
  /** Callback when a legacy string-id bulk action button is clicked */
  onAction?: (action: string, selectedRows: any[]) => void;
  /** Callback when a rich-def bulk action button is clicked. */
  onActionDef?: (def: BulkActionDef, selectedRows: any[]) => void;
  /** Callback to clear selection */
  onClearSelection?: () => void;
  /**
   * Cross-page selection — number of rows currently loaded on the page.
   * When `selectedRows.length === pageSize` and `totalMatching > pageSize`,
   * we offer to extend the selection across the entire match set.
   */
  pageSize?: number;
  /** Total matching record count from the most recent find. */
  totalMatching?: number;
  /** True when the user has opted into the cross-page selection. */
  allMatchingSelected?: boolean;
  /** Invoked when the user clicks "Select all N matching". */
  onSelectAllMatching?: () => void;
}

export const BulkActionBar: React.FC<BulkActionBarProps> = ({
  selectedRows,
  actions,
  actionDefs,
  onAction,
  onActionDef,
  onClearSelection,
  pageSize,
  totalMatching,
  allMatchingSelected,
  onSelectAllMatching,
}) => {
  const { t } = useObjectTranslation();
  const hasDefs = Array.isArray(actionDefs) && actionDefs.length > 0;
  const hasLegacy = Array.isArray(actions) && actions.length > 0;
  // Render whenever rows are selected — this bar is the single, canonical
  // selection indicator (count + Clear). Bulk-action buttons are optional: with
  // none configured it still surfaces "N selected / Clear", so the embedded
  // data-table needn't draw its own (unstyled, orphaned) selection toolbar.
  if (selectedRows.length === 0) return null;

  // Cross-page affordance: show banner when the user has selected the
  // entire visible page AND there are more matching records off-screen.
  const showCrossPageAffordance =
    !allMatchingSelected
    && typeof totalMatching === 'number'
    && typeof pageSize === 'number'
    && pageSize > 0
    && selectedRows.length >= pageSize
    && totalMatching > pageSize;

  return (
    <div
      className="border-t border-primary/30 px-4 py-2 flex flex-col gap-1.5 text-xs bg-primary/10 text-foreground shrink-0 shadow-sm motion-safe:animate-in motion-safe:slide-in-from-bottom-2 motion-safe:fade-in-0 motion-safe:duration-200"
      role="region"
      aria-label="Bulk actions"
      data-testid="bulk-actions-bar"
    >
      {(showCrossPageAffordance || allMatchingSelected) && (
        <div
          className="flex items-center gap-2 text-[11px] text-muted-foreground"
          data-testid="bulk-cross-page-banner"
        >
          {allMatchingSelected ? (
            <>
              <CheckSquare className="h-3 w-3 text-primary shrink-0" />
              <span>
                {t('grid.bulkAllMatchingSelected', {
                  count: totalMatching,
                  defaultValue: 'All {{count}} matching records are selected.',
                })}
              </span>
            </>
          ) : (
            <>
              <span>
                {t('grid.bulkAllOnPage', {
                  count: pageSize,
                  defaultValue: 'All {{count}} on this page are selected.',
                })}
              </span>
              <button
                type="button"
                className="font-medium text-primary underline-offset-2 hover:underline"
                onClick={onSelectAllMatching}
                data-testid="bulk-select-all-matching"
              >
                {t('grid.bulkSelectAllMatching', {
                  count: totalMatching,
                  defaultValue: 'Select all {{count}} matching',
                })}
              </button>
            </>
          )}
        </div>
      )}
      <div className="flex items-center gap-2">
      <CheckSquare className="h-3.5 w-3.5 text-primary shrink-0" />
      <span className="font-medium tabular-nums">
        <span
          key={allMatchingSelected ? `all-${totalMatching}` : selectedRows.length}
          className="inline-block motion-safe:animate-in motion-safe:zoom-in-90 motion-safe:duration-150"
        >
          {allMatchingSelected
            ? t('grid.bulkSelectedAllMatches', {
                count: totalMatching,
                defaultValue: '{{count}} selected (all matches)',
              })
            : t('grid.bulkSelected', {
                count: selectedRows.length,
                defaultValue: '{{count}} selected',
              })}
        </span>
      </span>
      <div className="flex items-center gap-1.5 ml-3">
        {hasDefs && actionDefs!.map(def => (
          <BulkActionButton
            key={def.name}
            def={def}
            selectedRows={selectedRows}
            onActionDef={onActionDef}
          />
        ))}
        {/* Legacy names render ALONGSIDE defs, not only in their absence: after
            `resolveBulkActions` folds every resolvable name into `actionDefs`,
            what's left here is a disjoint set (a handler-registered name the
            object never declared). Hiding it whenever any def existed made a
            view that mixes both silently lose half its buttons. */}
        {hasLegacy && actions.map(action => {
          const actionStr = String(action).toLowerCase();
          const isDestructive = actionStr.includes('delete') || actionStr.includes('remove') || actionStr.includes('destroy');
          const Icon = isDestructive ? Trash2 : null;
          return (
            <Button
              key={action}
              variant={isDestructive ? 'destructive' : 'outline'}
              size="sm"
              className="h-7 px-2.5 text-xs gap-1.5"
              onClick={() => onAction?.(action, selectedRows)}
              data-testid={`bulk-action-${action}`}
            >
              {Icon && <Icon className="h-3 w-3" />}
              {formatActionLabel(action)}
            </Button>
          );
        })}
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs ml-auto gap-1"
        onClick={onClearSelection}
      >
        <X className="h-3 w-3" />
        {t('grid.bulkClear', { defaultValue: 'Clear' })}
      </Button>
      </div>
    </div>
  );
};
