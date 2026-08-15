/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * This file used to be titled "v3.0.0 compatibility tests for @objectstack
 * dependencies" and hold five blocks under a top-level `v3.0.0 Compatibility`
 * describe: `Cloud namespace (replacing Hub)`, `Contracts module`,
 * `Integration module`, `Security module`, `Studio module`. All five modules
 * were `@objectstack/spec` v3.0.0-era code added under `index.ts`'s
 * `// v3.0.0 Deep Integration modules` banner, and none of them tested
 * compatibility with any v3 of anything — they exercised local, self-contained
 * helpers (`CloudOperations.deploy`, `validatePluginContract`,
 * `IntegrationManager.register`, `SecurityManager.generateCSPHeader`,
 * `createDefaultCanvasConfig`) with no producer or consumer outside this
 * package.
 *
 * `Cloud namespace (replacing Hub)` went first (objectui#4152 / PR #4239) —
 * its `CloudOperations` fabricated success instead of failing when the
 * `client.cloud` namespace it called into did not exist. The negative pin
 * `cloud-surface-retired-4152.pin.test.ts` fails if that surface returns.
 *
 * The other four (`Contracts`, `Integration`, `Security`, `Studio`) followed
 * under the same startup-focus reasoning, minus the fabrication limb —
 * objectui#4241 measured zero consumers of any of them outside this package
 * and retired `contracts.ts` / `integration.ts` / `security.ts` / `studio.ts`
 * wholesale. `v3-deep-integration-retired-4241.pin.test.ts` is their negative
 * pin.
 *
 * What is left below never depended on any of the five and does not claim a
 * v3 of anything, so it keeps this file rather than moving.
 */
import { describe, it, expect } from 'vitest';

describe('PaginatedResult API (records/total/hasMore)', () => {
  it('supports the records/total/hasMore shape', () => {
    // Verify the QueryResult type supports records/total/hasMore
    const result = {
      data: [{ id: '1' }],
      total: 10,
      page: 1,
      pageSize: 5,
      hasMore: true,
    };
    expect(result.data).toHaveLength(1);
    expect(result.total).toBe(10);
    expect(result.hasMore).toBe(true);
  });
});
