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
  if (toolbarActions.length === 0) return null;

  const ctaKind = entitlements?.ready ? decideEnvironmentCta(entitlements) : null;

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
          <span>Add environment</span>
        </Button>
      </>
    );
  }

  // setup_production / add_development / loading: render the bar, overriding only
  // the create action's label (and promoting production setup to a primary CTA).
  const renderedActions = toolbarActions.map((a: any) => {
    if (a?.name !== CREATE_ACTION || ctaKind == null) return a;
    if (ctaKind === 'setup_production') {
      return { ...a, label: 'Set up your production environment', variant: 'primary' };
    }
    // add_development
    return { ...a, label: 'Add development environment' };
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
