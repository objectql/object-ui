# @object-ui/auth

Authentication system for Object UI — AuthProvider, guards, login/register forms, and token management.

## Features

- 🔐 **AuthProvider Context** - Wrap your app with authentication state and methods
- 🛡️ **AuthGuard** - Protect routes and components from unauthenticated access
- 📝 **Pre-built Forms** - LoginForm, RegisterForm, and ForgotPasswordForm ready to use
- 👤 **UserMenu** - Display authenticated user info with sign-out support
- 🔑 **Auth Client Factory** - `createAuthClient` powered by official [better-auth](https://better-auth.com) client
- 🌐 **Authenticated Fetch** - `createAuthenticatedFetch` for automatic token injection
- 👀 **Preview Mode** - Auto-login with simulated identity for marketplace demos and app showcases
- 🎯 **Type-Safe** - Full TypeScript support with exported types

## Installation

```bash
npm install @object-ui/auth
```

**Peer Dependencies:**
- `react` ^18.0.0 || ^19.0.0

## Quick Start

```tsx
import { AuthProvider, useAuth, AuthGuard } from '@object-ui/auth';
import { createAuthClient } from '@object-ui/auth';

const authClient = createAuthClient({
  baseURL: 'https://api.example.com/auth',
});

function App() {
  return (
    <AuthProvider client={authClient}>
      <AuthGuard fallback={<LoginPage />}>
        <Dashboard />
      </AuthGuard>
    </AuthProvider>
  );
}

function Dashboard() {
  const { user, signOut } = useAuth();
  return (
    <div>
      <p>Welcome, {user?.name}</p>
      <button onClick={signOut}>Sign Out</button>
    </div>
  );
}
```

## API

### AuthProvider

Wraps your application with authentication context:

```tsx
<AuthProvider client={authClient}>
  <App />
</AuthProvider>
```

### useAuth

Hook for accessing auth state and methods:

```tsx
const {
  user,
  session,
  signIn,
  signOut,
  signUp,
  isAuthenticated,
  isLoading,
  isPreviewMode,
  previewMode,
} = useAuth();
```

| Property | Type | Description |
| --- | --- | --- |
| `user` | `AuthUser \| null` | Current authenticated user |
| `session` | `AuthClientSession \| null` | Current session information |
| `isAuthenticated` | `boolean` | Whether the user is authenticated |
| `isLoading` | `boolean` | Whether auth state is loading |
| `isPreviewMode` | `boolean` | Whether the app is running in preview mode |
| `previewMode` | `PreviewModeOptions \| null` | Preview mode configuration (only set when `isPreviewMode` is true) |
| `signIn` | `(email, password) => Promise` | Sign in with credentials |
| `signOut` | `() => Promise` | Sign out the current user |
| `signUp` | `(name, email, password) => Promise` | Register a new user |

### AuthGuard

Protects children from unauthenticated access:

```tsx
<AuthGuard fallback={<LoginForm />}>
  <ProtectedContent />
</AuthGuard>
```

### LoginForm / RegisterForm / ForgotPasswordForm

Pre-built authentication form components:

```tsx
<LoginForm onSuccess={() => navigate('/dashboard')} />
<RegisterForm onSuccess={() => navigate('/welcome')} />
<ForgotPasswordForm onSuccess={() => navigate('/check-email')} />
```

### UserMenu

Displays current user info with avatar and sign-out:

```tsx
<UserMenu />
```

### createAuthenticatedFetch

Creates a fetch wrapper that injects the stored Bearer token (plus
`X-Tenant-ID` and `Accept-Language`) into API requests:

```tsx
const authedFetch = createAuthenticatedFetch();

// For fetches whose target URL comes from view metadata (`provider: 'api'`
// data sources), restrict credential injection to the current page's origin
// so the platform token never leaks to third-party hosts:
const apiProviderFetch = createAuthenticatedFetch({ sameOriginOnly: true });
```

## Server Feature Flags (`GET /auth/config`)

`createAuthClient().getConfig()` fetches the server's public auth configuration. The
`features` map on it tells the login surface which capabilities the deployment actually
has, so the UI never renders an entry point whose endpoint is not mounted — `features.sso`
gates the "Sign in with SSO" button, `features.phoneNumberOtp` gates the
verification-code mode, `features.deviceAuthorization` gates the device-approval page,
and so on.

### Reserved flags — advertised by the server, consumed by nothing

Two members of that map are **declared but deliberately not consumed** by this package:

| Flag | Status | What enabling it does in the UI today |
| --- | --- | --- |
| `features.passkeys` | **Reserved** | Nothing. There is no passkey sign-in or registration UI for it to gate. |
| `features.magicLink` | **Reserved** | Nothing. There is neither a magic-link request step nor a route that consumes the emailed token. |

They are typed so the `/auth/config` payload round-trips without loss, not because
anything reads them. **Turning either flag on server-side adds no entry point to the login
page.** If you are enabling one because you expect a button to appear, it will not — and
that is the whole reason this section exists.

Building the two flows is tracked as a separate, unscheduled feature card,
[objectui#4179](https://github.com/objectstack-ai/objectui/issues/4179). Documenting them
as reserved rather than building them now follows the maintainer's ruling on
[objectui#2514](https://github.com/objectstack-ai/objectui/issues/2514): mark them
reserved today, build the UI when the login surface gets roadmap time, at which point it
renders driven by these same flags. When that lands, this section retires with it.

`features.twoFactor` is **not** in this category, despite also not being read by
`LoginForm`. Two-factor authentication is implemented here (`enableTwoFactor` /
`verifyTwoFactor` on the auth client) and its challenge is driven by server-side
remediation rather than by the flag, so the login form ignoring the flag is the design,
not a gap.

## Preview Mode

Preview mode allows visitors (e.g. marketplace customers) to explore the platform without registering or logging in. The `AuthProvider` auto-authenticates with a simulated user identity and bypasses login/registration screens.

This feature aligns with the `PreviewModeConfig` from `@objectstack/spec/kernel` ([spec PR #676](https://github.com/objectstack-ai/spec/pull/676)).

### Usage

```tsx
import { AuthProvider, PreviewBanner } from '@object-ui/auth';

function App() {
  return (
    <AuthProvider
      authUrl="/api/v1/auth"
      previewMode={{
        simulatedRole: 'admin',
        simulatedUserName: 'Demo Admin',
        readOnly: false,
        bannerMessage: 'You are exploring a demo — data will be reset periodically.',
      }}
    >
      <PreviewBanner />
      <Dashboard />
    </AuthProvider>
  );
}
```

### PreviewModeOptions

| Property | Type | Default | Description |
| --- | --- | --- | --- |
| `autoLogin` | `boolean` | `true` | Auto-login as simulated user, skipping login/registration pages |
| `simulatedRole` | `'admin' \| 'user' \| 'viewer'` | `'admin'` | Permission role for the simulated preview user |
| `simulatedUserName` | `string` | `'Preview User'` | Display name for the simulated preview user |
| `readOnly` | `boolean` | `false` | Restrict the preview session to read-only operations |
| `expiresInSeconds` | `number` | `0` | Preview session duration in seconds (0 = no expiration) |
| `bannerMessage` | `string` | — | Banner message displayed in the UI during preview mode |

### PreviewBanner

A component that renders a status banner when preview mode is active. Shows `bannerMessage` from the preview config, or a default message.

```tsx
import { PreviewBanner } from '@object-ui/auth';

// Only renders when isPreviewMode is true
<PreviewBanner />
```

### Detecting Preview Mode

Use the `useAuth` hook to check if the app is in preview mode:

```tsx
function MyComponent() {
  const { isPreviewMode, previewMode } = useAuth();

  if (isPreviewMode && previewMode?.readOnly) {
    // Disable write operations
  }

  return <div>...</div>;
}
```

> **⚠️ Security:** Preview mode should **never** be used in production environments.

## Links

- 📦 [npm package](https://www.npmjs.com/package/@object-ui/auth)
- 📝 [Changelog](./CHANGELOG.md)
- 🐛 [Report an issue](https://github.com/objectstack-ai/objectui/issues)
- 🤝 [Contributing Guide](https://github.com/objectstack-ai/objectui/blob/main/CONTRIBUTING.md)
- 🗺️ [Roadmap](https://github.com/objectstack-ai/objectui/blob/main/ROADMAP.md)

## License

MIT — see [LICENSE](./LICENSE).
