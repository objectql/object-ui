# Conditional Authentication

ObjectUI now supports conditional authentication based on server discovery information. This allows the console application to automatically detect whether the backend has authentication enabled and adapt accordingly.

## Overview

When the ObjectStack server discovery endpoint (`/.well-known/objectstack` or `/api`) indicates that authentication is disabled (`auth.enabled === false`), the console application will bypass the authentication flow and operate in "Guest Mode".

This is useful for:
- **Development environments** where authentication is not configured
- **Demo environments** where users should access the system without credentials
- **Embedded scenarios** where authentication is handled externally

## Implementation

### 1. Discovery Response Structure

The server's discovery endpoint should return a response with the following structure:

```json
{
  "name": "ObjectStack API",
  "version": "2.0.0",
  "services": {
    "auth": {
      "enabled": false,
      "status": "unavailable",
      "message": "Authentication service not installed. Install an auth plugin to enable authentication."
    },
    "data": {
      "enabled": true,
      "status": "available"
    },
    "metadata": {
      "enabled": true,
      "status": "available"
    }
  }
}
```

### 2. Client-Side Detection

The console application uses the `ConditionalAuthWrapper` component which:

1. Connects to the server and fetches discovery information
2. Checks the `services.auth.enabled` flag
3. If `false`, wraps the application with `<AuthProvider enabled={false}>` (Guest Mode)
4. If `true` or undefined, wraps with normal `<AuthProvider>` (Standard Auth Mode)

### 3. Guest Mode Behavior

When authentication is disabled:

- A virtual "Guest User" is automatically authenticated with:
  - ID: `guest`
  - Name: `Guest User`
  - Email: `guest@local`
  - Token: `guest-token`

- All protected routes become accessible without login
- Login/Register pages are still accessible but not required
- The user menu shows the guest user

## Usage

### For Application Developers

Simply wrap your application with `ConditionalAuthWrapper`:

```tsx
import { ConditionalAuthWrapper } from './components/ConditionalAuthWrapper';

function App() {
  return (
    <ConditionalAuthWrapper authUrl="/api/auth">
      <BrowserRouter>
        <Routes>
          {/* Your routes */}
        </Routes>
      </BrowserRouter>
    </ConditionalAuthWrapper>
  );
}
```

### For Backend Developers

Ensure your discovery endpoint returns the correct `services.auth.enabled` flag:

**With Auth Enabled:**
```typescript
{
  services: {
    auth: {
      enabled: true,
      status: "available"
    }
  }
}
```

**With Auth Disabled:**
```typescript
{
  services: {
    auth: {
      enabled: false,
      status: "unavailable",
      message: "Auth service not configured"
    }
  }
}
```

### Using the useDiscovery Hook

Components can also directly access discovery information:

```tsx
import { useDiscovery } from '@object-ui/react';

function MyComponent() {
  const { discovery, isLoading, isAuthEnabled } = useDiscovery();
  
  if (isLoading) return <LoadingSpinner />;
  
  return (
    <div>
      {isAuthEnabled 
        ? <LoginPrompt /> 
        : <GuestWelcome />
      }
    </div>
  );
}
```

## Security Considerations

⚠️ **Important Security Note:**

- The default behavior (when discovery fails or auth status is unknown) is to **enable authentication** for security.
- Guest mode should only be used in controlled environments (development, demos).
- In production, always configure proper authentication.

## API Reference

### ConditionalAuthWrapper

**Props:**
- `authUrl` (string): The authentication endpoint URL
- `children` (ReactNode): Application content to wrap

**Behavior:**
- Fetches discovery on mount
- Shows loading screen while checking auth status
- Wraps children with appropriate AuthProvider configuration

### AuthProvider

**New Props:**
- `enabled` (boolean, default: `true`): Whether authentication is enabled
  - When `false`: Automatically authenticates as guest user
  - When `true`: Normal authentication flow

### useDiscovery Hook

**Returns:**
- `discovery` (DiscoveryInfo | null): Raw discovery data from server
- `isLoading` (boolean): Whether discovery is being fetched
- `error` (Error | null): Any error that occurred during fetch
- `isAuthEnabled` (boolean): Convenience flag for `discovery?.services?.auth?.enabled ?? true`

## Examples

### Example 1: Development Server Without Auth

**Discovery Response:**
```json
{
  "name": "Dev Server",
  "services": {
    "auth": { "enabled": false }
  }
}
```

**Result:** Console loads without requiring login

### Example 2: Production Server With Auth

**Discovery Response:**
```json
{
  "name": "Production Server",
  "services": {
    "auth": { "enabled": true }
  }
}
```

**Result:** Console requires user authentication

### Example 3: Legacy Server (No Discovery)

**Discovery Response:** 404 or connection error

**Result:** Defaults to authentication enabled (secure by default)

## Testing

Tests are included in:
- `packages/auth/src/__tests__/AuthProvider.disabled.test.tsx`
- Tests verify guest mode behavior
- Tests verify normal auth mode behavior
- Tests verify session token creation in guest mode

Run tests with:
```bash
pnpm test packages/auth/src/__tests__/AuthProvider.disabled.test.tsx
```
