/**
 * Derive a context-aware empty-state config for object lists whose
 * `managedBy` bucket means the user can't create rows directly from
 * this list view.
 *
 * Background: previously the entire affordance story was carried by a
 * full-width banner pinned to the top of every list/detail/form page.
 * That violated the principle most enterprise platforms (Salesforce,
 * ServiceNow, SAP Fiori, Notion, Linear) settled on long ago: hide the
 * affordance you don't want users to take, and use the *empty state* as
 * the only place to explain why the list is empty and where new entries
 * come from.
 *
 * This helper returns an `emptyState` payload compatible with the
 * `ListView` schema (`{ title, message, icon }`). It only fires for the
 * buckets where the default empty state ("No records yet") would be
 * misleading; for `platform`/`config` it returns `undefined` so the
 * caller falls back to the user-defined view-level empty state.
 *
 * The bucket → message mapping mirrors `ManagedByBadge` so that the badge
 * (in the header) and the empty state (in the body) tell a consistent
 * story without repeating themselves verbatim.
 */
export interface ManagedByEmptyState {
  title: string;
  message: string;
  icon: string;
}

/**
 * Translator function, structurally compatible with the `t` returned by
 * `useObjectTranslation()`. Accepts a key and optional options (including a
 * `defaultValue` used as the English fallback when a locale lacks the key).
 */
type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

export function resolveManagedByEmptyState(
  managedBy: string | undefined | null,
  t: TranslateFn,
  objectName?: string | null,
): ManagedByEmptyState | undefined {
  switch (managedBy) {
    case 'system':
      return {
        icon: 'Lock',
        title: t('list.managedBy.system.title', { defaultValue: 'Nothing here yet' }),
        message: t('list.managedBy.system.message', {
          defaultValue:
            'Entries appear automatically when their source action runs (e.g. Submit for Approval, Share, Invite). Trigger one of those on a source record to create a row.',
        }),
      };
    case 'append-only':
      return {
        icon: 'Archive',
        title: t('list.managedBy.appendOnly.title', { defaultValue: 'No events recorded' }),
        message: t('list.managedBy.appendOnly.message', {
          defaultValue:
            'This is an immutable audit log. Rows are written by the platform when events occur — you can export the history but cannot create entries from here.',
        }),
      };
    case 'better-auth':
      // `sys_user` is the one identity table with a concrete onboarding
      // answer, so give it actionable guidance: teammates arrive via an
      // org-level invite + SSO just-in-time provisioning (ADR-0024 D9), and
      // app end-users self-register. We deliberately do NOT name the env-level
      // "Invite User" action — it is multi-org-gated and hidden in single-org —
      // nor a "Reset Password" toolbar action, which does not exist (cloud#580).
      // Every other identity table (sessions, accounts, tokens, jwks,
      // verifications, …) is written purely by auth flows, so keep the generic
      // copy — naming an invite/signup CTA on a token list would be wrong.
      if (objectName === 'sys_user') {
        return {
          icon: 'ShieldAlert',
          title: t('list.managedBy.betterAuthUser.title', { defaultValue: 'No users yet' }),
          message: t('list.managedBy.betterAuthUser.message', {
            defaultValue:
              'User accounts are provisioned by the authentication provider, not created here. Invite teammates to your organization and they appear automatically on first sign-in (SSO just-in-time provisioning). App end-users arrive when they sign up through your app.',
          }),
        };
      }
      return {
        icon: 'ShieldAlert',
        title: t('list.managedBy.betterAuth.title', { defaultValue: 'No identity records' }),
        message: t('list.managedBy.betterAuth.message', {
          defaultValue:
            'These records are created by the authentication provider — through sign-in, provisioning, and security flows — not added by hand here.',
        }),
      };
    default:
      return undefined;
  }
}
