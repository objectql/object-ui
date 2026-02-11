/**
 * MSW Server Setup for Tests
 *
 * Uses the shared createKernel() factory and handler factory to create
 * a consistent mock environment for testing.
 *
 * This pattern follows @objectstack/studio — see https://github.com/objectstack-ai/spec
 */

import { ObjectKernel } from '@objectstack/runtime';
import { InMemoryDriver } from '@objectstack/driver-memory';
import { setupServer } from 'msw/node';
import appConfig from '../../objectstack.shared';
import { createKernel } from './createKernel';
import { createHandlers } from './handlers';

let kernel: ObjectKernel | null = null;
let driver: InMemoryDriver | null = null;
let server: ReturnType<typeof setupServer> | null = null;

export async function startMockServer() {
  if (kernel) {
    console.log('[MSW] ObjectStack Runtime already initialized');
    return kernel;
  }

  console.log('[MSW] Starting ObjectStack Runtime (Test Mode)...');

  const result = await createKernel({ appConfig });
  kernel = result.kernel;
  driver = result.driver;

  // Create MSW handlers for both paths to ensure compatibility with client defaults
  const v1Handlers = createHandlers('http://localhost:3000/api/v1', kernel, driver);
  const legacyHandlers = createHandlers('http://localhost:3000/api', kernel, driver);
  const handlers = [...v1Handlers, ...legacyHandlers];

  // Setup MSW server for Node.js environment
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
  kernel = null;
  driver = null;
}

export function getKernel(): ObjectKernel | null {
  return kernel;
}

export function getDriver(): InMemoryDriver | null {
  return driver;
}
