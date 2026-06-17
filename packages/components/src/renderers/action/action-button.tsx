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
import { useCondition, toPredicateInput } from '@object-ui/react';
import { Button } from '../../ui';
import { cn } from '../../lib/utils';
import { Loader2 } from 'lucide-react';
import { resolveIcon } from './resolve-icon';

export interface ActionButtonProps {
  schema: ActionSchema & { type: string; className?: string; actionType?: string };
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
      data,
      ...rest
    } = props;

    const { execute } = useAction();
    const [loading, setLoading] = useState(false);

    // Record data may be passed from SchemaRenderer (e.g. DetailView passes record data)
    const recordData = data != null && typeof data === 'object' ? data as Record<string, any> : {};

    // Evaluate visibility and disabled conditions with record data context.
    const isVisible = useCondition(toPredicateInput(schema.visible), recordData);
    // Spec field is `disabled` (boolean | CEL predicate — disabled when TRUE).
    // It previously had zero consumers (the renderer only read a non-spec
    // `enabled`), so a spec-authored `disabled` guard did nothing (#1885,
    // ADR-0049). We now consume `disabled` as the primary control and keep the
    // legacy non-spec `enabled` as a deprecated fallback so existing metadata
    // keeps working.
    const isDisabled = useCondition(toPredicateInput((schema as any).disabled), recordData);
    const isEnabled = useCondition(toPredicateInput(schema.enabled), recordData);

    // Resolve icon
    const Icon = resolveIcon(schema.icon);

    // Map schema variant to Shadcn button variant
    const variant = schema.variant === 'primary' ? 'default' : (schema.variant || 'default');
    const size = schema.size === 'md' ? 'default' : (schema.size || 'default');

    const handleClick = useCallback(async () => {
      if (loading) return;
      setLoading(true);

      try {
        // Route params correctly:
        // - Array of objects with name+type → ActionParamDef[] → pass as actionParams for collection
        // - Otherwise → pass as actual param values
        const paramsPayload = Array.isArray(schema.params)
          ? { actionParams: schema.params as any }
          : { params: schema.params as Record<string, any> | undefined };

        await execute({
          type: schema.actionType || schema.type,
          name: schema.name,
          // Forward the human label/description so a param-collection dialog
          // can title itself as the action ("Create Environment") instead of a
          // generic "Action parameters" prompt.
          label: schema.label,
          description: (schema as any).description,
          target: schema.target,
          execute: schema.execute,
          endpoint: schema.endpoint,
          method: schema.method,
          ...paramsPayload,
          confirmText: schema.confirmText,
          successMessage: schema.successMessage,
          errorMessage: schema.errorMessage,
          refreshAfter: schema.refreshAfter,
          // Forward `undoable` (and the row id field) so update actions can
          // offer an Undo affordance — without this the flag is dropped and the
          // handler never builds the undo operation.
          undoable: (schema as any).undoable,
          recordIdField: (schema as any).recordIdField,
          toast: schema.toast,
          // One-shot reveal dialog for actions whose response is shown
          // exactly once (2FA setup, OAuth client_secret, regenerated
          // backup codes). Without this forward the ActionRunner falls
          // back to the success toast and the user loses the value.
          resultDialog: (schema as any).resultDialog,
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
        disabled={(
          (schema as any).disabled != null
            ? isDisabled
            : schema.enabled != null
              ? !isEnabled
              : false
        ) || loading}
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
