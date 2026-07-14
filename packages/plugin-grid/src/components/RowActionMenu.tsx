/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@object-ui/components';
import { Edit, Trash2, MoreVertical } from 'lucide-react';
import { useObjectTranslation, useCondition, toPredicateInput } from '@object-ui/react';

const ROW_ACTION_FALLBACKS: Record<string, string> = {
  'grid.openMenu': 'Open menu',
  'grid.edit': 'Edit',
  'grid.delete': 'Delete',
};

function useRowActionTranslation() {
  try {
    const { t } = useObjectTranslation();
    return (key: string) => {
      const v = t(key);
      return v === key ? (ROW_ACTION_FALLBACKS[key] ?? key) : v;
    };
  } catch {
    return (key: string) => ROW_ACTION_FALLBACKS[key] ?? key;
  }
}

/**
 * Format an action identifier string into a human-readable label.
 * e.g., 'send_email' → 'Send Email'
 */
export function formatActionLabel(action: string): string {
  return action.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/** Action definition for row-context menu items. Subset of ActionDef. */
export interface RowActionDef {
  name: string;
  label?: string;
  icon?: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'link';
  confirmText?: string;
  /** Original action def — forwarded to the dispatcher untouched. */
  [key: string]: any;
}

export interface RowActionMenuProps {
  /** The row data record */
  row: any;
  /** Custom row action identifiers (legacy, label = mechanical title-case) */
  rowActions?: string[];
  /** Full action defs — render with proper label/icon/variant from schema. */
  rowActionDefs?: RowActionDef[];
  /** Whether edit operation is available */
  canEdit?: boolean;
  /** Whether delete operation is available */
  canDelete?: boolean;
  /** Callback when edit is clicked */
  onEdit?: (row: any) => void;
  /** Callback when delete is clicked */
  onDelete?: (row: any) => void;
  /** Callback when a custom row action (string id) is clicked */
  onAction?: (action: string, row: any) => void;
  /** Callback when a schema-driven row action is clicked. */
  onActionDef?: (def: RowActionDef, row: any) => void;
  /**
   * How many `variant:'primary'` row actions may render as inline buttons
   * before the rest fold into the "⋮" overflow menu. Bounds the row's inline
   * width so multiple primary actions (e.g. Open + Upgrade Plan) can't crowd
   * and clip each other in the narrow actions column. Defaults to 1.
   */
  maxInlineActions?: number;
}

/**
 * One schema-driven row-action menu item. Extracted into its own component
 * so the `visible` CEL predicate can be evaluated with a hook
 * (`useCondition`) without violating the rules-of-hooks inside a `.map()`.
 * Mirrors `ActionMenuItem` on the record_header path: when a `visible`
 * predicate is present and evaluates false against the row, the item is
 * hidden (so e.g. "Resume" no longer shows on a running record). Bare field
 * references (`status == "active"`, `is_default != true`) resolve against
 * the row record passed in as evaluation context.
 */
const RowActionMenuItem: React.FC<{
  def: RowActionDef;
  row: any;
  onActionDef?: (def: RowActionDef, row: any) => void;
}> = ({ def, row, onActionDef }) => {
  // Evaluate predicates against the row with BOTH a bare-field scope (`status`)
  // and a `record.` scope (`record.status`) so authors can use either
  // convention consistently with the record-header / spec evaluators.
  const predicateCtx = { ...(row && typeof row === 'object' ? row : {}), record: row };
  const isVisible = useCondition(toPredicateInput(def.visible), predicateCtx);
  // `disabled` may be a boolean or a CEL predicate evaluated against the row
  // (e.g. grey out "Reassign" once a lead is converted) — previously ignored.
  const disabledPred = toPredicateInput((def as any).disabled);
  const evalDisabled = useCondition(typeof disabledPred === 'string' ? disabledPred : undefined, predicateCtx);
  const isDisabled = typeof disabledPred === 'string' ? evalDisabled : disabledPred === true;
  if (def.visible && !isVisible) return null;
  return (
    <DropdownMenuItem
      disabled={isDisabled}
      onClick={() => { if (!isDisabled) onActionDef?.(def, row); }}
      data-testid={`row-action-${def.name}`}
      className={def.variant === 'danger' ? 'text-destructive focus:text-destructive' : undefined}
    >
      {def.label ?? formatActionLabel(def.name)}
    </DropdownMenuItem>
  );
};

/** Map a schema action variant onto a Button variant. `primary` is the
 * accent ("default") button so the action reads as the row's main CTA. */
function toButtonVariant(v: RowActionDef['variant']): 'default' | 'secondary' | 'destructive' | 'ghost' | 'link' {
  switch (v) {
    case 'danger': return 'destructive';
    case 'secondary': return 'secondary';
    case 'ghost': return 'ghost';
    case 'link': return 'link';
    default: return 'default'; // 'primary' (and unset) → accent button
  }
}

/**
 * A `variant: 'primary'` row action rendered as an inline button (not folded
 * into the "⋮" overflow), so the row's main CTA — e.g. "Open" on an
 * environment — is immediately visible and clickable. Hook-safe per item so
 * the `visible` CEL predicate is honored just like the menu path.
 */
const RowActionInlineButton: React.FC<{
  def: RowActionDef;
  row: any;
  onActionDef?: (def: RowActionDef, row: any) => void;
}> = ({ def, row, onActionDef }) => {
  const isVisible = useCondition(toPredicateInput(def.visible), { ...(row && typeof row === 'object' ? row : {}), record: row });
  if (def.visible && !isVisible) return null;
  return (
    <Button
      variant={toButtonVariant(def.variant)}
      size="sm"
      className="h-8"
      data-testid={`row-action-inline-${def.name}`}
      onClick={(e) => { e.stopPropagation(); onActionDef?.(def, row); }}
    >
      {def.label ?? formatActionLabel(def.name)}
    </Button>
  );
};

export const RowActionMenu: React.FC<RowActionMenuProps> = ({
  row,
  rowActions,
  rowActionDefs,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
  onAction,
  onActionDef,
  maxInlineActions = 1,
}) => {
  const t = useRowActionTranslation();
  // Surface `variant: 'primary'` row actions inline (as the row's main CTA);
  // everything else stays in the "⋮" overflow menu. Only the first
  // `maxInlineActions` primaries render inline — any extra primaries fold into
  // the menu (kept above secondary actions) so a row never renders more inline
  // buttons than the actions column can show, which previously clipped the
  // leftmost button (e.g. "Open" hidden behind "Upgrade Plan").
  const primaryDefs = (rowActionDefs ?? []).filter(d => d.variant === 'primary');
  const inlineDefs = primaryDefs.slice(0, Math.max(0, maxInlineActions));
  const menuDefs = [
    ...primaryDefs.slice(Math.max(0, maxInlineActions)),
    ...(rowActionDefs ?? []).filter(d => d.variant !== 'primary'),
  ];
  const hasMenu = Boolean(
    (canEdit && onEdit) ||
    (canDelete && onDelete) ||
    menuDefs.length > 0 ||
    (rowActions?.length ?? 0) > 0,
  );
  return (
    <div className="flex items-center justify-end gap-1 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
      {inlineDefs.map(def => (
        <RowActionInlineButton
          key={def.name}
          def={def}
          row={row}
          onActionDef={onActionDef}
        />
      ))}
      {hasMenu && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0"
              data-testid="row-action-trigger"
            >
              <MoreVertical className="h-4 w-4" />
              <span className="sr-only">{t('grid.openMenu')}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            {canEdit && onEdit && (
              <DropdownMenuItem onClick={() => onEdit(row)}>
                <Edit className="mr-2 h-4 w-4" />
                {t('grid.edit')}
              </DropdownMenuItem>
            )}
            {canDelete && onDelete && (
              <DropdownMenuItem onClick={() => onDelete(row)}>
                <Trash2 className="mr-2 h-4 w-4" />
                {t('grid.delete')}
              </DropdownMenuItem>
            )}
            {menuDefs.map(def => (
              <RowActionMenuItem
                key={def.name}
                def={def}
                row={row}
                onActionDef={onActionDef}
              />
            ))}
            {rowActions?.map(action => (
              <DropdownMenuItem
                key={action}
                onClick={() => onAction?.(action, row)}
                data-testid={`row-action-${action}`}
              >
                {formatActionLabel(action)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
};
