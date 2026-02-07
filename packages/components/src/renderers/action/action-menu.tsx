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

import React, { forwardRef, useCallback, useState } from 'react';
import { ComponentRegistry } from '@object-ui/core';
import type { ActionSchema } from '@object-ui/types';
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
import { Loader2, MoreHorizontal } from 'lucide-react';
import { resolveIcon } from './resolve-icon';

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

const ActionMenuItem: React.FC<{
  action: ActionSchema;
  onExecute: (action: ActionSchema) => Promise<void>;
}> = ({ action, onExecute }) => {
  const isVisible = useCondition(action.visible ? `\${${action.visible}}` : undefined);
  const isEnabled = useCondition(action.enabled ? `\${${action.enabled}}` : undefined);

  const Icon = resolveIcon(action.icon);

  if (action.visible && !isVisible) return null;

  return (
    <DropdownMenuItem
      disabled={action.enabled ? !isEnabled : false}
      onSelect={(e) => {
        e.preventDefault();
        onExecute(action);
      }}
      className={cn(
        (action.variant as string) === 'destructive' && 'text-destructive focus:text-destructive',
        action.className,
      )}
    >
      {Icon && <Icon className="mr-2 h-4 w-4" />}
      <span>{action.label || action.name}</span>
    </DropdownMenuItem>
  );
};

ActionMenuItem.displayName = 'ActionMenuItem';

const ActionMenuRenderer = forwardRef<HTMLButtonElement, { schema: ActionMenuSchema; [key: string]: any }>(
  ({ schema, className, ...props }, ref) => {
    const {
      'data-obj-id': dataObjId,
      'data-obj-type': dataObjType,
      style,
      ...rest
    } = props;

    const { execute } = useAction();
    const [loading, setLoading] = useState(false);

    const isVisible = useCondition(schema.visible ? `\${${schema.visible}}` : undefined);

    const TriggerIcon = resolveIcon(schema.icon) || MoreHorizontal;
    const variant = schema.variant || 'ghost';
    const size = schema.size || 'icon';

    const handleExecute = useCallback(
      async (action: ActionSchema) => {
        setLoading(true);
        try {
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
            aria-label={schema.label || 'More actions'}
            {...rest}
            {...{ 'data-obj-id': dataObjId, 'data-obj-type': dataObjType, style }}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
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
                <ActionMenuItem action={action} onExecute={handleExecute} />
              </React.Fragment>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  },
);

ActionMenuRenderer.displayName = 'ActionMenuRenderer';

ComponentRegistry.register('action:menu', ActionMenuRenderer, {
  namespace: 'action',
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
