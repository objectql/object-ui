/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * action:bar — Location-aware action toolbar.
 *
 * Renders a set of ActionSchema items filtered by a given location.
 * Each action is rendered using its `component` type (action:button, action:icon,
 * action:menu, action:group) via the ComponentRegistry. Actions beyond the
 * `maxVisible` threshold are grouped into an overflow "More" dropdown.
 *
 * This is the "bridge" component that connects ActionSchema metadata to the UI,
 * enabling server-driven action rendering at list_toolbar, record_header,
 * list_item, record_more, record_related, and global_nav locations.
 *
 * @example
 * ```tsx
 * <SchemaRenderer schema={{
 *   type: 'action:bar',
 *   location: 'record_header',
 *   actions: [
 *     { name: 'mark_complete', label: 'Mark Complete', type: 'script', icon: 'check', component: 'action:button' },
 *     { name: 'delete', label: 'Delete', type: 'api', icon: 'trash-2', variant: 'destructive', component: 'action:button' },
 *   ],
 * }} />
 * ```
 */

import React, { forwardRef, useMemo } from 'react';
import { ComponentRegistry } from '@object-ui/core';
import type { ActionSchema, ActionLocation, ActionComponent } from '@object-ui/types';
import { useCondition } from '@object-ui/react';
import { cn } from '../../lib/utils';

export interface ActionBarSchema {
  type: 'action:bar';
  /** Actions to render */
  actions?: ActionSchema[];
  /** Filter actions by this location */
  location?: ActionLocation;
  /** Maximum visible inline actions before overflow into "More" menu (default: 3) */
  maxVisible?: number;
  /** Visibility condition expression */
  visible?: string;
  /** Layout direction */
  direction?: 'horizontal' | 'vertical';
  /** Gap between items (Tailwind gap class, default: 'gap-2') */
  gap?: string;
  /** Button variant for all actions (can be overridden per-action) */
  variant?: string;
  /** Button size for all actions (can be overridden per-action) */
  size?: string;
  /** Custom CSS class */
  className?: string;
  [key: string]: any;
}

const ActionBarRenderer = forwardRef<HTMLDivElement, { schema: ActionBarSchema; [key: string]: any }>(
  ({ schema, className, ...props }, ref) => {
    const {
      'data-obj-id': dataObjId,
      'data-obj-type': dataObjType,
      style,
      ...rest
    } = props;

    const isVisible = useCondition(schema.visible ? `\${${schema.visible}}` : undefined);

    // Filter actions by location
    const filteredActions = useMemo(() => {
      const actions = schema.actions || [];
      if (!schema.location) return actions;
      return actions.filter(
        a => !a.locations || a.locations.length === 0 || a.locations.includes(schema.location!),
      );
    }, [schema.actions, schema.location]);

    // Split into visible inline actions and overflow
    const maxVisible = schema.maxVisible ?? 3;
    const { inlineActions, overflowActions } = useMemo(() => {
      if (filteredActions.length <= maxVisible) {
        return { inlineActions: filteredActions, overflowActions: [] as ActionSchema[] };
      }
      return {
        inlineActions: filteredActions.slice(0, maxVisible),
        overflowActions: filteredActions.slice(maxVisible),
      };
    }, [filteredActions, maxVisible]);

    if (schema.visible && !isVisible) return null;
    if (filteredActions.length === 0) return null;

    const direction = schema.direction || 'horizontal';
    const gap = schema.gap || 'gap-2';

    return (
      <div
        ref={ref}
        className={cn(
          'flex items-center',
          direction === 'vertical' ? 'flex-col items-stretch' : 'flex-row flex-wrap',
          gap,
          schema.className,
          className,
        )}
        role="toolbar"
        aria-label="Actions"
        {...rest}
        {...{ 'data-obj-id': dataObjId, 'data-obj-type': dataObjType, style }}
      >
        {inlineActions.map((action) => {
          const componentType: ActionComponent = action.component || 'action:button';
          const Renderer = ComponentRegistry.get(componentType);
          if (!Renderer) return null;

          return (
            <Renderer
              key={action.name}
              schema={{
                ...action,
                type: componentType,
                variant: action.variant || schema.variant,
                size: action.size || schema.size,
              }}
            />
          );
        })}

        {overflowActions.length > 0 && (() => {
          const MenuRenderer = ComponentRegistry.get('action:menu');
          if (!MenuRenderer) return null;
          return (
            <MenuRenderer
              schema={{
                type: 'action:menu' as const,
                actions: overflowActions,
                variant: schema.variant || 'ghost',
                size: schema.size || 'sm',
              }}
            />
          );
        })()}
      </div>
    );
  },
);

ActionBarRenderer.displayName = 'ActionBarRenderer';

ComponentRegistry.register('action:bar', ActionBarRenderer, {
  namespace: 'action',
  label: 'Action Bar',
  inputs: [
    { name: 'actions', type: 'object', label: 'Actions' },
    {
      name: 'location',
      type: 'enum',
      label: 'Location',
      enum: ['list_toolbar', 'list_item', 'record_header', 'record_more', 'record_related', 'global_nav'],
    },
    {
      name: 'maxVisible',
      type: 'number',
      label: 'Max Visible Actions',
      defaultValue: 3,
    },
    {
      name: 'direction',
      type: 'enum',
      label: 'Direction',
      enum: ['horizontal', 'vertical'],
      defaultValue: 'horizontal',
    },
    {
      name: 'variant',
      type: 'enum',
      label: 'Default Variant',
      enum: ['default', 'secondary', 'outline', 'ghost'],
      defaultValue: 'outline',
    },
    {
      name: 'size',
      type: 'enum',
      label: 'Default Size',
      enum: ['sm', 'md', 'lg'],
      defaultValue: 'sm',
    },
    { name: 'className', type: 'string', label: 'CSS Class', advanced: true },
  ],
  defaultProps: {
    maxVisible: 3,
    direction: 'horizontal',
    variant: 'outline',
    size: 'sm',
    actions: [],
  },
});
