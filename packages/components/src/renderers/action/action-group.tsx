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
import { useAction } from '@object-ui/react';
import { useCondition } from '@object-ui/react';
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
  const isVisible = useCondition(action.visible ? `\${${action.visible}}` : undefined);
  const isEnabled = useCondition(action.enabled ? `\${${action.enabled}}` : undefined);

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

  if (action.visible && !isVisible) return null;

  return (
    <Button
      type="button"
      variant={btnVariant as any}
      size={btnSize as any}
      className={action.className}
      disabled={(action.enabled ? !isEnabled : false) || loading}
      onClick={handleClick}
    >
      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {!loading && Icon && <Icon className={cn('h-4 w-4', action.label && 'mr-2')} />}
      {action.label}
    </Button>
  );
};

InlineActionButton.displayName = 'InlineActionButton';

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

    const isVisible = useCondition(schema.visible ? `\${${schema.visible}}` : undefined);

    // Filter actions by location if specified
    let actions = schema.actions || [];
    if (schema.location) {
      actions = actions.filter(
        a => !a.locations || a.locations.includes(schema.location!),
      );
    }

    const handleExecute = useCallback(
      async (action: ActionSchema) => {
        await execute({
          type: action.type,
          name: action.name,
          target: action.target,
          execute: action.execute,
          endpoint: action.endpoint,
          method: action.method,
          params: action.params as Record<string, any> | undefined,
          confirmText: action.confirmText,
          successMessage: action.successMessage,
          errorMessage: action.errorMessage,
          refreshAfter: action.refreshAfter,
          toast: action.toast,
        });
      },
      [execute],
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
              {!dropdownLoading && TriggerIcon && <TriggerIcon className="mr-2 h-4 w-4" />}
              {schema.label || 'Actions'}
              <ChevronDown className="ml-2 h-3 w-3 opacity-50" />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end">
            {actions.map((action, index) => {
              const Icon = resolveIcon(action.icon);
              const showSeparator = action.tags?.includes('separator-before') && index > 0;
              return (
                <React.Fragment key={action.name || index}>
                  {showSeparator && <DropdownMenuSeparator />}
                  <DropdownMenuItem
                    onSelect={async (e) => {
                      e.preventDefault();
                      setDropdownLoading(true);
                      try {
                        await handleExecute(action);
                      } finally {
                        setDropdownLoading(false);
                      }
                    }}
                    className={cn(
                      action.variant === 'destructive' && 'text-destructive focus:text-destructive',
                      action.className,
                    )}
                  >
                    {Icon && <Icon className="mr-2 h-4 w-4" />}
                    <span>{action.label || action.name}</span>
                  </DropdownMenuItem>
                </React.Fragment>
              );
            })}
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

ComponentRegistry.register('action:group', ActionGroupRenderer, {
  namespace: 'action',
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
