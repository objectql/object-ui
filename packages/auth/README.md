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

## The `X-Tenant-ID` edge contract

`createAuthenticatedFetch` stamps `X-Tenant-ID` on the requests it wraps. This section is
that header's contract: what it means, who stamps it, who reads it, what a reader may
assume, and the one window in which it is not sent at all.

It is written down because **a grep cannot answer any of those questions from this
repository.** The header's only non-CORS consumer lives in the **cloud** repository, so a
search confined to this repo and the framework (`objectstack`) finds zero readers and
reads as *"nothing consumes this stamp"*. That reading is what
[objectui#5279](https://github.com/objectstack-ai/objectui/issues/5279) was filed on, and
it is false. Do not act on it.

### What it means

A **routing hint** for the hosting edge — *this request belongs to tenant `<id>`*:

```http
X-Tenant-ID: <better-auth activeOrganizationId>
```

The value is the active **organization** id, the same id the session carries as
`session.activeOrganizationId`. The header is **not** an identity claim, **not** an
authorization input, and **not** what scopes rows.

### Who stamps it

| | |
| --- | --- |
| Stamped by | `createAuthenticatedFetch` ([`src/createAuthenticatedFetch.ts`](src/createAuthenticatedFetch.ts)) |
| Value read from | `ActiveOrganizationStorage` — `localStorage`, key `auth-active-organization-id` |
| Condition | that storage holds a non-empty value |
| *Not* conditioned on | the URL being an `/api/` call. `Authorization` and `Accept-Language` are; this is not |
| Suppressed by | `createAuthenticatedFetch({ sameOriginOnly: true })` for cross-origin URLs — it returns before any header work |
| Precedence | overwrites an `X-Tenant-ID` the caller passed in `init.headers` |

`ActiveOrganizationStorage` has exactly one writer, [`AuthProvider`](src/AuthProvider.tsx):

| Event | Effect |
| --- | --- |
| `refreshOrganizations` — after `getSession` &rarr; `listOrganizations` &rarr; `getActiveOrganization` resolves (including the ADR-0081 single-membership repair) | set |
| `switchOrganization` — the org switcher | set, or clear when the server returns no org |
| `deleteOrganization` / `leaveOrganization`, when the active org is the one going away | clear |
| sign-out | clear |

### Who reads it

**The cloud edge — yes.** The non-test readers are recorded on objectui#5279:
`packages/service-tenant/src/tenant-context.ts` (header resolution) and
`packages/tenant-router/src/spec/turso-multi-tenant.zod.ts`, both in the `cloud`
repository. That repository is not readable from this one, so those paths are cited as the
recorded reading rather than re-derived here.

**Its configuration contract, though, IS readable from here**, because this package
depends on `@objectstack/spec`. `TenantRoutingConfigSchema` (`@objectstack/spec/cloud`) is
what configures a tenant resolver; parsing an empty config on the version this package
resolves today (17.1.0) yields:

```text
enabled:               false
identificationSources: ["subdomain", "header", "jwt_claim"]
tenantHeaderName:      "X-Tenant-ID"
jwtOrganizationClaim:  "organizationId"
```

Two consequences matter to a client author:

- **The header name is configurable.** `X-Tenant-ID` is its default, not a constant.
- **The header is one of six identification sources** (`subdomain`, `custom_domain`,
  `header`, `jwt_claim`, `session`, `default`), and in the default precedence it ranks
  **second, behind `subdomain`**. On a subdomain-routed deployment it is not the thing
  that picks the tenant, and a deployment may leave it out of `identificationSources`
  entirely.

**The framework (`objectstack`) — no.** `resolveAuthzContext`
(`packages/core/src/security/resolve-authz-context.ts`) derives `tenantId` from the
API-key principal or from `session.activeOrganizationId`, and from no header;
`packages/verify/src/harness.org-context.test.ts` pins it — *"`session.activeOrganizationId`
is the ONE field `resolveAuthzContext` reads into `tenantId`"*. Environment and kernel
routing read the hostname and `X-Environment-Id`. The framework's only other mentions are
the CORS preflight allow-list (`DEFAULT_CORS_ALLOW_HEADERS`, whose comment describes
`X-Tenant-ID` / `X-Environment-Id` as what routes "a request to its environment") and
`plugin-sharing`, which records that trusting `x-tenant-id` as identity **was a
vulnerability**: its secure default stopped reading identity from headers because doing so
let a client forge attribution and enumerate or revoke other users' links.

### What a reader may assume

A reader **may**:

- use it to select the tenant database or environment to route to, subject to its own
  `identificationSources` precedence;
- treat it as a hint that may be absent, stale, or contradicted by the session.

A reader **may not**:

- treat it as authenticated identity, or as an authorization decision. It is
  client-controlled — any caller can send any value, and `plugin-sharing` is the recorded
  precedent for what happens to a server that trusts it;
- assume the row scoping it sees downstream came from this header. It did not: the
  framework scopes from the session;
- assume the header is present. See below.

### The unstamped-first-request gap

The stamp reads storage that `AuthProvider` fills only **after** `getSession` &rarr;
`listOrganizations` &rarr; `getActiveOrganization` resolves. Every request that leaves
before that chain completes carries **no** `X-Tenant-ID` at all.

The window opens in five situations:

1. a browser that has never signed in, or whose site data was cleared, including a private
   window;
2. the page load in which the user signs in — from the sign-in response until the
   organization chain resolves;
3. after sign-out, which clears the storage, until a new organization resolves;
4. outside a browser (SSR, tests, a worker), where `localStorage` is unavailable and the
   storage falls back to a per-process in-memory value that starts empty on every cold
   start;
5. a browser where `localStorage` exists but **rejects writes** (Safari private browsing,
   quota exhaustion). There the window never closes — the in-memory fallback is written
   but never read back, because `get()` only falls back when reading itself *throws*, and
   a rejected write leaves reads working and returning `null`. Reported on objectui#5279
   as a separate defect; it is not fixed here.

Case 1 is not theoretical in this codebase: `app-shell`'s `MetadataProvider` issues its
eager `app` metadata fetch inside exactly this window, which is why its first-boot cache
scope needed its own reasoning
([`packages/app-shell/src/providers/MetadataProvider.tsx`](../app-shell/src/providers/MetadataProvider.tsx),
pinned by `MetadataProvider.firstBootOrgScope.test.tsx`).

**What a reader observes in the window:** the header is **absent**, never
present-and-empty. A resolver must fall through to its next configured identification
source — `subdomain` already outranks it by default, with `jwt_claim`, `session` and
`defaultTenantId` behind it — rather than fail closed on the absence. It must also not
cache a routing decision taken inside the window as *the* tenant for the session: the very
next request will normally carry the header.

**Why the gap does not corrupt data scoping.** A response computed inside the window is
still computed for the right tenant, because the framework takes `tenantId` from the
session rather than from the header. The gap is a *routing-input* gap, not a scoping gap.
This is the same reasoning objectui#5243 relied on when it relabelled a metadata cache
entry that had been written in the window.

**Closing the gap is a separate decision, not an omission.** The cloud readers observe the
current behaviour, so changing when the header first appears changes what they see. If it
should be closed, it needs its own card.

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
