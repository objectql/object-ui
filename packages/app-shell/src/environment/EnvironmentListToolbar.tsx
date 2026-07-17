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
 *   • still resolving / unknown  → the action's default label (neutral), with the
 *                                  apiHandler entitlement dialog as the safety net.
 *
 * Create flows reuse the standard `action:bar` runner (name modal → apiHandler),
 * so only the label/variant changes — no duplicate POST logic here.
 */

import { useEffect, useRef, useState } from 'react';
import { SchemaRenderer } from '@object-ui/react';
import { Button } from '@object-ui/components';
import { Plus } from 'lucide-react';
import {
  decideEnvironmentCta,
  upgradeDialogSpec,
  type EntitlementDialogSpec,
  type EnvironmentEntitlementsState,
} from './entitlements';

const CREATE_ACTION = 'create_environment';

/** Resolve an inline {en,zh} label against the document locale. */
function pick(label: { en: string; zh: string }): string {
  const lang =
    (typeof document !== 'undefined' && document.documentElement.getAttribute('lang')) || 'en';
  return lang.toLowerCase().startsWith('zh') ? label.zh : label.en;
}

/**
 * Deep-link support (#844): `?runAction=create_environment` on the
 * environments route auto-opens the create dialog once entitlements have
 * resolved — the welcome page's "Create your environment" CTA uses it so the
 * user doesn't land on the list and have to find the create button again.
 * The param is consumed exactly once (stripped from the URL on consumption)
 * so refresh / back don't re-open the dialog.
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

interface Props {
  /** Toolbar actions already localized by the caller (ObjectView). */
  actions: any[];
  /** Resolved entitlement state, or null while still loading. */
  entitlements: EnvironmentEntitlementsState | null;
  /** Open the shared entitlement dialog (proactive upgrade prompt). */
  onUpgrade: (spec: EntitlementDialogSpec) => void;
}

export function EnvironmentListToolbar({ actions, entitlements, onUpgrade }: Props) {
  const toolbarActions = (actions || []).filter((a: any) => a?.locations?.includes('list_toolbar'));
  const ctaKind = entitlements?.ready ? decideEnvironmentCta(entitlements) : null;
  const autoRunCreate = useAutoRunCreate(toolbarActions.length > 0 ? ctaKind : null);

  // Deep-linked "create" while in the upgrade state opens the SAME upgrade
  // prompt — the honest answer to "create" here. In an effect, not render:
  // onUpgrade sets parent state.
  useEffect(() => {
    if (autoRunCreate && ctaKind === 'upgrade_for_development' && entitlements) {
      onUpgrade(upgradeDialogSpec(entitlements));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRunCreate, ctaKind]);

  if (toolbarActions.length === 0) return null;

  // Upgrade state: a free-plan org clicking "create" must NOT POST-then-403.
  // Render a primary button that opens the upgrade prompt, plus any other
  // (non-create) toolbar actions through the normal bar.
  if (ctaKind === 'upgrade_for_development') {
    const others = toolbarActions.filter((a: any) => a?.name !== CREATE_ACTION);
    return (
      <>
        {others.length > 0 && (
          <SchemaRenderer
            schema={{ type: 'action:bar', location: 'list_toolbar', actions: others, size: 'sm', variant: 'outline' }}
          />
        )}
        <Button
          size="sm"
          onClick={() => onUpgrade(upgradeDialogSpec(entitlements!))}
          className="shadow-none gap-1.5 sm:gap-2 h-8 sm:h-9"
          data-testid="environment-add-upgrade"
        >
          <Plus className="h-4 w-4" />
          <span>{pick({ en: 'Add environment', zh: '新建环境' })}</span>
        </Button>
      </>
    );
  }

  // setup_production / add_development / loading: render the bar, overriding only
  // the create action's label (and promoting production setup to a primary CTA).
  // Labels are locale-aware — the metadata label is already localized by the
  // caller, but these state-aware overrides used to be hard-coded English,
  // which flashed an English button in a zh console (#844).
  const renderedActions = toolbarActions.map((a: any) => {
    if (a?.name !== CREATE_ACTION || ctaKind == null) return a;
    if (ctaKind === 'setup_production') {
      return {
        ...a,
        label: pick({ en: 'Set up your production environment', zh: '创建你的生产环境' }),
        variant: 'primary',
        ...(autoRunCreate ? { autoTrigger: true } : {}),
      };
    }
    // add_development
    return {
      ...a,
      label: pick({ en: 'Add development environment', zh: '新建开发环境' }),
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
