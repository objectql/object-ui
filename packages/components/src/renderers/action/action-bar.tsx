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
 * enabling server-driven action rendering at every location the spec declares:
 * list_toolbar, list_item, record_header, record_more, record_related and
 * record_section. (`global_nav` used to close that list; it was retired from
 * `ACTION_LOCATIONS` in @objectstack/spec 17.0.0-rc.6 — objectstack#6888 — as a
 * location no running-app surface ever rendered. The enum this component
 * publishes is `[...ACTION_LOCATIONS]`, so it followed the retirement on its
 * own; only this prose had to be aligned.)
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
import { ACTION_LOCATIONS, actionRendersAt } from '@object-ui/types';
import { useCondition, toPredicateInput, useCapabilityGate } from '@object-ui/react';
import { useObjectTranslation } from '@object-ui/i18n';
import { cn } from '../../lib/utils';
import { useIsMobile } from '../../hooks/use-mobile';

function useActionsLabel(): string {
  // useObjectTranslation is provider-safe (never throws); no try/catch, which
  // would wrap the hook call and violate rules-of-hooks. The 'Actions' fallback
  // still applies when the key is missing/untranslated.
  const { t } = useObjectTranslation();
  const v = t('common.actions');
  return !v || v === 'common.actions' ? 'Actions' : v;
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
    const isVisible = useCondition(toPredicateInput(schema.visible), undefined, {
      throwOnError: true,
      label: `action:bar${schema.location ? ` (${schema.location})` : ''} (visible)`,
    });
    const isMobile = useIsMobile();
    // [ADR-0066 D4 / framework#3923] Shared capability gate — see below.
    const mayInvoke = useCapabilityGate();

    // Filter business actions by location and deduplicate by name
    const filteredActions = useMemo(() => {
      const actions = schema.actions || [];
      // [ADR-0066 D4 / framework#3923] Capability gate — this bar filters its
      // own set instead of going through `ActionEngine.getActionsForLocation`,
      // so without this a `list_toolbar` action declaring a capability nobody
      // holds rendered as a live button. Same rule as the engine; unknown
      // capabilities fail OPEN (see `useCapabilityGate`).
      const permitted = actions.filter(a => mayInvoke((a as any)?.requiredPermissions));
      // Placement is `actionRendersAt`'s call, not ours (objectui#3142): an
      // action renders here only if it DECLARES this location. This bar used
      // to show a locationless action at every location, which is how an
      // aggregate-only bulk action — one with no single-record placement by
      // construction — ended up as a list-toolbar button that could only fail.
      // `schema.location` unset still means "no location filtering".
      const located = permitted.filter(a => actionRendersAt(a, schema.location));
      // Deduplicate by action name — keep first occurrence
      const seen = new Set<string>();
      const deduped = located.filter(a => {
        if (!a.name) return true;
        if (seen.has(a.name)) return false;
        seen.add(a.name);
        return true;
      });
      // Order the actions before the inline/overflow split so the first one
      // lands in the primary-button slot. The rule (objectui#2339) is:
      //   1. `order` ascending (unset = 0; lower = more prominent)
      //   2. `variant === 'primary'` preferred as a tie-break within equal order
      //   3. original registration order (stable) for the remaining ties
      // The sort is stable and every key defaults to a no-op, so a toolbar where
      // nobody sets `order` and nobody is `primary` keeps its exact registration
      // order. This is what lets an injected Approve/Reject with a negative
      // `order` float into the primary slot instead of the "More" overflow menu
      // (#2670), lets authors declaratively promote an action via `Action.order`,
      // and — when several unordered actions tie at the default `order` 0 — lets
      // the `primary`-variant action claim the primary button without the author
      // having to also assign an `order`.
      const needsOrdering = deduped.some(
        a => a.order !== undefined || a.variant === 'primary',
      );
      if (needsOrdering) {
        return [...deduped].sort((a, b) => {
          const byOrder = (a.order ?? 0) - (b.order ?? 0);
          if (byOrder !== 0) return byOrder;
          // Tie-break: a `primary` action outranks a non-primary sibling.
          const ap = a.variant === 'primary' ? 0 : 1;
          const bp = b.variant === 'primary' ? 0 : 1;
          return ap - bp; // equal → stable sort preserves registration order
        });
      }
      return deduped;
    }, [schema.actions, schema.location, mayInvoke]);

    // System actions: always go into the overflow menu, deduped by name,
    // never filtered by location (they're chrome, not business logic).
    const systemActions = useMemo(() => {
      const actions = schema.systemActions || [];
      const seen = new Set<string>();
      // Chrome or not, a declared capability gates it (ADR-0066 D4) — a host
      // that puts a gated action in this slot means the same thing by it.
      return actions.filter(a => {
        if (!mayInvoke((a as any)?.requiredPermissions)) return false;
        if (!a.name) return true;
        if (seen.has(a.name)) return false;
        seen.add(a.name);
        return true;
      });
    }, [schema.systemActions, mayInvoke]);

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
      // eslint-disable-next-line react-hooks/static-components -- ComponentRegistry.get returns a registered renderer (stable reference), not a component created during render
      <MenuRenderer
        schema={{
          type: 'action:menu' as const,
          actions: combinedOverflow,
          variant: schema.variant || 'ghost',
          size: schema.size || 'sm',
        }}
        // The row, same as the inline members below. Without it an action's
        // `visible` / `disabled` predicate answered a different question purely
        // because the action had spilled past `maxVisible` — and on mobile
        // `maxVisible` defaults to 1, so which actions lose their row is a
        // function of the viewport (objectui#4075).
        data={data}
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

ComponentRegistry.register('bar', ActionBarRenderer, {
  namespace: 'action',
  skipFallback: true,
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
