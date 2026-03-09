/**
 * MSW Browser Worker Setup via ObjectStack Runtime
 *
 * Uses the shared createKernel() factory to bootstrap the ObjectStack kernel
 * with MSWPlugin, which automatically exposes all ObjectStack API endpoints
 * via MSW. This ensures filter/sort/top/pagination work identically to
 * server mode.
 *
 * This pattern follows @objectstack/studio — see https://github.com/objectstack-ai/spec
 */

import { http, HttpResponse } from 'msw';
import { setupWorker } from 'msw/browser';
import { ObjectKernel } from '@objectstack/runtime';
import { InMemoryDriver } from '@objectstack/driver-memory';
import type { MSWPlugin } from '@objectstack/plugin-msw';
import appConfig from '../../objectstack.shared';
import { createKernel } from './createKernel';
import { createAuthHandlers } from './authHandlers';

let kernel: ObjectKernel | null = null;
let driver: InMemoryDriver | null = null;
let mswPlugin: MSWPlugin | null = null;
let worker: ReturnType<typeof setupWorker> | null = null;

/**
 * Load application-specific locale bundles for the i18n API endpoint.
 * In this mock environment, loads translations from installed example packages.
 * Returns a flat translation resource for the given language code.
 */
async function loadAppLocale(lang: string): Promise<Record<string, unknown>> {
  try {
    const { crmLocales } = await import('@object-ui/example-crm');
    const translations = (crmLocales as Record<string, any>)[lang];
    if (!translations) return {};
    return { crm: translations };
  } catch {
    return {};
  }
}

export async function startMockServer() {
  // Polyfill process.on for ObjectKernel in browser environment
  try {
    if (typeof process !== 'undefined' && !(process as any).on) {
      (process as any).on = () => {};
    }
  } catch (e) {
    if (import.meta.env.DEV) console.warn('[MSW] Failed to polyfill process.on', e);
  }

  if (kernel) {
    if (import.meta.env.DEV) console.log('[MSW] ObjectStack Runtime already initialized');
    return kernel;
  }

  if (import.meta.env.DEV) console.log('[MSW] Starting ObjectStack Runtime (Browser Mode)...');

  const result = await createKernel({
    appConfig,
    mswOptions: {
      enableBrowser: false,
      baseUrl: '/api/v1',
      logRequests: import.meta.env.DEV,
      customHandlers: [
        // Mock auth endpoints (better-auth compatible)
        ...createAuthHandlers('/api/v1/auth'),
        // Serve i18n translation bundles via API
        http.get('/api/v1/i18n/translations/:lang', async ({ params }) => {
          const lang = params.lang as string;
          const resources = await loadAppLocale(lang);
          return HttpResponse.json(resources);
        }),
      ],
    },
  });
  kernel = result.kernel;
  driver = result.driver;
  mswPlugin = result.mswPlugin ?? null;

  // Manually start the MSW browser worker so we can set the service worker
  // URL to respect Vite's base path (e.g. '/console/'). Without this, MSW
  // defaults to '/mockServiceWorker.js' which 404s when base !== '/'.
  const handlers = mswPlugin?.getHandlers() ?? [];
  if (handlers.length === 0 && import.meta.env.DEV) {
    console.warn('[MSW] No handlers registered — mock API calls will not be intercepted');
  }
  worker = setupWorker(...handlers);
  await worker.start({
    serviceWorker: {
      url: `${import.meta.env.BASE_URL}mockServiceWorker.js`,
    },
    onUnhandledRequest: 'bypass',
  });

  if (import.meta.env.DEV) console.log('[MSW] ObjectStack Runtime ready');
  return kernel;
}

export function stopMockServer() {
  if (worker) {
    worker.stop();
    worker = null;
  }
  mswPlugin = null;
  driver = null;
  kernel = null;
}

export function getKernel(): ObjectKernel | null {
  return kernel;
}

export function getDriver(): InMemoryDriver | null {
  return driver;
}
