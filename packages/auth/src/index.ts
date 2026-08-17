/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @object-ui/auth
 *
 * Authentication system for Object UI providing:
 * - AuthProvider context for React apps
 * - useAuth hook for accessing auth state and methods
 * - AuthGuard component for route protection
 * - LoginForm, RegisterForm, ForgotPasswordForm UI components
 * - UserMenu component for authenticated user display
 * - createAuthClient factory for auth backend integration
 * - createAuthenticatedFetch for DataSource token injection
 *
 * @packageDocumentation
 */

export { AuthProvider, type AuthProviderProps } from './AuthProvider';
export { useAuth } from './useAuth';
export { useIsWorkspaceAdmin } from './useIsWorkspaceAdmin';
export { AuthGuard, type AuthGuardProps } from './AuthGuard';
export { AuthShell, type AuthShellProps, type AuthShellBrandPanel } from './AuthShell';
export { LoginForm, type LoginFormProps, type LoginFormLabels } from './LoginForm';
export { RegisterForm, type RegisterFormProps, type RegisterFormLabels } from './RegisterForm';
export { ForgotPasswordForm, type ForgotPasswordFormProps, type ForgotPasswordFormLabels } from './ForgotPasswordForm';
export { SocialSignInButtons, type SocialSignInButtonsProps } from './SocialSignInButtons';
export { UserMenu, type UserMenuProps } from './UserMenu';
export { PreviewBanner, type PreviewBannerProps } from './PreviewBanner';
export { createAuthClient, TokenStorage } from './createAuthClient';
export { normalizePhoneIdentifier, looksLikePhoneIdentifier } from './phone-identifier';
export { createAuthenticatedFetch, ActiveOrganizationStorage, type AuthenticatedAdapterOptions } from './createAuthenticatedFetch';
export { getUserInitials } from './types';

// Organization membership-role vocabulary — a CLOSED, framework-owned list of
// four (framework ADR-0108), re-exported from `@objectstack/spec`'s
// `BUILTIN_MEMBERSHIP_ROLES` so it cannot drift — plus the labels and
// narrowing helpers every org screen shares, which stay console-owned
// (see `org-roles.ts` for the boundary).
export {
  ORG_ROLE_OWNER,
  ORG_ROLE_ADMIN,
  ORG_ROLE_DELEGATED_ADMIN,
  ORG_ROLE_MEMBER,
  ORG_ROLES,
  ORG_ROLE_LABELS,
  orgRoleGrade,
  invitableOrgRoles,
  assignableOrgRoles,
  type OrgRole,
} from './org-roles';

// Invitation lifecycle vocabulary — a CLOSED set of four, bound to better-auth's
// own `InvitationStatus` so it cannot drift, plus the narrowing guard the wire
// boundary uses. Exported because a screen switching on `AuthInvitation.status`
// needs the union by name (objectui#3879).
export {
  AUTH_INVITATION_STATUSES,
  isAuthInvitationStatus,
  type AuthInvitationStatus,
} from './invitation-status';

// Shared auth form primitives — exposed so consumers can build custom forms
// that match the look of LoginForm / RegisterForm / ForgotPasswordForm.
export {
  AUTH_FIELD_LABEL_CLASS,
  AUTH_INPUT_CLASS,
  AUTH_LINK_CLASS,
  AUTH_PRIMARY_BUTTON_CLASS,
  AuthAlertIcon,
  AuthCheckIcon,
  AuthDivider,
  AuthErrorBanner,
  AuthFormHeader,
  AuthMailIcon,
  AuthSpinner,
} from './authStyles';

// Re-export types for convenience
export type {
  AuthUser,
  AuthClientSession,
  AuthState,
  AuthClient,
  AuthClientConfig,
  AuthLinkComponentProps,
  AuthProviderOptions,
  PreviewModeOptions,
  SignInCredentials,
  SignUpData,
  AuthOrganization,
  AuthOrganizationMember,
  AuthInvitation,
  AuthSocialProvider,
  AuthPublicConfig,
  SignInWithProviderOptions,
  TenancyPosture,
  DelegableScope,
} from './types';

export type { AuthContextValue } from './AuthContext';
