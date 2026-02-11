/**
 * MSW Browser Worker Setup via ObjectStack Runtime
 *
 * Uses the shared createKernel() factory to bootstrap the ObjectStack kernel,
 * then creates MSW handlers via the shared handler factory.
 *
 * This pattern follows @objectstack/studio — see https://github.com/objectstack-ai/spec
 */

import { ObjectKernel } from '@objectstack/runtime';
import { InMemoryDriver } from '@objectstack/driver-memory';
import { setupWorker } from 'msw/browser';
import appConfig from '../../objectstack.shared';
import { createKernel } from './createKernel';
import { createHandlers } from './handlers';

let kernel: ObjectKernel | null = null;
let driver: InMemoryDriver | null = null;
let worker: ReturnType<typeof setupWorker> | null = null;

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

  const result = await createKernel({ appConfig });
  kernel = result.kernel;
  driver = result.driver;

  // Create MSW handlers that match the response format of HonoServerPlugin
  // Include both /api/v1 and legacy /api paths so the ObjectStackClient can
  // reach the mock server regardless of which base URL it probes.
  const v1Handlers = createHandlers('/api/v1', kernel, driver);
  const legacyHandlers = createHandlers('/api', kernel, driver);
  const handlers = [...v1Handlers, ...legacyHandlers];

  // Start MSW service worker
  worker = setupWorker(...handlers);
  await worker.start({ onUnhandledRequest: 'bypass' });

  if (import.meta.env.DEV) console.log('[MSW] ObjectStack Runtime ready');
  return kernel;
}

export function stopMockServer() {
  if (worker) {
    worker.stop();
    worker = null;
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
