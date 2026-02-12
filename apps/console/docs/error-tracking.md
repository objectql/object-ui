# Error Tracking Integration Guide

This guide explains how to integrate error tracking (Sentry or equivalent) into the ObjectUI Console for production deployments.

## Option 1: Sentry (Recommended)

### Installation

```bash
pnpm add @sentry/react --filter @object-ui/console
```

### Configuration

Create `src/lib/sentry.ts`:

```typescript
import * as Sentry from '@sentry/react';

export function initErrorTracking() {
  if (import.meta.env.PROD) {
    Sentry.init({
      dsn: import.meta.env.VITE_SENTRY_DSN,
      environment: import.meta.env.VITE_ENVIRONMENT || 'production',
      release: import.meta.env.VITE_APP_VERSION || '1.0.0',

      // Performance monitoring
      tracesSampleRate: 0.1, // 10% of transactions
      replaysSessionSampleRate: 0.01, // 1% of sessions
      replaysOnErrorSampleRate: 1.0, // 100% of error sessions

      // Filter out noise
      ignoreErrors: [
        'ResizeObserver loop limit exceeded',
        'ResizeObserver loop completed with undelivered notifications',
        'Non-Error promise rejection captured',
      ],

      // Scrub sensitive data
      beforeSend(event) {
        if (event.request?.headers) {
          delete event.request.headers['Authorization'];
        }
        return event;
      },
    });
  }
}
```

### Integration in `main.tsx`

```typescript
import { initErrorTracking } from './lib/sentry';

// Initialize error tracking before React renders
initErrorTracking();

// Wrap your app with Sentry error boundary
import * as Sentry from '@sentry/react';

const SentryErrorBoundary = Sentry.withErrorBoundary(App, {
  fallback: ({ error }) => (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Something went wrong</h1>
        <p className="text-muted-foreground mt-2">{error?.message}</p>
        <button onClick={() => window.location.reload()} className="mt-4">
          Reload Page
        </button>
      </div>
    </div>
  ),
});
```

### Environment Variables

Add to your deployment environment:

```env
VITE_SENTRY_DSN=https://your-key@sentry.io/your-project-id
VITE_ENVIRONMENT=production
VITE_APP_VERSION=1.0.0
```

### Source Maps (Optional)

For readable stack traces in production, upload source maps during CI:

```yaml
# In your CI/CD pipeline
- name: Upload Source Maps
  run: |
    npx @sentry/cli sourcemaps upload \
      --auth-token $SENTRY_AUTH_TOKEN \
      --org your-org \
      --project objectui-console \
      --release $APP_VERSION \
      apps/console/dist/assets/
```

> **Note:** The console build has `sourcemap: false` by default. To generate source maps for Sentry only, temporarily enable them in CI and upload before deleting.

## Option 2: Custom Error Boundary

If you prefer a lightweight solution without a third-party service, use React's built-in error boundary with a custom reporter:

```typescript
// src/lib/error-reporter.ts
export function reportError(error: Error, context?: Record<string, unknown>) {
  const payload = {
    message: error.message,
    stack: error.stack,
    context,
    timestamp: new Date().toISOString(),
    url: window.location.href,
    userAgent: navigator.userAgent,
  };

  // Send to your error tracking endpoint
  if (import.meta.env.VITE_ERROR_ENDPOINT) {
    fetch(import.meta.env.VITE_ERROR_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => {
      // Silently fail — don't create error loops
    });
  }
}

// Catch unhandled errors
window.addEventListener('error', (event) => {
  reportError(event.error || new Error(event.message));
});

window.addEventListener('unhandledrejection', (event) => {
  reportError(
    event.reason instanceof Error
      ? event.reason
      : new Error(String(event.reason))
  );
});
```

## CSP Compatibility

The console includes a Content Security Policy (CSP) meta tag. If your error tracking service requires additional domains, update the CSP in `index.html`:

```html
<!-- Add your error tracking domain to connect-src -->
<meta http-equiv="Content-Security-Policy"
  content="... connect-src 'self' https://*.sentry.io ...;" />
```

The default CSP already includes `https://*.sentry.io` in the `connect-src` directive.

## Verifying the Integration

1. **Build the console:** `pnpm --filter @object-ui/console build`
2. **Preview:** `pnpm --filter @object-ui/console preview`
3. **Trigger a test error:** Open the browser console and run `throw new Error('Test error')`
4. **Check your dashboard:** Verify the error appears in Sentry / your tracking endpoint
