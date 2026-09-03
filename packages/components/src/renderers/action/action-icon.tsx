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
import type { ActionDef } from '@object-ui/core';
import type { UIActionSchema } from '@object-ui/types';
import { useAction } from '@object-ui/react';
import { useCondition, toPredicateInput, usePredicateRecordContext } from '@object-ui/react';
import { Button } from '../../ui';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../../ui';
import { cn } from '../../lib/utils';
import { toFormControlDomProps } from '../../lib/form-control-dom-props';
import { Loader2 } from 'lucide-react';
import { resolveIcon } from './resolve-icon';
import { hasDeclaredVisibilityGate } from './visibility-gate';

/**
 * The declared props. `schema` is `UIActionSchema` (objectui#4418) for the same
 * reason as `action:button`'s: `target`, `endpoint`, `bodyExtra`, `bodyShape`,
 * `locations`, `enabled` and `size` are all modern-only keys this renderer
 * forwards, and the legacy `crud.ts` `ActionSchema` is `@deprecated` and pins
 * `type: 'action'` where this renderer's own registry `inputs` declare
 * `'script' | 'url' | 'modal' | 'flow' | 'api'`. `actionType` is the DECLARED
 * input carrying that execution type (objectui#7415), for the same reason it is
 * on `action:button`; `type` stays on the intersection as the SDUI envelope's
 * component discriminator and is not read as an action type here.
 */
export interface ActionIconProps {
  schema: UIActionSchema & { type: string; className?: string; actionType?: string };
  className?: string;
  context?: Record<string, any>;
  [key: string]: any;
}

// Index signature on the parameter annotation, not on the `forwardRef` type
// argument — mechanism note on `action:bar` (objectui#4422), pinned by
// `__tests__/forwardref-props-annotation.guard.test.ts`.
const ActionIconRenderer = forwardRef<
  HTMLButtonElement,
  {
    schema: ActionIconProps['schema'];
    className?: ActionIconProps['className'];
    context?: ActionIconProps['context'];
  }
>(
  ({ schema, className, context: localContext, ...props }: ActionIconProps, ref) => {
    const {
      'data-obj-id': dataObjId,
      'data-obj-type': dataObjType,
      style,
      // The row `action:bar` forwards to its members. Destructured for TWO
      // reasons: it is the predicate context below (objectui#4075 — this
      // renderer evaluated `visible` / `disabled` / `enabled` against NOTHING,
      // so not even the bare-field shorthand resolved, let alone the canonical
      // `record.` root), and it must not reach `...rest`, which is spread onto
      // the DOM button.
      data,
      ...rest
    } = props;

    const { execute } = useAction();
    const [loading, setLoading] = useState(false);

    // The row bound the three canonical ways — see `usePredicateRecordContext`.
    const recordData = usePredicateRecordContext(data);

    const isVisible = useCondition(toPredicateInput(schema.visible), recordData);
    // Spec `disabled` (boolean | CEL — disabled when TRUE) primary, legacy
    // non-spec `enabled` fallback (#1885 follow-through — only action-button
    // was wired; this renderer ignored a spec-authored `disabled`).
    const isDisabledPred = useCondition(toPredicateInput((schema as any).disabled), recordData);
    const isEnabled = useCondition(toPredicateInput(schema.enabled), recordData);

    const Icon = resolveIcon(schema.icon);
    const variant = schema.variant === 'primary' ? 'default' : (schema.variant || 'ghost');
    const size = 'icon';

    const handleClick = useCallback(async () => {
      if (loading) return;
      setLoading(true);
      try {
        // Annotated binding, not an inline literal — see action-button.tsx for
        // the mechanism. `localContext` is `any` (the `PropsWithoutRef` collapse
        // of an index-signature props interface), and a literal that spreads an
        // `any` is not excess-property checked, so this site absorbed unknown
        // keys while `action:group` / `action:menu` rejected them
        // (objectui#4281). `...localContext` is still merged last, so the object
        // reaching `execute` is unchanged.
        const forwarded: ActionDef = {
          // The declared input (objectui#7415). It used to be spelled `type`,
          // which collides with the SDUI envelope's component discriminator:
          // `action:bar` already had to rename it as it spreads a member
          // (`type: componentType, actionType: action.type`), and reading
          // `schema.type` alone on that path handed the runner
          // `type: 'action:icon'` — no handler, no builtin, a click that did
          // nothing with no error and no toast (objectui#6306). The collision is
          // now removed at the source: `actionType` is what the registry
          // `inputs` below declare, so it is the one spelling on every path.
          // No `|| schema.type` fallback — the objectstack#14490 ruling is a
          // rename with no alias and no transition window, and post-rename
          // `schema.type` is the component id on every authored path anyway.
          type: schema.actionType,
          name: schema.name,
          // See action-button.tsx — the param-collection dialog reads its title
          // and description off these (objectui#4192, measured on `action:menu`
          // and found here by `check:action-forward-parity`).
          label: schema.label,
          description: (schema as any).description,
          target: schema.target,
          openIn: (schema as any).openIn,
          endpoint: schema.endpoint,
          method: schema.method,
          params: schema.params as Record<string, any> | undefined,
          // See action-button.tsx — the `type: 'api'` payload key (objectstack#6837).
          bodyExtra: schema.bodyExtra,
          // See action-button.tsx — the body-WRAPPING key (objectstack#6938).
          bodyShape: schema.bodyShape,
          confirmText: schema.confirmText,
          successMessage: schema.successMessage,
          errorMessage: schema.errorMessage,
          refreshAfter: schema.refreshAfter,
          // Placement declaration — see action-button.tsx (#2210).
          locations: (schema as any).locations,
          toast: schema.toast,
          // See action-button.tsx — the one-shot reveal spec (2FA setup, fresh
          // OAuth secret). Without it the runner falls back to the success
          // toast and the value the user was meant to copy is gone.
          resultDialog: (schema as any).resultDialog,
          // See action-button.tsx — the declared post-success hop
          // (objectui#5493). The runner reads it off the forwarded def; dropped
          // here the action succeeds and the authored navigation never runs.
          // Uncast since objectui#5934 (legacy callback channel retired).
          onSuccess: schema.onSuccess,
        };

        await execute({ ...forwarded, ...localContext });
      } finally {
        setLoading(false);
      }
    }, [schema, execute, loading, localContext]);

    // Same gate, same reachability as action-button.tsx (objectui#3823): an
    // `action:icon` member of an `action:bar` gets the author's `visible`
    // spread onto its own schema, and truthiness read a declared `false` as
    // "no gate". See `hasDeclaredVisibilityGate`.
    if (hasDeclaredVisibilityGate(schema.visible) && !isVisible) return null;

    const button = (
      <Button
        ref={ref}
        type="button"
        variant={variant as any}
        size={size}
        className={cn('h-8 w-8', schema.className, className)}
        // Is a `disabled` / `enabled` gate DECLARED? The same question the
        // `visible` gate above asks, so it reads the same definition — the name
        // is historic (objectui#3492 arrived through `visible`), the predicate
        // is key-neutral: "declared" is `!= null && !== ''`. Deliberately NOT
        // renamed or aliased (objectui#3842 ruling, applied here by #3849).
        //
        // `!= null` alone was a live defect on `disabled` in a way it is not on
        // `visible`: the evaluation entry reads an empty predicate as "no
        // condition → true", which means SHOW on `visible` (harmless) but
        // DISABLE here — `disabled: ''` was a permanently greyed-out button.
        // The legacy `enabled` leg is negated, so its `''` case already landed
        // on "not disabled"; routing it through the same definition is
        // behaviour-preserving (derivation table in
        // `__tests__/action-disabled-declared-gate.test.tsx`) and leaves one
        // spelling of "declared" on both legs.
        disabled={(
          hasDeclaredVisibilityGate((schema as any).disabled)
            ? isDisabledPred
            : hasDeclaredVisibilityGate(schema.enabled)
              ? !isEnabled
              : false
        ) || loading}
        onClick={handleClick}
        aria-label={schema.label || schema.name}
        {...toFormControlDomProps(rest)}
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

ComponentRegistry.register('icon', ActionIconRenderer, {
  namespace: 'action',
  skipFallback: true,
  label: 'Action Icon',
  inputs: [
    { name: 'name', type: 'string', label: 'Action Name' },
    { name: 'label', type: 'string', label: 'Tooltip Label' },
    { name: 'icon', type: 'string', label: 'Icon' },
    {
      name: 'actionType',
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
    actionType: 'script',
    variant: 'ghost',
  },
});
