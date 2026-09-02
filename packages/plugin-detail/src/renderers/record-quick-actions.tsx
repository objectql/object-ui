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
import { resolveDeclaredActionIds } from '@object-ui/types';
import type { DeclaredActionsRefusal } from '@object-ui/types';

const splitDesigner = (props: Record<string, any>) => {
  const { 'data-obj-id': id, 'data-obj-type': type, style, ...rest } = props || {};
  return { designer: { 'data-obj-id': id, 'data-obj-type': type, style }, rest };
};

/** A stable empty array, so an absent `actions` / `actionNames` does not mint one per render. */
const EMPTY_DECLARED_ACTIONS: readonly unknown[] = Object.freeze([]);

/**
 * Warn-once ledger for a refused action array (objectui#7182), keyed by
 * object, key and verdict so one page cannot spam the console across
 * re-renders — the `page:header` reporter keeps the same ledger shape.
 */
const _refusedDeclaredActions = new Set<string>();

/**
 * Report an `actions` / `actionNames` array `resolveDeclaredActionIds` refused
 * — a mixed id/object array, or an element that is neither (objectui#7182,
 * maintainer ruling 2026-09-02, option C).
 *
 * `console.error`, not `warn`: a refused array is metadata the contract does
 * not accept, and this bar draws NONE of its authored actions rather than the
 * half it could. The message names the offending index so the fix is a
 * one-element edit, and the surface, so the same array refused by
 * `page:header` reads as the same rule.
 */
function reportRefusedQuickActions(
  objectName: string,
  key: 'actionNames' | 'actions',
  refusal: DeclaredActionsRefusal,
): void {
  const ledgerKey = `${objectName}::${key}::${refusal.index}::${refusal.message}`;
  if (_refusedDeclaredActions.has(ledgerKey)) return;
  _refusedDeclaredActions.add(ledgerKey);
  console.error(
    `[record:quick_actions] ${key} refused at index ${refusal.index} — ${refusal.message}. ` +
    'None of the authored actions is rendered. `actionNames` is a list of ACTION IDS resolved ' +
    "from the object's own `actions`; an inline action object is the host's runtime channel " +
    'and must not share an array with ids.',
  );
}

export interface RecordQuickActionsRendererProps {
  schema?: {
    actions?: ActionDef[];
    location?: ActionLocation;
    requiredPermissions?: string[];
    align?: 'start' | 'center' | 'end';
    size?: 'sm' | 'default' | 'lg';
    variant?: 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'link';
    /**
     * Accessible name for the toolbar. `ariaLabel` is the spelling
     * `@objectstack/spec`'s `AriaPropsSchema` accepts; `label` is that shape's
     * alias entry — refused on parse — and is kept here as a back-compat read
     * for documents written before the contract closed (objectui#4663).
     */
    aria?: { ariaLabel?: string; label?: string };
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
  const rawActions: readonly unknown[] = Array.isArray(schema.actions)
    ? schema.actions
    : Array.isArray(schema.properties?.actions)
      ? schema.properties!.actions
      : EMPTY_DECLARED_ACTIONS;
  const actionNames: readonly unknown[] = Array.isArray(schema.actionNames)
    ? schema.actionNames
    : Array.isArray(schema.properties?.actionNames)
      ? schema.properties!.actionNames
      : EMPTY_DECLARED_ACTIONS;

  const objectName = ctx?.objectName || '';

  // ONE array, ONE rule (objectui#7182, maintainer ruling 2026-09-02, option C).
  // `actionNames` is the spec-declared spelling (`RecordQuickActionsProps`:
  // action ids, resolved from the object's own `actions`); `actions` is the
  // host's runtime channel (`layout:page-header` delegation, the page
  // synthesizer). Whichever is authored, its SHAPE and its resolution are
  // `resolveDeclaredActionIds`'s call — the same function `page:header` calls —
  // so an array is all ids or all inline objects, and a mixed
  // `['convert', { … }]` is REFUSED with the offending index named, not
  // half-drawn. This bar used to switch on the WHOLE array
  // (`every(a => typeof a === 'string')`): a mixed array took the object path
  // and the bare string reached the engine as an "ActionDef" that rendered
  // nothing, while `page:header` normalised per element and drew both — one
  // authored array, two meanings.
  const declaredKey: 'actionNames' | 'actions' = actionNames.length > 0 ? 'actionNames' : 'actions';
  const declaredElements = actionNames.length > 0 ? actionNames : rawActions;
  // Registry-independent verdict first — the same function, called with no
  // registry: `kind` and `ids` are final from the shape alone, which is all
  // the hook-order question needs (`useMetadataItem` runs every render, so the
  // read is requested or skipped before the registry exists; `null` is its
  // documented no-op).
  const declaredShape = resolveDeclaredActionIds<ActionDef>(declaredElements, undefined);
  // Lookup-by-name path: resolve the ActionDef[] from the object's own
  // metadata. Keeps page schemas DRY — actions stay defined once on the object.
  const needsLookup = declaredShape.kind === 'ids' && declaredShape.ids.length > 0 && !!objectName;
  const { item: objectMeta } = useMetadataItem('object', needsLookup ? objectName : null);
  const declared = resolveDeclaredActionIds<ActionDef>(
    declaredElements,
    Array.isArray(objectMeta?.actions) ? (objectMeta!.actions as ActionDef[]) : [],
  );
  if (declared.kind === 'refused') reportRefusedQuickActions(objectName, declaredKey, declared);
  const authoredActions: ActionDef[] = declared.kind === 'refused' ? [] : declared.actions;

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
          {declared.kind === 'refused'
            ? `record:quick_actions — ${declaredKey} refused at index ${declared.index} (see console)`
            : 'record:quick_actions — no actions configured'}
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

  /**
   * The toolbar's accessible name, read under the spelling the platform ARIA
   * contract actually accepts (objectui#4663).
   *
   * This line used to read `aria.label` and nothing else — the ONE spelling
   * `@objectstack/spec`'s `AriaPropsSchema` refuses. `label` is that closed
   * shape's ALIAS ENTRY, a rename prescription pointing at `ariaLabel`, so it
   * exists to produce a better rejection message and is never accepted. The
   * result was a dead read point in both directions: a spec-valid
   * `aria: { ariaLabel: … }` was discarded, and the spelling honoured was one no
   * author can write without the contract rejecting the document.
   *
   * `SchemaRenderer`'s generic ARIA channel does not cover this: it reads the
   * FLAT `schema.ariaLabel` and injects `aria-label` as a component PROP, which
   * `splitDesigner` above drops with every other non-designer prop. The nested
   * bag is the live path here.
   *
   * `??` between the two spellings, `||` for the built-in default — both halves
   * follow how this repo already handles this key:
   *
   *   - `normalizeListViewSchema`'s aria fold (`ARIA_KEY_ALIASES`, objectui#2890)
   *     copies the legacy key onto the canonical one only when the canonical is
   *     `undefined`, so a declared `ariaLabel: ''` shadows a stale `label` there
   *     — and does here;
   *   - `ListView`'s own read point treats an empty string as no accessible name
   *     at all. `role="toolbar"` needs a name, so "no name" resolves to the
   *     built-in default here rather than to ListView's omitted attribute.
   */
  const ariaLabel = (schema.aria?.ariaLabel ?? schema.aria?.label) || 'Quick actions';

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-2',
        inlineWithHeader && '-mt-12 sm:-mt-14 mb-2 relative z-10',
        justify,
        className,
      )}
      role="toolbar"
      aria-label={ariaLabel}
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
