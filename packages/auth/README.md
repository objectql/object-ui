# @object-ui/auth

Authentication system for Object UI — AuthProvider, guards, login/register forms, and token management.

## Features

- 🔐 **AuthProvider Context** - Wrap your app with authentication state and methods
- 🛡️ **AuthGuard** - Protect routes and components from unauthenticated access
- 📝 **Pre-built Forms** - LoginForm, RegisterForm, and ForgotPasswordForm ready to use
- 👤 **UserMenu** - Display authenticated user info with sign-out support
- 🔑 **Auth Client Factory** - `createAuthClient` for pluggable backend integration
- 🌐 **Authenticated Fetch** - `createAuthenticatedFetch` for automatic token injection
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
const { user, session, signIn, signOut, signUp, isAuthenticated, isLoading } = useAuth();
```

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

## License

MIT
