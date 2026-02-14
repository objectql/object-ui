# @object-ui/auth

Authentication system for Object UI — AuthProvider, guards, login/register forms, and token management.

## Features

- 🔐 **AuthProvider Context** - Wrap your app with authentication state and methods
- 🛡️ **AuthGuard** - Protect routes and components from unauthenticated access
- 📝 **Pre-built Forms** - LoginForm, RegisterForm, and ForgotPasswordForm ready to use
- 👤 **UserMenu** - Display authenticated user info with sign-out support
- 🔑 **Auth Client Factory** - `createAuthClient` for pluggable backend integration
- 🌐 **Authenticated Fetch** - `createAuthenticatedFetch` for automatic token injection
- 👀 **Preview Mode** - Auto-login with simulated identity for marketplace demos and app showcases
- 🎯 **Type-Safe** - Full TypeScript support with exported types

## Installation

```bash
npm install @object-ui/auth
```

**Peer Dependencies:**
- `react` ^18.0.0 || ^19.0.0
- `react-dom` ^18.0.0 || ^19.0.0

## Quick Start

```tsx
import { AuthProvider, useAuth, AuthGuard } from '@object-ui/auth';
import { createAuthClient } from '@object-ui/auth';

const authClient = createAuthClient({
  provider: 'custom',
  apiUrl: 'https://api.example.com/auth',
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
| `session` | `AuthSession \| null` | Current session information |
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

Creates a fetch wrapper that injects auth tokens into DataSource requests:

```tsx
const authedFetch = createAuthenticatedFetch({ getToken: () => session.token });
```

## Preview Mode

Preview mode allows visitors (e.g. marketplace customers) to explore the platform without registering or logging in. The `AuthProvider` auto-authenticates with a simulated user identity and bypasses login/registration screens.

This feature aligns with the `PreviewModeConfig` from `@objectstack/spec/kernel` ([spec PR #676](https://github.com/objectstack-ai/spec/pull/676)).

### Usage

```tsx
import { AuthProvider, PreviewBanner } from '@object-ui/auth';

function App() {
  return (
    <AuthProvider
      authUrl="/api/auth"
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

## License

MIT
