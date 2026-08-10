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
import { useRecordContext, useActionEngine, useMetadataItem, useCondition, toPredicateInput, useSafeFieldLabel } from '@object-ui/react';
import { useObjectTranslation, pickLocalized } from '@object-ui/i18n';
import { usePermissions } from '@object-ui/permissions';
import { Button, cn, hasDeclaredVisibilityGate } from '@object-ui/components';
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
  const { language } = useObjectTranslation();
  const i18n = useSafeFieldLabel();

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

  const location: ActionLocation = (schema.location as ActionLocation) || 'record_header';

  // useActionEngine now shares the surrounding ActionProvider's runner
  // (see packages/react/src/hooks/useActionEngine.ts) so executeAction
  // automatically picks up confirm/param/modal/result-dialog/toast handlers
  // — no need to thread a separate globalExecute.
  const { getActionsForLocation, executeAction } = useActionEngine({
    actions,
    context: {
      record: ctx?.data,
      recordId: ctx?.recordId as any,
      objectName: ctx?.objectName,
    } as any,
  });

  // Object-level permission gate — evaluated AFTER all hooks (useActionEngine
  // above must run every render) so hook order stays stable.
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
      {visibleActions.map((action, idx) => (
        <QuickActionButton
          key={action.name || `qa-${idx}`}
          action={action}
          record={ctx?.data}
          variant={(action as any).variant || schema.variant || 'default'}
          size={(action as any).size || schema.size || 'sm'}
          label={(() => {
            const raw = pickLocalized(action.label, language) || action.name || `Action ${idx + 1}`;
            return action.name ? (i18n as any).actionLabel(objectName || undefined, action.name, raw) : raw;
          })()}
          onRun={async () => {
            if (typeof action.onClick === 'function') await action.onClick();
            else if (action.name) await executeAction(action.name);
          }}
        />
      ))}
    </div>
  );
};

/**
 * A single quick-action button. Owns its own running/loading state (a spinner +
 * disable while the action executes — a visible progress state for slow / flow
 * actions) and evaluates a CEL `disabled` predicate against the record (so an
 * action can grey out conditionally, not just hide via `visible`).
 */
function QuickActionButton({
  action, record, variant, size, label, onRun,
}: {
  action: ActionDef;
  record: Record<string, unknown> | undefined;
  variant: any;
  size: any;
  label: string;
  onRun: () => Promise<void> | void;
}) {
  const [running, setRunning] = React.useState(false);
  const recordCtx = React.useMemo(() => ({ record: record || {} }), [record]);
  // `disabled` may be a boolean or a CEL predicate (disabled when TRUE). Feed
  // toPredicateInput's result to useCondition WHOLE — since #2661 a CEL-dialect
  // `{dialect, source}` envelope (the shape the server compiles authored CEL
  // into) must reach useCondition intact to route to the canonical formula
  // engine. The previous `typeof === 'string'` split dropped the envelope, so
  // a spec-authored `disabled` never disabled anything on this surface.
  const isDisabledPred = useCondition(toPredicateInput((action as any).disabled), recordCtx);
  // Is a `disabled` gate DECLARED? Read from the one definition on the action
  // face rather than re-spelled here (objectui#3842 ruling, applied to this
  // site by #3849 — the historic `visible`-flavoured name is kept on purpose;
  // the predicate is key-neutral, "declared" is `!= null && !== ''`).
  //
  // `!= null` alone was a live defect on this key: `toPredicateInput('')` is
  // `undefined` and `evaluateCondition(undefined)` is `true`, which on
  // `disabled` means DISABLE — so `disabled: ''` (an empty predicate, i.e.
  // nothing declared) greyed this quick action out permanently, with no way for
  // the author to un-grey it. There is no legacy `enabled` leg on this surface.
  const isDisabled = (hasDeclaredVisibilityGate((action as any).disabled) ? isDisabledPred : false) || running;
  return (
    <Button
      variant={variant}
      size={size}
      disabled={isDisabled}
      onClick={async () => {
        setRunning(true);
        try { await onRun(); } finally { setRunning(false); }
      }}
    >
      {running && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {label}
    </Button>
  );
}

export default RecordQuickActionsRenderer;
