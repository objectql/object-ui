/**
 * EnvironmentListToolbar — the state-aware replacement for the generic
 * `list_toolbar` action bar on the `sys_environment` list.
 *
 * The cloud serves ONE `create_environment` action; born-with-env makes its
 * meaning depend on org state (which the action metadata can't express). This
 * component reads the resolved entitlement state and renders the right
 * affordance:
 *   • no production env          → "Set up your production environment" (primary);
 *                                  the create POST provisions the org's one
 *                                  production env — the historical-data path that
 *                                  must never error.
 *   • has prod + dev allowed     → "Add development environment" (the create POST
 *                                  makes a dev env).
 *   • has prod + dev NOT allowed → "Add environment" that opens an UPGRADE prompt
 *                                  instead of POST-ing into a 403.
 *   • still resolving            → a SKELETON where the create button will land —
 *                                  no label at all (see below).
 *   • settled with no signal     → the action's metadata label (neutral), with the
 *                                  apiHandler entitlement dialog as the safety net.
 *
 * Create flows reuse the standard `action:bar` runner (name modal → apiHandler),
 * so only the label/variant changes — no duplicate POST logic here.
 *
 * ## Why a skeleton while resolving (cloud#1049 → objectui#3482)
 *
 * Rendering the metadata label while entitlements were in flight made the button
 * visibly change its wording mid-load: the cloud action metadata's "create
 * environment" label, replaced by `environment.setUpProduction` the moment
 * `/cloud/environment-entitlements` answered. Locale-independent by mechanism,
 * though it was reported against the Chinese console, where the two texts are
 * owned by different packages and the swap read as an inconsistency rather than
 * a load. The maintainer's ruling on cloud#1049 was option A — present nothing
 * rather than a label we are about to overwrite. Same shape as the adjacent
 * `cloud:onboarding-next` welcome CTA (`console/home/CloudOnboardingNext.tsx`):
 * loading → neutral skeleton sized like the button, unknown/error → degrade to a
 * working button. Option B (a neutral label for every state) was rejected: it is
 * semantically wrong for an org that already owns its production environment.
 *
 * ## Who owns this button's text (the "two sources" question)
 *
 * There is no longer one string with two owners — there are two DIFFERENT strings
 * for two different states, and each has exactly one owner:
 *
 *   • Every RESOLVED state → THIS package. `environment.setUpProduction` /
 *     `environment.addDevelopment` / `environment.addEnvironment` in
 *     `packages/i18n/src/locales/*.ts` are the sole source of truth. The cloud
 *     action metadata's `_actions.create_environment.label` translation CANNOT
 *     reach the button here — `decideEnvironmentCta()` is total over `ready`
 *     state, so a resolved state always overrides the label.
 *   • Still resolving → nothing (skeleton).
 *   • Settled with NO usable signal (`ready: false`, `source: 'unknown'` — the
 *     summary endpoint was unusable AND the row-derivation threw) → the metadata
 *     label, deliberately. It is the one state where "which create is this?" is
 *     genuinely unknown, so the producer's neutral wording is the only honest
 *     text. This is the metadata label's ONLY surviving path on this button; the
 *     cloud-side bundle entry therefore still has a job and must not be deleted
 *     (reported back on cloud#1049 for the cloud seat).
 */

import { useEffect, useRef, useState } from 'react';
import { SchemaRenderer, useCapabilityGate } from '@object-ui/react';
import { actionRendersAt } from '@object-ui/types';
import { Button, Skeleton } from '@object-ui/components';
import { Plus } from 'lucide-react';
import { useObjectTranslation } from '@object-ui/i18n';
import {
  decideEnvironmentCta,
  upgradeDialogSpec,
  type EntitlementDialogSpec,
  type EnvironmentEntitlementsState,
} from './entitlements';

const CREATE_ACTION = 'create_environment';

/**
 * Deep-link support (#844): `?runAction=create_environment` on the
 * environments route auto-opens the create dialog once entitlements have
 * resolved — the welcome page's "Create your environment" CTA uses it so the
 * user doesn't land on the list and have to find the create button again.
 * The param is consumed exactly once (stripped from the URL on consumption)
 * so refresh / back don't re-open the dialog.
 *
 * ## Arming is destructive — only arm when there is something to trigger (#4123)
 *
 * Consumption is modelled as "strip the param", so arming SPENDS a one-shot
 * user intent. Arm it when nothing can act on it and the intent is not merely
 * lost, it is unrecoverable: the URL no longer carries it, so a reload cannot
 * retry. That is why the caller passes a non-null `ctaKind` only once the
 * create action is actually on the bar — see `hasCreateAction` below. When it
 * is not, the honest degradation is to leave the URL alone: the next mount
 * that CAN act on the deep link still does (a reload, or the action arriving
 * with fresh metadata).
 */
function useAutoRunCreate(ctaKind: string | null): boolean {
  // Deliberately router-free (window.location + history.replaceState): the
  // toolbar also renders in tests/hosts without a Router, and the param is a
  // one-shot signal, not navigation state.
  const [requested] = useState<boolean>(() => {
    try {
      return new URLSearchParams(window.location.search).get('runAction') === CREATE_ACTION;
    } catch {
      return false;
    }
  });
  const consumed = useRef(false);
  // Only meaningful once the entitlement state has resolved: `upgrade_...`
  // routes to the upgrade dialog instead, and while loading we must not
  // trigger an action whose meaning (prod vs dev create) isn't known yet.
  const shouldRun = requested && !consumed.current && ctaKind != null;
  useEffect(() => {
    if (!shouldRun) return;
    consumed.current = true;
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('runAction');
      window.history.replaceState(window.history.state, '', url);
    } catch {
      /* URL cleanup is cosmetic — never fail the trigger over it */
    }
  }, [shouldRun]);
  return shouldRun;
}

/** Non-create toolbar actions, rendered through the normal bar in every state. */
function otherActions(toolbarActions: any[]): any[] {
  return toolbarActions.filter((a: any) => a?.name !== CREATE_ACTION);
}

function OtherActionsBar({ actions }: { actions: any[] }) {
  if (actions.length === 0) return null;
  return (
    <SchemaRenderer
      schema={{ type: 'action:bar', location: 'list_toolbar', actions, size: 'sm', variant: 'outline' }}
    />
  );
}

interface Props {
  /** Toolbar actions already localized by the caller (ObjectView). */
  actions: any[];
  /**
   * Resolved entitlement state, or `null` while the resolution is still in
   * flight. The distinction matters: `useEnvironmentEntitlements` holds `null`
   * only until its async resolution settles, and reports a settled-but-useless
   * result as `{ ready: false, source: 'unknown' }` — so `null` here means
   * "wait" (skeleton) and never "we gave up" (which must keep a usable button).
   */
  entitlements: EnvironmentEntitlementsState | null;
  /** Open the shared entitlement dialog (proactive upgrade prompt). */
  onUpgrade: (spec: EntitlementDialogSpec) => void;
}

export function EnvironmentListToolbar({ actions, entitlements, onUpgrade }: Props) {
  const { t } = useObjectTranslation();
  // [ADR-0066 D4] The same capability gate `action:bar` applies to the actions
  // it RENDERS. This toolbar is one more surface that filters its own action
  // list instead of routing through `ActionEngine.getActionsForLocation`, which
  // is precisely the case `useCapabilityGate` exists to keep from drifting.
  const mayInvoke = useCapabilityGate();
  // ONE list, built from both predicates the bar applies downstream
  // (`actionRendersAt` + the capability gate), so what this component decides
  // and what the bar renders cannot disagree by construction (#4123). The bar
  // re-applies both to the list it receives — idempotent on an already-filtered
  // list. Before this, placement was filtered here and capability only there,
  // so a create action the caller may not invoke was counted here and dropped
  // there.
  const toolbarActions = (actions || []).filter(
    (a: any) => actionRendersAt(a, 'list_toolbar') && mayInvoke(a?.requiredPermissions),
  );
  const hasCreateAction = toolbarActions.some((a: any) => a?.name === CREATE_ACTION);
  const ctaKind = entitlements?.ready ? decideEnvironmentCta(entitlements) : null;
  // Arm the deep link on the CREATE ACTION's presence — never on "the toolbar
  // has actions" (#4123). The old predicate armed on `toolbarActions.length > 0`,
  // so a toolbar carrying any other action consumed `?runAction=create_environment`
  // and triggered nothing (measured: `urlParam=null execute=0`), unrecoverably.
  const autoRunCreate = useAutoRunCreate(hasCreateAction ? ctaKind : null);

  // Deep-linked "create" while in the upgrade state opens the SAME upgrade
  // prompt — the honest answer to "create" here. In an effect, not render:
  // onUpgrade sets parent state.
  useEffect(() => {
    if (autoRunCreate && ctaKind === 'upgrade_for_development' && entitlements) {
      onUpgrade(upgradeDialogSpec(entitlements, t));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRunCreate, ctaKind]);

  if (toolbarActions.length === 0) return null;

  // Still resolving: hold the create button's slot with a skeleton instead of a
  // label we are about to overwrite (objectui#3482). Only the create action is
  // withheld — the other toolbar actions are pure metadata and never re-label,
  // so blanking them would be a gratuitous loading flash. When the toolbar has
  // no create action at all, nothing can jump and no skeleton is rendered.
  if (entitlements === null) {
    const others = otherActions(toolbarActions);
    return (
      <>
        <OtherActionsBar actions={others} />
        {hasCreateAction && (
          // Sized like the `size="sm"` bar button it stands in for (h-9,
          // rounded-md), mirroring CloudOnboardingNext's loading placeholder.
          // The width is an approximation of the resolved labels — the point is
          // that the header keeps its shape, not a pixel-exact match.
          <Skeleton className="h-9 w-44 rounded-md" data-testid="environment-create-cta-loading" />
        )}
      </>
    );
  }

  // Upgrade state: a free-plan org clicking "create" must NOT POST-then-403.
  // Render a primary button that opens the upgrade prompt, plus any other
  // (non-create) toolbar actions through the normal bar.
  if (ctaKind === 'upgrade_for_development') {
    return (
      <>
        <OtherActionsBar actions={otherActions(toolbarActions)} />
        {/*
          This button IS the create affordance for a plan-locked org — it stands
          in for the create action so the click opens the upgrade prompt instead
          of POSTing into a 403. With no create action on the bar there is
          nothing to stand in for, so it must not appear either (#4123): same
          one-list rule as the arming predicate above.
        */}
        {hasCreateAction && (
          <Button
            size="sm"
            onClick={() => onUpgrade(upgradeDialogSpec(entitlements!, t))}
            className="shadow-none gap-1.5 sm:gap-2 h-8 sm:h-9"
            data-testid="environment-add-upgrade"
          >
            <Plus className="h-4 w-4" />
            <span>{t('environment.addEnvironment')}</span>
          </Button>
        )}
      </>
    );
  }

  // setup_production / add_development: render the bar, overriding only the
  // create action's label (and promoting production setup to a primary CTA).
  // Labels are locale-aware — the metadata label is already localized by the
  // caller, but these state-aware overrides used to be hard-coded English,
  // which flashed an English button in a zh console (#844). They now resolve
  // from the locale packs, so all ten languages work rather than just zh
  // (objectui#2871).
  //
  // `ctaKind == null` can only be the settled-with-no-signal state here (the
  // in-flight one returned above), so the metadata label passes through — see
  // the "who owns this button's text" note at the top of the file.
  const renderedActions = toolbarActions.map((a: any) => {
    if (a?.name !== CREATE_ACTION || ctaKind == null) return a;
    if (ctaKind === 'setup_production') {
      return {
        ...a,
        label: t('environment.setUpProduction'),
        variant: 'primary',
        ...(autoRunCreate ? { autoTrigger: true } : {}),
      };
    }
    // add_development
    return {
      ...a,
      label: t('environment.addDevelopment'),
      ...(autoRunCreate ? { autoTrigger: true } : {}),
    };
  });

  return (
    <SchemaRenderer
      schema={{
        type: 'action:bar',
        location: 'list_toolbar',
        actions: renderedActions,
        size: 'sm',
        variant: 'outline',
      }}
    />
  );
}
