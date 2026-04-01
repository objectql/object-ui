/**
 * MSW Server Setup for Tests
 *
 * Uses the shared createKernel() factory with MSWPlugin to create
 * a consistent mock environment for testing. MSWPlugin exposes the
 * full ObjectStack protocol, so filter/sort/top/pagination work
 * identically to server mode.
 *
 * i18n translations are resolved automatically by createKernel from the
 * `i18n.bundles` field in the app config — no manual handler required.
 *
 * This pattern follows @objectstack/studio — see https://github.com/objectstack-ai/spec
 */

import { ObjectKernel } from '@objectstack/runtime';
import { InMemoryDriver } from '@objectstack/driver-memory';
import { setupServer } from 'msw/node';
import type { MSWPlugin } from '@objectstack/plugin-msw';
import { appConfigs, setupAppConfig, customReportsConfig } from '../../objectstack.shared';
import { createKernel } from './createKernel';
import { createAuthHandlers } from './authHandlers';

let kernel: ObjectKernel | null = null;
let driver: InMemoryDriver | null = null;
let mswPlugin: MSWPlugin | null = null;
let server: ReturnType<typeof setupServer> | null = null;

export async function startMockServer() {
  if (kernel) {
    console.log('[MSW] ObjectStack Runtime already initialized');
    return kernel;
  }

  console.log('[MSW] Starting ObjectStack Runtime (Test Mode)...');

  const result = await createKernel({
    appConfigs: [...appConfigs, setupAppConfig, customReportsConfig],
    persistence: false,
    mswOptions: {
      enableBrowser: false,
      baseUrl: '/api/v1',
      logRequests: false,
      customHandlers: [
        // Mock auth endpoints (better-auth compatible)
        ...createAuthHandlers('/api/v1/auth'),
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
