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
import { ACTION_LOCATIONS } from '@object-ui/types';
import { useCondition, toPredicateInput } from '@object-ui/react';
import { useObjectTranslation } from '@object-ui/i18n';
import { cn } from '../../lib/utils';
import { useIsMobile } from '../../hooks/use-mobile';

function useActionsLabel(): string {
  try {
    const { t } = useObjectTranslation();
    const v = t('common.actions');
    return !v || v === 'common.actions' ? 'Actions' : v;
  } catch {
    return 'Actions';
  }
}

export interface ActionBarSchema {
  type: 'action:bar';
  /** Business actions to render — subject to inline/overflow split via {@link maxVisible} */
  actions?: ActionSchema[];
  /**
   * System/chrome actions (Duplicate, Export, View History, Delete, etc.) that
   * are *always* placed in the overflow menu — never inline — regardless of
   * {@link maxVisible}. They share a single overflow button with any business
   * actions that spilled past {@link maxVisible}, guaranteeing at most one
   * "More" menu per bar.
   *
   * The first system action is automatically separated from business-overflow
   * entries by a menu separator.
   */
  systemActions?: ActionSchema[];
  /** Filter actions by this location */
  location?: ActionLocation;
  /** Maximum visible inline actions before overflow into "More" menu (default: 3) */
  maxVisible?: number;
  /** Maximum visible inline actions on mobile devices (default: 1). Desktop uses maxVisible instead. */
  mobileMaxVisible?: number;
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
    const actionsAriaLabel = useActionsLabel();
    const {
      'data-obj-id': dataObjId,
      'data-obj-type': dataObjType,
      style,
      data,
      // Strip schema metadata props that are consumed via `schema.*` and
      // must NOT be spread onto the underlying DOM element (avoids React
      // "unknown DOM attribute" warnings — especially for camelCase keys
      // like `systemActions`, `mobileMaxVisible`).
      /* eslint-disable @typescript-eslint/no-unused-vars */
      actions: _schemaActions,
      systemActions: _schemaSystemActions,
      location: _schemaLocation,
      maxVisible: _schemaMaxVisible,
      mobileMaxVisible: _schemaMobileMaxVisible,
      direction: _schemaDirection,
      gap: _schemaGap,
      variant: _schemaVariant,
      size: _schemaSize,
      visible: _schemaVisible,
      /* eslint-enable @typescript-eslint/no-unused-vars */
      ...rest
    } = props;

    // Fails CLOSED on a throwing predicate — mirrors ActionEngine's
    // getActionsForLocation contract (see action-button.tsx for rationale).
    const isVisible = useCondition(toPredicateInput(schema.visible), undefined, { throwOnError: true });
    const isMobile = useIsMobile();

    // Filter business actions by location and deduplicate by name
    const filteredActions = useMemo(() => {
      const actions = schema.actions || [];
      const located = !schema.location
        ? actions
        : actions.filter(
            a => !a.locations || a.locations.length === 0 || a.locations.includes(schema.location!),
          );
      // Deduplicate by action name — keep first occurrence
      const seen = new Set<string>();
      const deduped = located.filter(a => {
        if (!a.name) return true;
        if (seen.has(a.name)) return false;
        seen.add(a.name);
        return true;
      });
      // Order by explicit `order` (lower = earlier / more prominent) before the
      // inline/overflow split. Stable: actions that leave `order` unset (treated
      // as 0) keep their incoming order, so this only moves actions that opt in.
      // This is what lets an injected Approve/Reject with a negative `order`
      // float into the primary-button slot instead of the "More" overflow menu
      // (#2670 / objectui#2339), and lets authors order their own record_header
      // actions declaratively via `Action.order`.
      if (deduped.some(a => a.order !== undefined)) {
        return [...deduped].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      }
      return deduped;
    }, [schema.actions, schema.location]);

    // System actions: always go into the overflow menu, deduped by name,
    // never filtered by location (they're chrome, not business logic).
    const systemActions = useMemo(() => {
      const actions = schema.systemActions || [];
      const seen = new Set<string>();
      return actions.filter(a => {
        if (!a.name) return true;
        if (seen.has(a.name)) return false;
        seen.add(a.name);
        return true;
      });
    }, [schema.systemActions]);

    // Split business actions into visible inline and overflow.
    // On mobile, show fewer actions inline (default: 1).
    const maxVisible = isMobile
      ? (schema.mobileMaxVisible ?? 1)
      : (schema.maxVisible ?? 3);
    const { inlineActions, overflowActions } = useMemo(() => {
      if (filteredActions.length <= maxVisible) {
        return { inlineActions: filteredActions, overflowActions: [] as ActionSchema[] };
      }
      return {
        inlineActions: filteredActions.slice(0, maxVisible),
        overflowActions: filteredActions.slice(maxVisible),
      };
    }, [filteredActions, maxVisible]);

    // Merge business overflow with system actions into a single overflow list.
    // Insert a visual separator before the first system action when both
    // groups coexist, so users can distinguish domain vs. chrome actions.
    const combinedOverflow = useMemo<ActionSchema[]>(() => {
      if (systemActions.length === 0) return overflowActions;
      if (overflowActions.length === 0) return systemActions;
      const [firstSys, ...restSys] = systemActions;
      const firstWithSeparator: ActionSchema = {
        ...firstSys,
        tags: [...(firstSys.tags || []), 'separator-before'],
      };
      return [...overflowActions, firstWithSeparator, ...restSys];
    }, [overflowActions, systemActions]);

    if (schema.visible && !isVisible) return null;
    if (filteredActions.length === 0 && systemActions.length === 0) return null;

    const direction = schema.direction || 'horizontal';
    const gap = schema.gap || 'gap-2';

    // Render a single overflow menu for any combination of business-overflow
    // + system actions. This guarantees at most ONE "More" button per bar.
    const MenuRenderer = combinedOverflow.length > 0 ? ComponentRegistry.get('action:menu') : null;
    const overflowMenu = MenuRenderer ? (
      <MenuRenderer
        schema={{
          type: 'action:menu' as const,
          actions: combinedOverflow,
          variant: schema.variant || 'ghost',
          size: schema.size || 'sm',
        }}
      />
    ) : null;

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
        aria-label={actionsAriaLabel}
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
                actionType: action.type,
                variant: action.variant || schema.variant,
                size: action.size || schema.size,
              }}
              data={data}
            />
          );
        })}

        {combinedOverflow.length > 0 && overflowMenu}
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
    { name: 'systemActions', type: 'object', label: 'System Actions (always in overflow)' },
    {
      name: 'location',
      type: 'enum',
      label: 'Location',
      enum: [...ACTION_LOCATIONS],
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
