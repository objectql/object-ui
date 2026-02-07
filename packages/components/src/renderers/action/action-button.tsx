/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * action:button — Smart action button driven by ActionSchema.
 *
 * Renders a Shadcn Button wired to the ActionRunner. Supports:
 * - All 5 spec action types (script, url, modal, flow, api)
 * - Conditional visibility & enabled state
 * - Loading indicator during async execution
 * - Icon rendering via Lucide
 * - Variant / size / className overrides from schema
 */

import React, { forwardRef, useCallback, useState } from 'react';
import { ComponentRegistry } from '@object-ui/core';
import type { ActionSchema } from '@object-ui/types';
import { useAction } from '@object-ui/react';
import { useCondition } from '@object-ui/react';
import { Button } from '../../ui';
import { cn } from '../../lib/utils';
import { Loader2 } from 'lucide-react';
import { resolveIcon } from './resolve-icon';

export interface ActionButtonProps {
  schema: ActionSchema & { type: string; className?: string };
  className?: string;
  /** Override context for this specific action */
  context?: Record<string, any>;
  [key: string]: any;
}

const ActionButtonRenderer = forwardRef<HTMLButtonElement, ActionButtonProps>(
  ({ schema, className, context: localContext, ...props }, ref) => {
    const {
      'data-obj-id': dataObjId,
      'data-obj-type': dataObjType,
      style,
      ...rest
    } = props;

    const { execute } = useAction();
    const [loading, setLoading] = useState(false);

    // Evaluate visibility and enabled conditions
    const isVisible = useCondition(schema.visible ? `\${${schema.visible}}` : undefined);
    const isEnabled = useCondition(schema.enabled ? `\${${schema.enabled}}` : undefined);

    // Resolve icon
    const Icon = resolveIcon(schema.icon);

    // Map schema variant to Shadcn button variant
    const variant = schema.variant === 'primary' ? 'default' : (schema.variant || 'default');
    const size = schema.size === 'md' ? 'default' : (schema.size || 'default');

    const handleClick = useCallback(async () => {
      if (loading) return;
      setLoading(true);

      try {
        await execute({
          type: schema.type,
          name: schema.name,
          target: schema.target,
          execute: schema.execute,
          endpoint: schema.endpoint,
          method: schema.method,
          params: schema.params as Record<string, any> | undefined,
          confirmText: schema.confirmText,
          successMessage: schema.successMessage,
          errorMessage: schema.errorMessage,
          refreshAfter: schema.refreshAfter,
          toast: schema.toast,
          ...localContext,
        });
      } finally {
        setLoading(false);
      }
    }, [schema, execute, loading, localContext]);

    if (schema.visible && !isVisible) return null;

    return (
      <Button
        ref={ref}
        type="button"
        variant={variant as any}
        size={size as any}
        className={cn(schema.className, className)}
        disabled={(schema.enabled ? !isEnabled : false) || loading}
        onClick={handleClick}
        {...rest}
        {...{ 'data-obj-id': dataObjId, 'data-obj-type': dataObjType, style }}
      >
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {!loading && Icon && <Icon className={cn('h-4 w-4', schema.label && 'mr-2')} />}
        {schema.label}
      </Button>
    );
  },
);

ActionButtonRenderer.displayName = 'ActionButtonRenderer';

ComponentRegistry.register('action:button', ActionButtonRenderer, {
  namespace: 'action',
  label: 'Action Button',
  inputs: [
    { name: 'name', type: 'string', label: 'Action Name' },
    { name: 'label', type: 'string', label: 'Label', defaultValue: 'Action' },
    { name: 'icon', type: 'string', label: 'Icon' },
    {
      name: 'type',
      type: 'enum',
      label: 'Action Type',
      enum: ['script', 'url', 'modal', 'flow', 'api'],
      defaultValue: 'script',
    },
    { name: 'target', type: 'string', label: 'Target' },
    {
      name: 'variant',
      type: 'enum',
      label: 'Variant',
      enum: ['default', 'primary', 'secondary', 'destructive', 'outline', 'ghost'],
      defaultValue: 'default',
    },
    {
      name: 'size',
      type: 'enum',
      label: 'Size',
      enum: ['sm', 'md', 'lg'],
      defaultValue: 'md',
    },
    { name: 'className', type: 'string', label: 'CSS Class', advanced: true },
  ],
  defaultProps: {
    label: 'Action',
    type: 'script',
    variant: 'default',
    size: 'md',
  },
});
