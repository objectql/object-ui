/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * action:group — Toolbar or button group for organizing related actions.
 *
 * Supports two display modes:
 * - 'inline': Renders all actions as a horizontal button row
 * - 'dropdown': Renders a primary button + dropdown for overflow
 *
 * Filters actions by location when `location` prop is provided.
 */

import React, { forwardRef, useCallback, useState } from 'react';
import { ComponentRegistry } from '@object-ui/core';
import type { ActionSchema, ActionGroup, ActionLocation } from '@object-ui/types';
import { actionRendersAt } from '@object-ui/types';
import { useAction } from '@object-ui/react';
import { useCondition, toPredicateInput } from '@object-ui/react';
import { Button } from '../../ui';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../ui';
import { cn } from '../../lib/utils';
import { Loader2, ChevronDown } from 'lucide-react';
import { resolveIcon } from './resolve-icon';
import { hasDeclaredVisibilityGate } from './visibility-gate';

export interface ActionGroupSchema {
  type: 'action:group';
  /** Group name */
  name?: string;
  /** Group label */
  label?: string;
  /** Group icon */
  icon?: string;
  /** Actions in this group */
  actions?: ActionSchema[];
  /** Display mode: inline button row or dropdown */
  display?: 'dropdown' | 'inline';
  /** Filter actions by location */
  location?: ActionLocation;
  /** Group visibility condition */
  visible?: string;
  /** Button variant for inline actions */
  variant?: string;
  /** Button size for inline actions */
  size?: string;
  /** Custom CSS class */
  className?: string;
  [key: string]: any;
}

/**
 * Inline action button within a group.
 */
const InlineActionButton: React.FC<{
  action: ActionSchema;
  variant?: string;
  size?: string;
  onExecute: (action: ActionSchema) => Promise<void>;
}> = ({ action, variant, size, onExecute }) => {
  const [loading, setLoading] = useState(false);
  const isVisible = useCondition(toPredicateInput(action.visible));
  // Spec field is `disabled` (boolean | CEL — disabled when TRUE). #1885 wired
  // it in action-button only; this leaf kept reading the legacy non-spec
  // `enabled`, so a spec-authored `disabled` guard did nothing here. `disabled`
  // is now the primary control; `enabled` stays as a deprecated fallback.
  const isDisabledPred = useCondition(toPredicateInput((action as any).disabled));
  const isEnabled = useCondition(toPredicateInput(action.enabled));

  const Icon = resolveIcon(action.icon);
  const btnVariant = (action.variant as string) === 'primary' ? 'default' : (action.variant || variant || 'outline');
  const btnSize = action.size === 'md' ? 'default' : (action.size || size || 'sm');

  const handleClick = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    try {
      await onExecute(action);
    } finally {
      setLoading(false);
    }
  }, [action, onExecute, loading]);

  // A DECLARED gate decides; truthiness would read `visible: false` as ungated
  // and render it (objectui#3812) — see `hasDeclaredVisibilityGate`.
  if (hasDeclaredVisibilityGate(action.visible) && !isVisible) return null;

  return (
    <Button
      type="button"
      variant={btnVariant as any}
      size={btnSize as any}
      className={action.className}
      // Is a `disabled` / `enabled` gate DECLARED? Same question as the
      // `visible` gate above, so it reads the same definition (historic name
      // kept, not aliased — objectui#3842 ruling, applied here by #3849). On
      // this key `!= null` alone was a live defect: an empty predicate reaches
      // the evaluation entry as "no condition → true", which means DISABLE
      // here, so `disabled: ''` greyed the button out forever. The legacy
      // `enabled` leg is negated and therefore behaviour-preserving under the
      // same definition — derivation in
      // `__tests__/action-disabled-declared-gate.test.tsx`.
      disabled={(
        hasDeclaredVisibilityGate((action as any).disabled)
          ? isDisabledPred
          : hasDeclaredVisibilityGate(action.enabled)
            ? !isEnabled
            : false
      ) || loading}
      onClick={handleClick}
    >
      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {/* eslint-disable-next-line react-hooks/static-components -- resolveIcon returns a stable icon component from a static registry, not one created during render */}
      {!loading && Icon && <Icon className={cn('h-4 w-4', action.label && 'mr-2')} />}
      {action.label}
    </Button>
  );
};

InlineActionButton.displayName = 'InlineActionButton';

/**
 * One action inside an `action:group`'s dropdown (overflow) menu. Extracted
 * into its own component so the action's `visible`/`enabled` CEL predicate can
 * be evaluated with a hook (`useCondition`) without violating the
 * rules-of-hooks inside a `.map()`. Mirrors `InlineActionButton` (the
 * inline-mode leaf) so BOTH display modes honor `visible`/`enabled`
 * identically — previously the dropdown branch rendered every action
 * unconditionally, so an action with `visible: "record.role != 'owner'"`
 * showed even when its predicate was false.
 */
export const DropdownActionItem: React.FC<{
  action: ActionSchema;
  index: number;
  onSelect: (action: ActionSchema) => void | Promise<void>;
}> = ({ action, index, onSelect }) => {
  const isVisible = useCondition(toPredicateInput(action.visible));
  // Spec `disabled` primary, legacy non-spec `enabled` fallback (see
  // InlineActionButton above — #1885 follow-through).
  const isDisabledPred = useCondition(toPredicateInput((action as any).disabled));
  const isEnabled = useCondition(toPredicateInput(action.enabled));
  // Same declared-gate rule as `InlineActionButton` above — one action cannot be
  // hidden in one display mode and shown in the other (objectui#3812).
  if (hasDeclaredVisibilityGate(action.visible) && !isVisible) return null;
  const Icon = resolveIcon(action.icon);
  // Declared-gate test, same definition as `InlineActionButton` above: one
  // action cannot be greyed out in one display mode and clickable in the other
  // (objectui#3842 / #3849). `disabled: ''` is not a declared gate — an empty
  // predicate is nothing to evaluate, and on this key the evaluation entry's
  // "no condition → true" means DISABLE.
  const isDisabled = hasDeclaredVisibilityGate((action as any).disabled)
    ? isDisabledPred
    : hasDeclaredVisibilityGate(action.enabled)
      ? !isEnabled
      : false;
  const showSeparator = action.tags?.includes('separator-before') && index > 0;
  return (
    <>
      {showSeparator && <DropdownMenuSeparator />}
      <DropdownMenuItem
        disabled={isDisabled}
        onSelect={async (e) => {
          e.preventDefault();
          if (isDisabled) return;
          await onSelect(action);
        }}
        className={cn(
          (action.variant as string) === 'destructive' && 'text-destructive focus:text-destructive',
          action.className,
        )}
      >
        {/* Dynamic icon resolution from Lucide, not component creation during render */}
        {/* eslint-disable-next-line react-hooks/static-components */}
        {Icon && <Icon className="mr-2 h-4 w-4" />}
        <span>{action.label || action.name}</span>
      </DropdownMenuItem>
    </>
  );
};

DropdownActionItem.displayName = 'DropdownActionItem';

const ActionGroupRenderer = forwardRef<HTMLDivElement, { schema: ActionGroupSchema; [key: string]: any }>(
  ({ schema, className, ...props }, ref) => {
    const {
      'data-obj-id': dataObjId,
      'data-obj-type': dataObjType,
      style,
      ...rest
    } = props;

    const { execute } = useAction();
    const [dropdownLoading, setDropdownLoading] = useState(false);

    const isVisible = useCondition(toPredicateInput(schema.visible));

    // Placement is `actionRendersAt`'s call (objectui#3142) — this used to
    // show an action with `locations: undefined` while hiding one with
    // `locations: []`, a third reading of the same key.
    const actions = (schema.actions || []).filter(a => actionRendersAt(a, schema.location));

    const handleExecute = useCallback(
      async (action: ActionSchema) => {
        await execute({
          type: action.type,
          name: action.name,
          target: action.target,
          openIn: (action as any).openIn,
          endpoint: action.endpoint,
          method: action.method,
          params: action.params as Record<string, any> | undefined,
          confirmText: action.confirmText,
          successMessage: action.successMessage,
          errorMessage: action.errorMessage,
          refreshAfter: action.refreshAfter,
          // Placement declaration — see action-button.tsx (#2210).
          locations: action.locations,
          toast: action.toast,
        });
      },
      [execute],
    );

    // Dropdown items share the trigger's loading spinner, so wrap execution to
    // toggle `dropdownLoading` (inline items manage their own local loading).
    const handleDropdownSelect = useCallback(
      async (action: ActionSchema) => {
        setDropdownLoading(true);
        try {
          await handleExecute(action);
        } finally {
          setDropdownLoading(false);
        }
      },
      [handleExecute],
    );

    if (schema.visible && !isVisible) return null;
    if (actions.length === 0) return null;

    const display = schema.display || 'inline';

    // --- DROPDOWN MODE ---
    if (display === 'dropdown') {
      const TriggerIcon = resolveIcon(schema.icon);
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant={(schema.variant || 'outline') as any}
              size={(schema.size === 'md' ? 'default' : (schema.size || 'default')) as any}
              className={cn(schema.className, className)}
              disabled={dropdownLoading}
              {...{ 'data-obj-id': dataObjId, 'data-obj-type': dataObjType, style }}
            >
              {dropdownLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {/* eslint-disable-next-line react-hooks/static-components -- resolveIcon returns a stable icon component from a static registry, not one created during render */}
              {!dropdownLoading && TriggerIcon && <TriggerIcon className="mr-2 h-4 w-4" />}
              {schema.label || 'Actions'}
              <ChevronDown className="ml-2 h-3 w-3 opacity-50" />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end">
            {actions.map((action, index) => (
              <DropdownActionItem
                key={action.name || index}
                action={action}
                index={index}
                onSelect={handleDropdownSelect}
              />
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    }

    // --- INLINE MODE (default) ---
    return (
      <div
        ref={ref}
        className={cn('flex items-center gap-2', schema.className, className)}
        {...rest}
        {...{ 'data-obj-id': dataObjId, 'data-obj-type': dataObjType, style }}
      >
        {actions.map((action) => (
          <InlineActionButton
            key={action.name}
            action={action}
            variant={schema.variant}
            size={schema.size}
            onExecute={handleExecute}
          />
        ))}
      </div>
    );
  },
);

ActionGroupRenderer.displayName = 'ActionGroupRenderer';

ComponentRegistry.register('group', ActionGroupRenderer, {
  namespace: 'action',
  skipFallback: true,
  label: 'Action Group',
  inputs: [
    { name: 'name', type: 'string', label: 'Group Name' },
    { name: 'label', type: 'string', label: 'Label' },
    { name: 'icon', type: 'string', label: 'Icon' },
    { name: 'actions', type: 'object', label: 'Actions' },
    {
      name: 'display',
      type: 'enum',
      label: 'Display Mode',
      enum: ['inline', 'dropdown'],
      defaultValue: 'inline',
    },
    {
      name: 'variant',
      type: 'enum',
      label: 'Variant',
      enum: ['default', 'secondary', 'outline', 'ghost'],
      defaultValue: 'outline',
    },
    {
      name: 'size',
      type: 'enum',
      label: 'Size',
      enum: ['sm', 'md', 'lg'],
      defaultValue: 'sm',
    },
    { name: 'className', type: 'string', label: 'CSS Class', advanced: true },
  ],
  defaultProps: {
    display: 'inline',
    variant: 'outline',
    size: 'sm',
    actions: [],
  },
});
