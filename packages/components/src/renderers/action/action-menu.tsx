/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * action:menu — Dropdown menu for overflow actions.
 *
 * Renders a Shadcn DropdownMenu populated from ActionSchema[].
 * Each menu item triggers the corresponding action via ActionRunner.
 */

import React, { forwardRef, useCallback, useMemo, useState } from 'react';
import { ComponentRegistry } from '@object-ui/core';
import type { ActionSchema } from '@object-ui/types';
import { useAction } from '@object-ui/react';
import { useCondition, toPredicateInput, usePredicateRecordContext } from '@object-ui/react';
import { useObjectTranslation } from '@object-ui/i18n';
import { Button } from '../../ui';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../ui';
import { cn } from '../../lib/utils';
import { Loader2, MoreHorizontal } from 'lucide-react';
import { resolveIcon } from './resolve-icon';
import { hasDeclaredVisibilityGate } from './visibility-gate';
import { hasAutoTrigger, useAutoTriggerOnce } from './auto-trigger';

function useMoreActionsLabel(): string {
  // useObjectTranslation is provider-safe (never throws); no try/catch, which
  // would wrap the hook call and violate rules-of-hooks. The 'More actions'
  // fallback still applies when the key is missing/untranslated.
  const { t } = useObjectTranslation();
  const v = t('detail.moreActions');
  return !v || v === 'detail.moreActions' ? 'More actions' : v;
}

export interface ActionMenuSchema {
  type: 'action:menu';
  /** Menu trigger label (defaults to icon-only) */
  label?: string;
  /** Menu trigger icon (defaults to more-horizontal) */
  icon?: string;
  /** Actions to render as menu items */
  actions?: ActionSchema[];
  /** Trigger variant */
  variant?: string;
  /** Trigger size */
  size?: string;
  /** Visibility condition */
  visible?: string;
  /** Custom CSS class */
  className?: string;
  [key: string]: any;
}

/**
 * One action inside an `action:menu`. Exported for its pin tests only (it is
 * not re-exported from the package index) — mirrors `DropdownActionItem` in
 * `action-group.tsx`, whose gate is the same one.
 */
export const ActionMenuItem: React.FC<{
  action: ActionSchema;
  onExecute: (action: ActionSchema) => Promise<void>;
  /**
   * The row this menu is mounted over, forwarded by the host. Optional: an
   * object-level menu genuinely has no row, and a predicate over an empty
   * record is still evaluable (objectui#4075 — the failure being fixed is a
   * predicate that FAULTS on an unbound root, not one that reads a missing
   * field).
   */
  record?: unknown;
}> = ({ action, onExecute, record }) => {
  // The row bound the three canonical ways — `record.status`, bare `status`,
  // `data.status`. This item used to pass `undefined`, i.e. no record at all,
  // so every row-scoped predicate an author wrote here faulted on its root
  // (objectui#4075). See `usePredicateRecordContext`.
  const recordData = usePredicateRecordContext(record);
  // Fails CLOSED on a throwing predicate — mirrors ActionEngine's
  // getActionsForLocation contract (see action-button.tsx for rationale).
  const isVisible = useCondition(toPredicateInput(action.visible), recordData, {
    throwOnError: true,
    label: `action "${action.name ?? action.label ?? 'action:menu item'}" (visible)`,
  });
  // Spec `disabled` (boolean | CEL — disabled when TRUE) primary, legacy
  // non-spec `enabled` fallback (#1885 follow-through — only action-button
  // was wired; this renderer ignored a spec-authored `disabled`).
  const isDisabledPred = useCondition(toPredicateInput((action as any).disabled), recordData);
  const isEnabled = useCondition(toPredicateInput(action.enabled), recordData);

  const iconElement = useMemo(() => {
    const Icon = resolveIcon(action.icon);
    // eslint-disable-next-line react-hooks/static-components -- Icon is resolved from a stable icon registry
    return Icon ? <Icon className="mr-2 h-4 w-4" /> : null;
  }, [action.icon]);

  // A DECLARED gate decides; truthiness would read `visible: false` as ungated
  // and render it (objectui#3812) — the same gate `action:group`'s two member
  // leaves read. `false` short-circuits at the evaluation entry, so the
  // `throwOnError` posture above still only applies to real predicates.
  if (hasDeclaredVisibilityGate(action.visible) && !isVisible) return null;

  return (
    <DropdownMenuItem
      // Declared-gate test, the same definition the `visible` gate above reads
      // and the same one `action:group`'s two leaves read (objectui#3842 ruling
      // applied here by #3849 — historic name kept, no alias). `disabled: ''`
      // is not a gate: the evaluation entry reads an empty predicate as "no
      // condition → true", which on this key means DISABLE, so `!= null` alone
      // greyed the item out forever. The negated legacy `enabled` leg is
      // behaviour-preserving under the same definition.
      disabled={hasDeclaredVisibilityGate((action as any).disabled)
        ? isDisabledPred
        : hasDeclaredVisibilityGate(action.enabled)
          ? !isEnabled
          : false}
      onSelect={(e) => {
        e.preventDefault();
        onExecute(action);
      }}
      className={cn(
        (action.variant as string) === 'destructive' && 'text-destructive focus:text-destructive',
        action.className,
      )}
    >
      {iconElement}
      <span>{action.label || action.name}</span>
    </DropdownMenuItem>
  );
};

ActionMenuItem.displayName = 'ActionMenuItem';

/**
 * The menu's `autoTrigger` consumption point (#4162) — renders NOTHING and
 * executes its action once, through the same `handleExecute` a click uses.
 *
 * ## Why a headless component per action, and not the item
 *
 * The consumption point has to be where the action provably ARRIVES, which is
 * this renderer receiving it in `schema.actions`. It cannot be `ActionMenuItem`:
 * the items live inside `DropdownMenuContent`, which Radix mounts only when the
 * dropdown OPENS, so an effect there would wait on the very click the flag
 * exists to avoid — and would make the trigger's open state, not the action,
 * decide whether a deep link runs. These mount with the menu itself.
 *
 * ## Why a component rather than a loop of hooks
 *
 * One `useAutoTriggerOnce` per action is the point (the guard is per action, so
 * two flagged actions each run once), and hooks cannot be called in a loop.
 * One instance per action, keyed by name, gives each its own guard ref for the
 * menu's lifetime. They are rendered for EVERY action, not only the flagged
 * ones, so the ref survives the flag flipping — mounting on the flip and
 * unmounting on the flip-back would hand a true→false→true action a fresh ref
 * and fire it twice, where `action:button`'s long-lived ref fires once.
 */
const ActionAutoTrigger: React.FC<{
  action: ActionSchema;
  onExecute: (action: ActionSchema) => Promise<void>;
}> = ({ action, onExecute }) => {
  const run = useCallback(() => onExecute(action), [action, onExecute]);
  useAutoTriggerOnce(hasAutoTrigger(action), run);
  return null;
};

ActionAutoTrigger.displayName = 'ActionAutoTrigger';

const ActionMenuRenderer = forwardRef<HTMLButtonElement, { schema: ActionMenuSchema; [key: string]: any }>(
  ({ schema, className, ...props }, ref) => {
    const {
      'data-obj-id': dataObjId,
      'data-obj-type': dataObjType,
      style,
      // The row the host mounted this menu over — the predicate context for
      // this menu's own `visible` AND for every item in it (objectui#4075).
      // Also keeps `data` out of `...rest`, which is spread onto the DOM
      // trigger button.
      data,
      ...rest
    } = props;

    const { execute } = useAction();
    const [loading, setLoading] = useState(false);
    const moreActionsLabel = useMoreActionsLabel();

    // The row bound the three canonical ways — see `usePredicateRecordContext`.
    const recordData = usePredicateRecordContext(data);

    // Fails CLOSED on a throwing predicate — mirrors ActionEngine's
    // getActionsForLocation contract (see action-button.tsx for rationale).
    const isVisible = useCondition(toPredicateInput(schema.visible), recordData, {
      throwOnError: true,
      label: `action:menu "${schema.label ?? schema.icon ?? 'menu'}" (visible)`,
    });

    const TriggerIcon = resolveIcon(schema.icon) || MoreHorizontal;
    const variant = schema.variant || 'ghost';
    const size = schema.size || 'icon';

    const handleExecute = useCallback(
      async (action: ActionSchema) => {
        setLoading(true);
        try {
          // UI-local escape hatch: direct callback, bypass ActionEngine
          if (typeof action.onClick === 'function') {
            await action.onClick();
            return;
          }
          await execute({
            type: action.type,
            name: action.name,
            target: action.target,
            openIn: (action as any).openIn,
            endpoint: action.endpoint,
            method: action.method,
            params: action.params as Record<string, any> | undefined,
            // See action-button.tsx — the `type: 'api'` payload key (objectstack#6837).
            bodyExtra: action.bodyExtra,
            // See action-button.tsx — the body-WRAPPING key (objectstack#6938).
            bodyShape: action.bodyShape,
            confirmText: action.confirmText,
            successMessage: action.successMessage,
            errorMessage: action.errorMessage,
            refreshAfter: action.refreshAfter,
            // Placement declaration — see action-button.tsx (#2210).
            locations: action.locations,
            toast: action.toast,
            // See action-button.tsx — overflow-menu actions need the
            // resultDialog spec forwarded too or the one-shot reveal is lost.
            resultDialog: (action as any).resultDialog,
          });
        } finally {
          setLoading(false);
        }
      },
      [execute],
    );

    if (schema.visible && !isVisible) return null;

    const actions = schema.actions || [];
    if (actions.length === 0) return null;

    return (
      <>
        {/*
          `autoTrigger` is a property of the ACTION, so this renderer honours it
          for the actions it receives — an action does not lose its auto-trigger
          for having sorted past `action:bar`'s `maxVisible` (#4162). Executing
          is the whole consumption: the dropdown is deliberately NOT opened, so
          a transport flag never moves what the user sees. Rendered outside
          `DropdownMenuContent` on purpose — see `ActionAutoTrigger`.

          Placed after this renderer's early returns, which is the same rule
          `action:bar` already follows: a container that renders nothing mounts
          no children, so a hidden bar's inline `autoTrigger` button never fires
          either. Container visibility governs mounting; the action's own
          `visible` gate does not suppress the trigger (parity with
          `action:button`, whose effect runs even when its gate renders null).
        */}
        {actions.map((action, index) => (
          <ActionAutoTrigger
            key={`auto-trigger:${action.name || index}`}
            action={action}
            onExecute={handleExecute}
          />
        ))}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              ref={ref}
              type="button"
              variant={variant as any}
              size={size as any}
              className={cn(
                size === 'icon' && 'h-8 w-8',
                schema.className,
                className,
              )}
              disabled={loading}
              aria-label={schema.label || moreActionsLabel}
              {...rest}
              {...{ 'data-obj-id': dataObjId, 'data-obj-type': dataObjType, style }}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  {/* eslint-disable-next-line react-hooks/static-components -- resolveIcon returns a stable icon component from a static registry, not one created during render */}
                  <TriggerIcon className={cn('h-4 w-4', schema.label && 'mr-2')} />
                  {schema.label && <span>{schema.label}</span>}
                </>
              )}
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end">
            {actions.map((action, index) => {
              // Render separator for actions tagged with 'separator-before'
              const showSeparator = action.tags?.includes('separator-before') && index > 0;
              return (
                <React.Fragment key={action.name || index}>
                  {showSeparator && <DropdownMenuSeparator />}
                  <ActionMenuItem action={action} onExecute={handleExecute} record={data} />
                </React.Fragment>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </>
    );
  },
);

ActionMenuRenderer.displayName = 'ActionMenuRenderer';

ComponentRegistry.register('menu', ActionMenuRenderer, {
  namespace: 'action',
  skipFallback: true,
  label: 'Action Menu',
  inputs: [
    { name: 'label', type: 'string', label: 'Trigger Label' },
    { name: 'icon', type: 'string', label: 'Trigger Icon' },
    { name: 'actions', type: 'object', label: 'Actions' },
    {
      name: 'variant',
      type: 'enum',
      label: 'Trigger Variant',
      enum: ['default', 'secondary', 'outline', 'ghost'],
      defaultValue: 'ghost',
    },
    { name: 'className', type: 'string', label: 'CSS Class', advanced: true },
  ],
  defaultProps: {
    variant: 'ghost',
    actions: [],
  },
});
