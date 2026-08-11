/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * DeclaredActionsBar — render + execute an object's SERVER-DECLARED actions for
 * a single record at a given location, with ZERO per-action host code.
 *
 * A bespoke page (e.g. the approvals inbox) that already has a record in hand
 * can drop this bar in to surface the actions the backend declares on that
 * object (`objectDef.actions[]`) — filtered to a `location`
 * (`record_section`, `record_header`, …) and each action's `visible` CEL —
 * and have them execute through the *same* console action runtime ObjectView /
 * RecordDetailView use: confirm dialogs, param-collection dialogs, result
 * dialogs, the authenticated api/flow/server handlers, and refresh-after.
 *
 * It is fully self-contained: it fetches the object definition through the
 * metadata provider (unless `actions` is passed explicitly), resolves the
 * `dataSource` from the adapter, and mounts its own `ActionProvider` +
 * runtime dialogs. Each button dispatches the declared action with the record
 * stashed under `params._rowRecord`, exactly the shape ObjectGrid row actions
 * and RelatedRecordActionsBridge use — so a `type:'api'` action whose target is
 * `/api/v1/approvals/requests/{id}/approve` resolves `{id}` from the record and
 * POSTs with any collected params (comment, to, …).
 *
 * Degrades gracefully: no matching declared actions → renders nothing.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { Button, Separator, cn, hasDeclaredVisibilityGate } from '@object-ui/components';
import {
  ActionProvider,
  useAction,
  useCondition,
  toPredicateInput,
  usePredicateRecordContext,
  useActionTextLocalizer,
} from '@object-ui/react';
import type { ActionDef } from '@object-ui/core';
import { useObjectTranslation } from '@object-ui/i18n';
import { Loader2 } from 'lucide-react';
import { useConsoleActionRuntime } from '../hooks/useConsoleActionRuntime';
import { useAdapter } from '../providers/AdapterProvider';
// Straight from `@object-ui/react`, NOT through `../providers/MetadataProvider`
// (which merely re-exports it). The provider module pulls in the console
// metadata client factory, and that module builds its shared authenticated
// fetch AT IMPORT TIME — so importing the hook by the convenient path drags an
// eager side effect into the module graph of every host that renders this bar.
// It surfaced when the record page started mounting the bar (objectui#3055):
// two RecordDetailView suites died at import with `Cannot access
// 'authFetchSpy' before initialization`, the side effect running inside the
// hoisted `@object-ui/auth` mock factory before the spy existed.
import { useMetadataItem } from '@object-ui/react';
import { decisionOutputDefs, decisionOutputParams } from '../utils/decisionOutputParams';
import { getIcon } from '../utils/getIcon';

export interface DeclaredActionsBarProps {
  /** Object whose declared actions to render (e.g. `sys_approval_request`). */
  objectName: string;
  /**
   * The record the actions run against. Stashed under `params._rowRecord`, so
   * `{token}` URL interpolation and `defaultFromRow` params resolve from it —
   * on the approvals inbox this is the `sys_approval_request` row itself, so
   * `{id}` resolves to the request id.
   */
  record: any;
  /** Action location to filter by (e.g. `record_section`). */
  location: string;
  /** Called after a successful action so the host can refresh. */
  onDone?: () => void;
  /**
   * Declared actions to render. When omitted, they are fetched from the
   * object's metadata definition. Passing them explicitly avoids the metadata
   * round-trip (and lets a host that already holds the object def reuse it).
   */
  actions?: ActionDef[];
  /**
   * Action names to drop from the rendered set. Use when the host renders a few
   * of the object's declared actions itself (e.g. the approvals inbox keeps
   * approve/reject in a richer composer with an attachment field) but wants the
   * bar to cover the rest — so the two never render duplicate buttons.
   */
  exclude?: string[];
  /** Extra classes for the toolbar wrapper. */
  className?: string;
  /**
   * Optional section label. When set, a divider + label is rendered above the
   * buttons — but ONLY when there are actions to show (the whole component
   * returns null when empty), so the host never gets an orphan divider.
   */
  label?: string;
}

/**
 * One declared-action button. Extracted so the `visible` CEL predicate can be
 * evaluated with a hook (rules-of-hooks) and so the dispatch can carry the
 * record. Mirrors `action:button` (fail-closed `visible`) but injects the
 * record under `params._rowRecord` — which `action:button` does NOT do, and
 * which the api handler needs to resolve `{id}` and inject the record id.
 */
const DeclaredActionButton: React.FC<{
  action: ActionDef;
  objectName: string;
  record: any;
}> = ({ action, objectName, record }) => {
  const { execute } = useAction();
  const [loading, setLoading] = useState(false);
  // Localize the SERVER-DECLARED strings through the `_actions.<name>.*`
  // translation convention (objectui#2762 P0-3) — the metadata's literal
  // label/confirmText/successMessage are the fallback, exactly like
  // ObjectView/RecordDetailView do for their toolbars. Since objectui#4265 the
  // three keys go through ONE call, so no surface can localize the button and
  // leave the confirm dialog behind. The param dialog's labels localize
  // downstream in useConsoleActionRuntime.
  const localizeActionTexts = useActionTextLocalizer();
  // Chrome strings the bar itself authors — as opposed to the declared metadata
  // above — go through the normal locale bundle. The decision-output params are
  // synthesized here from `decision_output_defs`, so their key path is dynamic
  // and no `_actions.<action>.params.*` entry can ever exist for them; the
  // literal IS what renders, which is how English help text survived in a zh-CN
  // workspace (objectui#2762 P0-3).
  const { t } = useObjectTranslation();

  const recordData = record != null && typeof record === 'object' ? (record as Record<string, any>) : {};
  /**
   * The predicate scope, with the record bound the THREE ways the platform's
   * row surfaces bind it (objectui#3055) — through the ONE named helper that
   * states the rule, not a local restatement of it (objectui#4080).
   *
   * The rationale lives with the definition (`usePredicateRecordContext` in
   * `@object-ui/react`): why the `record.` root is canonical, why `record` /
   * `data` are written after the spread, and why a surface with no row of its
   * own binds NOTHING rather than an empty row. The bar carried an inline copy
   * of that expression from objectui#4077 until the four generic action
   * renderers gave the rule its name in objectui#4079; two implementations of
   * one binding rule is the shape objectui#3367 / #3842 rule against, and this
   * family has already paid for it once at the `toPredicateInput` level
   * (objectui#3314 — two normalizations drifted and the same `visible:`
   * predicate reached different verdicts).
   *
   * What is specific to this bar is the cost of getting it wrong: EVERY
   * declared action on `sys_approval_request` gates on `record.viewer.*`
   * (framework#3310 / #3424), so under a root-only bag the whole
   * server-declared decision set was invisible on every surface this bar
   * renders — `record.viewer.can_act` does not read as false there, it throws
   * `record is not defined` and `throwOnError` turns that into "hidden".
   */
  const predicateRecord = usePredicateRecordContext(record);
  // `visible` fails CLOSED on a throwing predicate — mirrors action:button and
  // ActionEngine.getActionsForLocation: a guard that can't be evaluated hides
  // the action rather than exposing one whose precondition is broken.
  const isVisible = useCondition(toPredicateInput(action.visible), predicateRecord, {
    throwOnError: true,
    label: `declared action "${action.name ?? action.label ?? 'action'}" (visible)`,
  });
  // Spec `disabled` — the same three arms as `visible` (`boolean | CEL string |
  // { dialect, source }`, disabled when TRUE), evaluated against the same record
  // context. #1885 wired it in action-button only; this bar ignored it, so a
  // spec-authored `disabled` guard on a declared action did nothing here. (No
  // legacy `enabled` fallback: server-declared actions are spec-shaped and never
  // carried the non-spec key.)
  //
  // Read straight off the typed def since objectstack#4075 step 3: both keys are
  // now derived from the spec's unified shape, so the `(action as any)` casts
  // these two lines carried — which existed only because `ActionDef.disabled`
  // could not describe the envelope arm — have nothing left to reach around.
  const isDisabledPred = useCondition(toPredicateInput(action.disabled), predicateRecord);

  const handleClick = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    try {
      // Same dispatch shape as ObjectGrid.onActionDef / RelatedRecordActionsBridge:
      // forward the full def (type/target/recordIdParam/bodyShape/refreshAfter/…),
      // surface a `params` ARRAY as `actionParams` (the runner's param-dialog
      // input), and reserve `params` for the `_rowRecord` stash the api handler
      // reads for `{id}` interpolation + record-id injection.
      const { params: rawParams, ...rest } = action as ActionDef & { params?: unknown };
      // #3447: an approval decision may carry author-declared structured
      // outputs. The key set is PER-REQUEST (each approval node declares its
      // own `decisionOutputs`, surfaced on the row as `decision_output_defs`),
      // so it cannot be a static action param — synthesize one param per key
      // for the decide actions. Params are named `outputs.<key>`; the api
      // handler folds them into the nested `outputs` body the decide route
      // expects. A free-text output accepts comma-separated values (the
      // service accepts CSV for multi-id outputs).
      // Which decision this action records — `required` outputs are enforced
      // on approve only (server and dialog agree), so the reject dialog offers
      // the same fields without blocking on them.
      const decision = /\/approve$/.test(String((action as any).target ?? ''))
        ? 'approve' as const
        : /\/reject$/.test(String((action as any).target ?? ''))
          ? 'reject' as const
          : undefined;
      // Widget mapping (typed picker vs free text) lives in the shared helper,
      // so the record header's Approve/Reject renders the same controls
      // (objectui#2955).
      const outputParams = decision
        ? decisionOutputParams(decisionOutputDefs(recordData), t, { decision })
        : [];
      const dispatch: any = {
        // Localized copies ride the dispatch: the runner reads `label` for the
        // param-dialog title, `confirmText` for the confirm prompt and
        // `successMessage` for the toast. A nameless action has no translation
        // key, so it keeps its literal strings — that rule lives in the
        // localizer now rather than being re-spelled per surface.
        ...localizeActionTexts(objectName, rest as Record<string, any>),
        objectName,
        params: { _rowRecord: record },
      };
      const staticParams = Array.isArray(rawParams) ? rawParams : [];
      if (staticParams.length > 0 || outputParams.length > 0) {
        dispatch.actionParams = [...staticParams, ...outputParams];
      }
      await execute(dispatch as ActionDef);
    } finally {
      setLoading(false);
    }
  }, [action, execute, loading, objectName, record, localizeActionTexts, t]);

  // Does the action DECLARE a `visible` gate? `hasDeclaredVisibilityGate`
  // (`!= null && !== ''`) is the one definition on the question, imported rather
  // than re-spelled. This gate used to ask truthiness, which classified
  // `visible: false` — the most explicit "never show this" an author can write —
  // as "no gate declared", skipped the verdict, and rendered the action for
  // everyone (objectui#3835, the fifth member of the objectui#3492 family).
  //
  // The stakes here are the highest of the family: the actions are
  // SERVER-declared (`objectDef.actions[]`), so "the spec's `visible` has no
  // boolean member, `objectstack build` cannot emit one" does not apply, and this
  // bar is mounted as plain JSX by its hosts — `packages/react`'s
  // `SchemaRenderer`, which hides a `visible`-carrying node before its component
  // mounts, is not on this path. This is the only gate on it, in front of the
  // approvals inbox's Approve / Reject buttons.
  //
  // The verdict stays with the evaluation entry above: `toPredicateInput` passes
  // a boolean through untouched and `useCondition` short-circuits it instead of
  // calling the expression engine, so a declared `false` is `false`.
  if (hasDeclaredVisibilityGate(action.visible) && !isVisible) return null;

  const iconName = typeof (action as any).icon === 'string' ? (action as any).icon as string : undefined;
  // Map the spec's action `variant` enum (primary|secondary|danger|ghost|link)
  // onto the Button's variants. `primary` → the filled default, `danger` →
  // `destructive` (the two names the enum and the Button component spell
  // differently); the rest pass through, and an undeclared variant stays
  // `outline` so a plain declared action still reads as a secondary button.
  const declaredVariant = (action as any).variant;
  const variant = declaredVariant === 'primary'
    ? 'default'
    : declaredVariant === 'danger'
      ? 'destructive'
      : (declaredVariant || 'outline');
  // Same resolver as the dispatch above, so the button text and the confirm
  // dialog body can never come from different bundle reads (objectui#4265).
  const label = (localizeActionTexts(objectName, action as Record<string, any>).label as string) || '';

  return (
    <Button
      type="button"
      size="sm"
      variant={variant as any}
      // Is a `disabled` gate DECLARED? The same question the `visible` gate
      // above asks, so it reads the same definition rather than re-spelling it.
      // The name is historic — objectui#3492 arrived through `visible` — and the
      // predicate is key-neutral: "declared" is `!= null && !== ''`, because an
      // empty predicate is nothing to evaluate. Kept under that name
      // deliberately (objectui#3842 ruling): one implementation behind two names
      // is a dialect, not a clarification.
      //
      // `!= null` alone was a real defect here, and NOT for the reason it was on
      // `visible`: the evaluation entry reads an empty predicate as "no
      // condition → true", which on `visible` means SHOW (so an over-broad
      // "declared" test cancels out and `''` renders either way), but here means
      // DISABLE. A `disabled: ''` on a server-declared approval action rendered
      // a permanently greyed-out Approve / Reject — the mirror image of
      // objectui#3835 on the same surface, and equally impossible to tell from
      // deliberate metadata by looking at it.
      disabled={(hasDeclaredVisibilityGate(action.disabled) ? isDisabledPred : false) || loading}
      onClick={handleClick}
      data-testid={`declared-action-${action.name}`}
    >
      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {/* `getIcon` returns a (memoised) component — instantiate it via
          createElement so it is not a component "created during render" in JSX
          position (react-hooks/static-components), mirroring ObjectDataPage. */}
      {!loading && iconName
        ? React.createElement(getIcon(iconName), { className: cn('h-4 w-4', label && 'mr-2') })
        : null}
      {label}
    </Button>
  );
};

export function DeclaredActionsBar({
  objectName,
  record,
  location,
  onDone,
  actions: actionsProp,
  exclude,
  className,
  label,
}: DeclaredActionsBarProps) {
  const dataSource = useAdapter();
  const { t } = useObjectTranslation();
  // Fetch the object def (and its declared actions) unless the host passed
  // them in. `useMetadataItem` no-ops when `name` is undefined.
  const { item: objectDef } = useMetadataItem('object', actionsProp ? undefined : objectName);

  const allActions: ActionDef[] = useMemo(
    () => (actionsProp ?? (objectDef as any)?.actions ?? []) as ActionDef[],
    [actionsProp, objectDef],
  );

  const located = useMemo(
    () => {
      const drop = exclude && exclude.length ? new Set(exclude) : null;
      return allActions.filter(
        (a: any) =>
          Array.isArray(a?.locations) &&
          a.locations.includes(location) &&
          !(drop && drop.has(a?.name)),
      );
    },
    [allActions, location, exclude],
  );

  // Mount the shared console action runtime — confirm/param/result dialogs, the
  // authenticated api/flow/server handlers, SPA nav, paused-flow runner. Its
  // `onRefresh` fires on any refresh-requesting success (the default), which is
  // exactly the host's `onDone`. The object def is threaded through `objects`
  // so field-backed params resolve their labels/defaults.
  const runtime = useConsoleActionRuntime({
    dataSource,
    objects: objectDef ? [objectDef] : [],
    objectName,
    onRefresh: onDone,
  });

  // Degrade gracefully — nothing declared at this location renders nothing (no
  // toolbar chrome, no provider churn).
  if (located.length === 0) return null;

  return (
    <ActionProvider {...runtime.actionProviderProps}>
      <div className={cn('space-y-2', className)}>
        {label && (
          <>
            <Separator />
            <div className="text-xs font-medium text-muted-foreground">{label}</div>
          </>
        )}
        <div role="toolbar" aria-label={label || t('common.actions')} className="flex flex-row flex-wrap items-center gap-2">
          {located.map((action) => (
            <DeclaredActionButton
              key={action.name}
              action={action}
              objectName={objectName}
              record={record}
            />
          ))}
        </div>
      </div>
      {runtime.dialogs}
    </ActionProvider>
  );
}

export default DeclaredActionsBar;
