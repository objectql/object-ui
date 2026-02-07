/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * action:icon — Icon-only action button for dense layouts.
 *
 * Renders a Shadcn Button (size="icon") with tooltip and ActionRunner integration.
 */

import React, { forwardRef, useCallback, useState } from 'react';
import { ComponentRegistry } from '@object-ui/core';
import type { ActionSchema } from '@object-ui/types';
import { useAction } from '@object-ui/react';
import { useCondition } from '@object-ui/react';
import { Button } from '../../ui';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../../ui';
import { cn } from '../../lib/utils';
import { Loader2 } from 'lucide-react';
import { resolveIcon } from './resolve-icon';

export interface ActionIconProps {
  schema: ActionSchema & { type: string; className?: string };
  className?: string;
  context?: Record<string, any>;
  [key: string]: any;
}

const ActionIconRenderer = forwardRef<HTMLButtonElement, ActionIconProps>(
  ({ schema, className, context: localContext, ...props }, ref) => {
    const {
      'data-obj-id': dataObjId,
      'data-obj-type': dataObjType,
      style,
      ...rest
    } = props;

    const { execute } = useAction();
    const [loading, setLoading] = useState(false);

    const isVisible = useCondition(schema.visible ? `\${${schema.visible}}` : undefined);
    const isEnabled = useCondition(schema.enabled ? `\${${schema.enabled}}` : undefined);

    const Icon = resolveIcon(schema.icon);
    const variant = schema.variant === 'primary' ? 'default' : (schema.variant || 'ghost');
    const size = 'icon';

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

    const button = (
      <Button
        ref={ref}
        type="button"
        variant={variant as any}
        size={size}
        className={cn('h-8 w-8', schema.className, className)}
        disabled={(schema.enabled ? !isEnabled : false) || loading}
        onClick={handleClick}
        aria-label={schema.label || schema.name}
        {...rest}
        {...{ 'data-obj-id': dataObjId, 'data-obj-type': dataObjType, style }}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : Icon ? (
          <Icon className="h-4 w-4" />
        ) : (
          <span className="text-xs">{schema.label?.charAt(0) || '?'}</span>
        )}
      </Button>
    );

    // Wrap with tooltip if label is provided
    if (schema.label || schema.description) {
      return (
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>{button}</TooltipTrigger>
            <TooltipContent>
              <p>{schema.label || schema.description}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    return button;
  },
);

ActionIconRenderer.displayName = 'ActionIconRenderer';

ComponentRegistry.register('action:icon', ActionIconRenderer, {
  namespace: 'action',
  label: 'Action Icon',
  inputs: [
    { name: 'name', type: 'string', label: 'Action Name' },
    { name: 'label', type: 'string', label: 'Tooltip Label' },
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
      enum: ['default', 'secondary', 'destructive', 'outline', 'ghost'],
      defaultValue: 'ghost',
    },
    { name: 'className', type: 'string', label: 'CSS Class', advanced: true },
  ],
  defaultProps: {
    icon: 'play',
    type: 'script',
    variant: 'ghost',
  },
});
