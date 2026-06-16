/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * `record:quick_actions` — Salesforce Lightning-style quick action bar.
 * Consumes the spec's `ActionDef[]` (see `packages/spec/src/ui/action.zod.ts`)
 * via `useActionEngine`, which handles location filtering, shortcut binding,
 * bulk mode, condition evaluation, and the execution pipeline (api / navigate
 * / onClick / toast / reload / redirect, etc.).
 *
 * Default location is `record_header` — drop this component into a page:header
 * region (or page:tabs/toolbar) to surface the per-record action set.
 */

import React from 'react';
import { useRecordContext, useActionEngine, useMetadataItem } from '@object-ui/react';
import { usePermissions } from '@object-ui/permissions';
import { Button, cn } from '@object-ui/components';
import { Loader2 } from 'lucide-react';
import type { ActionDef, ActionLocation } from '@object-ui/core';

const splitDesigner = (props: Record<string, any>) => {
  const { 'data-obj-id': id, 'data-obj-type': type, style, ...rest } = props || {};
  return { designer: { 'data-obj-id': id, 'data-obj-type': type, style }, rest };
};

export interface RecordQuickActionsRendererProps {
  schema?: {
    actions?: ActionDef[];
    location?: ActionLocation;
    requiredPermissions?: string[];
    align?: 'start' | 'center' | 'end';
    size?: 'sm' | 'default' | 'lg';
    variant?: 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'link';
    aria?: { label?: string };
    properties?: Record<string, any>;
    [k: string]: any;
  };
  className?: string;
  [k: string]: any;
}

export const RecordQuickActionsRenderer: React.FC<RecordQuickActionsRendererProps> = ({
  schema = {} as any,
  className,
  ...props
}) => {
  const ctx = useRecordContext();
  const { designer } = splitDesigner(props);
  const perms = usePermissions();

  // Spec bridge inlines `properties.*` onto the node but also preserves the
  // raw bag. Read from both for compatibility.
  const rawActions: unknown = Array.isArray(schema.actions)
    ? schema.actions
    : Array.isArray(schema.properties?.actions)
      ? schema.properties!.actions
      : [];
  const actionNames: string[] = Array.isArray(schema.actionNames)
    ? schema.actionNames
    : Array.isArray(schema.properties?.actionNames)
      ? (schema.properties!.actionNames as string[])
      : [];

  const objectName = ctx?.objectName || '';

  // Lookup-by-name path: when the page schema passes `actionNames: ['...']`
  // (or `actions: ['...']` as strings), resolve the ActionDef[] from the
  // object's own metadata. Keeps page schemas DRY — actions stay defined
  // once on the object.
  const namesToResolve: string[] = actionNames.length > 0
    ? actionNames
    : (Array.isArray(rawActions) && rawActions.every((a) => typeof a === 'string')
        ? (rawActions as string[])
        : []);
  const needsLookup = namesToResolve.length > 0 && !!objectName;
  const { item: objectMeta } = useMetadataItem('object', needsLookup ? objectName : null);

  const actions: ActionDef[] = needsLookup
    ? (() => {
        const all: ActionDef[] = Array.isArray(objectMeta?.actions) ? objectMeta!.actions : [];
        const byName = new Map(all.map((a) => [a.name, a]));
        return namesToResolve
          .map((n) => byName.get(n))
          .filter((a): a is ActionDef => !!a);
      })()
    : (Array.isArray(rawActions) ? (rawActions as ActionDef[]) : []);
  const required: string[] = Array.isArray(schema.requiredPermissions)
    ? schema.requiredPermissions
    : [];
  if (required.length > 0 && objectName) {
    const ok = required.every((p) => perms.can(objectName, p as any));
    if (!ok) {
      return (
        <div className={className} {...designer} role="status" aria-live="polite">
          <p className="text-sm text-muted-foreground italic">
            Insufficient permissions to view quick actions.
          </p>
        </div>
      );
    }
  }

  const location: ActionLocation = (schema.location as ActionLocation) || 'record_header';

  // useActionEngine now shares the surrounding ActionProvider's runner
  // (see packages/react/src/hooks/useActionEngine.ts) so executeAction
  // automatically picks up confirm/param/modal/result-dialog/toast handlers
  // — no need to thread a separate globalExecute.
  // Tracks the action currently executing so its button shows a spinner and
  // disables — a visible progress state for record-header actions (e.g. a
  // `flow` action opening its wizard, or a slow server action).
  const [runningName, setRunningName] = React.useState<string | null>(null);

  const { getActionsForLocation, executeAction } = useActionEngine({
    actions,
    context: {
      record: ctx?.data,
      recordId: ctx?.recordId as any,
      objectName: ctx?.objectName,
    } as any,
  });

  const visibleActions = actions.length > 0 ? getActionsForLocation(location) : [];

  if (visibleActions.length === 0) {
    return (
      <div className={className} {...designer}>
        <div className="text-xs text-muted-foreground italic px-3 py-2 border border-dashed rounded">
          record:quick_actions — no actions configured
        </div>
      </div>
    );
  }

  const align = schema.align || 'end';
  const justify =
    align === 'start' ? 'justify-start' : align === 'center' ? 'justify-center' : 'justify-end';
  // When sitting in the record_header region right below the page:header
  // (the canonical Salesforce Lightning placement), pull the toolbar up so
  // it visually pairs with the title instead of orphaning on its own row.
  // Disabled when rendered inline inside page:header's own action slot
  // (the `inline` flag is set by PageHeader's first-class `actions` prop).
  const inlineWithHeader = location === 'record_header' && !schema.inline;

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-2',
        inlineWithHeader && '-mt-12 sm:-mt-14 mb-2 relative z-10',
        justify,
        className,
      )}
      role="toolbar"
      aria-label={schema.aria?.label || 'Quick actions'}
      {...designer}
    >
      {visibleActions.map((action, idx) => {
        const label = action.label || action.name || `Action ${idx + 1}`;
        const variant = (action as any).variant || schema.variant || 'default';
        const size = (action as any).size || schema.size || 'sm';
        const disabled =
          typeof action.disabled === 'boolean' ? action.disabled : undefined;
        const isRunning = runningName === (action.name || `qa-${idx}`);
        return (
          <Button
            key={action.name || `qa-${idx}`}
            variant={variant}
            size={size}
            disabled={disabled || isRunning}
            onClick={async () => {
              const key = action.name || `qa-${idx}`;
              setRunningName(key);
              try {
                if (typeof action.onClick === 'function') {
                  await action.onClick();
                } else if (action.name) {
                  await executeAction(action.name);
                }
              } finally {
                setRunningName((c) => (c === key ? null : c));
              }
            }}
          >
            {isRunning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {label}
          </Button>
        );
      })}
    </div>
  );
};

export default RecordQuickActionsRenderer;
