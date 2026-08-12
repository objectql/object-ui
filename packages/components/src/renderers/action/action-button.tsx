/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * action:button — Smart action button driven by UIActionSchema.
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
import type { ActionDef } from '@object-ui/core';
import type { UIActionSchema } from '@object-ui/types';
import { useAction } from '@object-ui/react';
import { useCondition, toPredicateInput, usePredicateRecordContext } from '@object-ui/react';
import { Button } from '../../ui';
import { cn } from '../../lib/utils';
import { Loader2 } from 'lucide-react';
import { resolveIcon } from './resolve-icon';
import { hasDeclaredVisibilityGate } from './visibility-gate';
import { hasAutoTrigger, useAutoTriggerOnce } from './auto-trigger';

/**
 * The declared props. `schema` is `UIActionSchema` (objectui#4418): every key
 * this renderer forwards below — `target`, `endpoint`, `bodyExtra`,
 * `bodyShape`, `locations`, `enabled`, `size` — is declared by the modern type
 * and by no other, and the legacy `crud.ts` `ActionSchema` it used to name is
 * `@deprecated` and requires `type: 'action'` (this renderer serves
 * `'script' | 'url' | 'modal' | 'flow' | 'api'`). `actionType` stays on the
 * intersection: it is the legacy-shaped override this renderer reads FIRST
 * (`schema.actionType || schema.type`), and it is not a `UIActionSchema` key.
 */
export interface ActionButtonProps {
  schema: UIActionSchema & { type: string; className?: string; actionType?: string };
  className?: string;
  /** Override context for this specific action */
  context?: Record<string, any>;
  [key: string]: any;
}

// `PropsWithoutRef` would collapse `ActionButtonProps` to its bare index
// signature, so the type argument carries the declared props WITHOUT it (each
// derived off `ActionButtonProps`, so the two cannot drift) and the index
// signature stays on the parameter annotation — mechanism note on `action:bar`
// (objectui#4422), pinned by
// `__tests__/forwardref-props-annotation.guard.test.ts`.
const ActionButtonRenderer = forwardRef<
  HTMLButtonElement,
  {
    schema: ActionButtonProps['schema'];
    className?: ActionButtonProps['className'];
    context?: ActionButtonProps['context'];
  }
>(
  ({ schema, className, context: localContext, ...props }: ActionButtonProps, ref) => {
    const {
      'data-obj-id': dataObjId,
      'data-obj-type': dataObjType,
      style,
      data,
      ...rest
    } = props;

    const { execute } = useAction();
    const [loading, setLoading] = useState(false);

    // Record data may be passed from SchemaRenderer (e.g. DetailView passes
    // record data), bound the three canonical ways — `record.status`, bare
    // `status`, `data.status` (objectui#4075). This used to be the row spread
    // flat, so the CANONICAL `record.` root threw `record is not defined` and
    // the fail-closed `visible` below turned that into "hidden".
    const recordData = usePredicateRecordContext(data);

    // Evaluate visibility and disabled conditions with record data context.
    // `visible` fails CLOSED on a throwing predicate (mirrors ActionEngine's
    // getActionsForLocation) — a precondition that can't be evaluated should
    // hide the action, not silently show one whose guard is broken.
    const isVisible = useCondition(toPredicateInput(schema.visible), recordData, {
      throwOnError: true,
      label: `action "${schema.name ?? schema.label ?? 'action:button'}" (visible)`,
    });
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
        //
        // Annotated rather than inferred: a spread SOURCE's own keys are not
        // excess-property checked through the spread, so an invented key in
        // either branch would be absorbed silently. Measured on objectui#4281 —
        // `const p = cond ? { actionParams } : { zzBogus }` is accepted by an
        // `ActionDef` literal that spreads it; annotating `p` rejects it here.
        const paramsPayload: ActionDef = Array.isArray(schema.params)
          ? { actionParams: schema.params as any }
          : { params: schema.params as Record<string, any> | undefined };

        // ── Why this is a named `ActionDef` binding and not an inline literal ──
        //
        // `ActionDef` is CLOSED (objectui#4046 / objectstack#4075 step 3), so an
        // invented or misspelled key at a forward site is a TS2353 — but only
        // where TypeScript actually RUNS the excess-property (freshness) check.
        // It does not run it on a literal that spreads a value of type `any`,
        // and `localContext` is exactly that: `PropsWithoutRef` collapses
        // `ActionButtonProps` (which carries an `[key: string]: any` index
        // signature) to a pure index-signature type, so every destructured prop
        // arrives as `any`. Spreading it into the payload made this site absorb
        // unknown keys in silence while `action:group` / `action:menu` — same
        // payload, no spread — rejected them (objectui#4281, measured in both
        // directions).
        //
        // Hoisting the explicit keys into this annotated binding restores the
        // check on them, independently of what the composed spreads are typed
        // as. Key ORDER is deliberately unchanged (`...paramsPayload` keeps its
        // original position and `...localContext` is still merged last), so the
        // object that reaches `execute` is identical — see
        // `__tests__/action-forward-precedence.test.tsx`.
        const forwarded: ActionDef = {
          type: schema.actionType || schema.type,
          name: schema.name,
          // Forward the human label/description so a param-collection dialog
          // can title itself as the action ("Create Environment") instead of a
          // generic "Action parameters" prompt.
          label: schema.label,
          description: (schema as any).description,
          target: schema.target,
          // Static "open in new tab" switch for url actions — forward so the
          // runner's executeUrl honors it (dropped, the toggle is silently lost).
          openIn: (schema as any).openIn,
          endpoint: schema.endpoint,
          method: schema.method,
          ...paramsPayload,
          // Static request body of a `type: 'api'` action, merged last by the
          // runner. Separate key from `params` by the objectstack#5777 ruling —
          // dropping it here left a declared action whose payload lives only in
          // `bodyExtra` POSTing nothing (objectstack#6837).
          bodyExtra: schema.bodyExtra,
          // How that body is SHAPED — `'flat'` or `{ wrap: key }`. Read
          // unconditionally by the console apiHandler and by the runner's own
          // executeAPI, so dropping it here did not fail: the action POSTed a
          // flat body while its declaration said `{ wrap: 'data' }`
          // (objectstack#6938). Sibling of `bodyExtra` above, same whitelist,
          // same failure mode.
          bodyShape: schema.bodyShape,
          confirmText: schema.confirmText,
          successMessage: schema.successMessage,
          errorMessage: schema.errorMessage,
          refreshAfter: schema.refreshAfter,
          // Forward `undoable` (and the row id field) so update actions can
          // offer an Undo affordance — without this the flag is dropped and the
          // handler never builds the undo operation.
          undoable: (schema as any).undoable,
          recordIdField: (schema as any).recordIdField,
          // Forward the placement declaration — the console runtime uses it to
          // tell record-scoped actions (also mounted on rows) from pure
          // object-level toolbar actions when no row is selected (#2210).
          locations: (schema as any).locations,
          toast: schema.toast,
          // One-shot reveal dialog for actions whose response is shown
          // exactly once (2FA setup, OAuth client_secret, regenerated
          // backup codes). Without this forward the ActionRunner falls
          // back to the success toast and the user loses the value.
          resultDialog: (schema as any).resultDialog,
        };

        await execute({ ...forwarded, ...localContext });
      } finally {
        setLoading(false);
      }
    }, [schema, execute, loading, localContext]);

    // Client-side auto-trigger (#844): a caller (e.g. a welcome-page CTA that
    // deep-links into "create") can mark an action `autoTrigger: true` to run
    // it once as soon as the button receives it — the exact same execute path
    // as a click, so param dialogs / confirms / entitlement gates all still
    // apply. The guard and the flag test live in `./auto-trigger` because this
    // is no longer the only consumer: `action:menu` runs the same contract for
    // the actions that spill past `action:bar`'s `maxVisible` (#4162), and
    // once-ness written twice is two behaviours waiting to drift.
    useAutoTriggerOnce(hasAutoTrigger(schema), handleClick);

    // A declared boolean `visible: false` is a verdict, not a missing gate —
    // truthiness classified it as "ungated" and rendered the action for
    // everyone (objectui#3823). Reachable because `action:bar` bypasses
    // `SchemaRenderer` and spreads the whole member action onto this schema, so
    // this gate is the only one on that path. See `hasDeclaredVisibilityGate`.
    if (hasDeclaredVisibilityGate(schema.visible) && !isVisible) return null;

    return (
      <Button
        ref={ref}
        type="button"
        variant={variant as any}
        size={size as any}
        className={cn(schema.className, className)}
        // Is a `disabled` / `enabled` gate DECLARED? Same question as the
        // `visible` gate above, so it reads the same definition — the name is
        // historic (objectui#3492 arrived through `visible`); the predicate is
        // key-neutral: "declared" means `!= null && !== ''`, an empty predicate
        // is nothing to evaluate and therefore no gate. Deliberately NOT
        // renamed or aliased for this call site (objectui#3842 ruling): one
        // implementation under two names is how a repo grows dialects.
        //
        // `!= null` alone was a live defect here in a way it is not on
        // `visible` (objectui#3842). The evaluation entry reads an empty
        // predicate as "no condition → true"; on `visible` that `true` means
        // SHOW, so an over-broad "declared" test cancels out, while here it
        // means DISABLE — `disabled: ''` was a permanently greyed-out button.
        //
        // The legacy `enabled` leg is negated (`!isEnabled`), so its `''` case
        // already landed on "not disabled" by double negation; routing it
        // through the same definition is behaviour-preserving for all four
        // shapes (derivation table in
        // `__tests__/action-disabled-declared-gate.test.tsx`) and keeps one
        // spelling of "declared" on both legs.
        disabled={(
          hasDeclaredVisibilityGate((schema as any).disabled)
            ? isDisabled
            : hasDeclaredVisibilityGate(schema.enabled)
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

ComponentRegistry.register('button', ActionButtonRenderer, {
  namespace: 'action',
  skipFallback: true,
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
