/**
 * Shared Kernel Factory for MSW Mock Environment
 *
 * Creates a fully bootstrapped ObjectStack kernel for use in both
 * browser (MSW setupWorker) and test (MSW setupServer) environments.
 *
 * Follows the same pattern as @objectstack/studio's createKernel —
 * see https://github.com/objectstack-ai/spec
 */

import { ObjectKernel, DriverPlugin, AppPlugin } from '@objectstack/runtime';
import { ObjectQLPlugin } from '@objectstack/objectql';
import { InMemoryDriver } from '@objectstack/driver-memory';

export interface KernelOptions {
  /** Application configuration (defineStack output) */
  appConfig: any;
  /** Whether to skip system validation (useful in browser) */
  skipSystemValidation?: boolean;
}

export interface KernelResult {
  kernel: ObjectKernel;
  driver: InMemoryDriver;
}

/**
 * Create and bootstrap an ObjectStack kernel with in-memory driver.
 *
 * This is the single factory used by both browser.ts and server.ts
 * so that kernel setup logic is not duplicated.
 */
export async function createKernel(options: KernelOptions): Promise<KernelResult> {
  const { appConfig, skipSystemValidation = true } = options;

  const driver = new InMemoryDriver();

  const kernel = new ObjectKernel({
    skipSystemValidation
  });

  await kernel.use(new ObjectQLPlugin());
  await kernel.use(new DriverPlugin(driver, 'memory'));
  await kernel.use(new AppPlugin(appConfig));

  await kernel.bootstrap();

  return { kernel, driver };
}
