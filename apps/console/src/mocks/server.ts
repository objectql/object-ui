/**
 * MSW Server Setup for Tests
 *
 * Uses the shared createKernel() factory with MSWPlugin to create
 * a consistent mock environment for testing. MSWPlugin exposes the
 * full ObjectStack protocol, so filter/sort/top/pagination work
 * identically to server mode.
 *
 * This pattern follows @objectstack/studio — see https://github.com/objectstack-ai/spec
 */

import { http, HttpResponse } from 'msw';
import { ObjectKernel } from '@objectstack/runtime';
import { InMemoryDriver } from '@objectstack/driver-memory';
import { setupServer } from 'msw/node';
import type { MSWPlugin } from '@objectstack/plugin-msw';
import appConfig from '../../objectstack.shared';
import { createKernel } from './createKernel';

let kernel: ObjectKernel | null = null;
let driver: InMemoryDriver | null = null;
let mswPlugin: MSWPlugin | null = null;
let server: ReturnType<typeof setupServer> | null = null;

/**
 * Load application-specific locale bundles for the i18n API endpoint.
 * In this mock environment, loads translations from installed example packages.
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
  if (kernel) {
    console.log('[MSW] ObjectStack Runtime already initialized');
    return kernel;
  }

  console.log('[MSW] Starting ObjectStack Runtime (Test Mode)...');

  const result = await createKernel({
    appConfig,
    mswOptions: {
      enableBrowser: false,
      baseUrl: '/api/v1',
      logRequests: false,
      customHandlers: [
        http.get('/api/v1/i18n/:lang', async ({ params }) => {
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

  // Get handlers from MSWPlugin and set up Node.js MSW server
  const handlers = mswPlugin?.getHandlers() ?? [];
  server = setupServer(...handlers);
  server.listen({ onUnhandledRequest: 'bypass' });

  console.log('[MSW] ObjectStack Runtime ready');
  return kernel;
}

export function stopMockServer() {
  if (server) {
    server.close();
    server = null;
  }
  mswPlugin = null;
  kernel = null;
  driver = null;
}

export function getKernel(): ObjectKernel | null {
  return kernel;
}

export function getDriver(): InMemoryDriver | null {
  return driver;
}
