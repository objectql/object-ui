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
import { useRecordContext, useActionEngine, useMetadataItem, useCondition, toPredicateInput, useActionTextLocalizer } from '@object-ui/react';
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
  // The ONE resolver for a declared action's authored strings (objectui#4265).
  // This bar used to localize the button `label` only, while `executeAction`
  // ran the RAW def looked up out of the object's metadata — so its confirm
  // dialog rendered the authored English `confirmText` next to a translated
  // button, from the same `_actions.<name>` bundle entry.
  const localizeActionTexts = useActionTextLocalizer();

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

  const authoredActions: ActionDef[] = needsLookup
    ? (() => {
        const all: ActionDef[] = Array.isArray(objectMeta?.actions) ? objectMeta!.actions : [];
        const byName = new Map(all.map((a) => [a.name, a]));
        return namesToResolve
          .map((n) => byName.get(n))
          .filter((a): a is ActionDef => !!a);
      })()
    : (Array.isArray(rawActions) ? (rawActions as ActionDef[]) : []);

  /**
   * Localize once, before the defs reach `useActionEngine` (objectui#4265).
   *
   * `executeAction(name)` runs the def out of THIS array, and the button below
   * renders `action.label` out of the same array — so localizing here is what
   * keeps the button and the confirm dialog on one bundle entry. Resolving only
   * the display label (what this renderer used to do) left `executeAction`
   * dispatching the untranslated `confirmText` / `successMessage` straight from
   * the object's metadata.
   */
  const actions: ActionDef[] = authoredActions.map((a, idx) =>
    localizeActionTexts(objectName || undefined, a, { fallbackLabel: `Action ${idx + 1}` }),
  );
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
          // Already resolved (with the confirm/success strings that ride the
          // same dispatch) in the `actions` memo above — objectui#4265.
          label={(action.label as string) || `Action ${idx + 1}`}
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
