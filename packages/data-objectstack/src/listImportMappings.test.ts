/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ObjectStackAdapter, clearSharedDiscoveryCache } from './index';

/**
 * `listImportMappings(objectName)` feeds the import wizard's "saved mapping"
 * selector (framework #2611). The selector is FEATURE-DETECTED: an empty list
 * hides it, and the adapter deliberately degrades every failure to an empty
 * list — so a filter reading the wrong depth of the served item would not
 * fail anywhere; it would just make the selector never appear, on every
 * deployment, silently (objectui#14026).
 *
 * This pin therefore does not stub the SDK. The `fetch` stub answers the
 * discovery probe and `GET /api/v1/meta/mapping` with the body the framework's
 * REST list door was MEASURED to emit — `RestServer`'s `GET /meta/:type`
 * driven by a real `ObjectStackProtocolImplementation` over a registered
 * `mapping` artifact (objectstack `packages/rest`, probe run 2026-09-05):
 * raw spec documents decorated with `_packageId` / `_provenance` /
 * `_diagnostics`, carrying `targetObject` at the TOP LEVEL, inside the spec's
 * `{ type, items }` envelope with no `{ success, data }` wrapper. The real
 * `@objectstack/client` `meta.getItems` then unwraps it, and the adapter's
 * own filter runs on what the SDK hands back.
 */

/** Verbatim `GET /api/v1/meta/mapping` body from the framework probe. */
const WIRE_BODY = {
  type: 'mapping',
  items: [
    {
      name: 'task_feed_import',
      label: 'Task feed import (manifest path)',
      sourceFormat: 'csv',
      targetObject: 'task',
      fieldMapping: [
        { source: 'ID', target: 'id', transform: 'none' },
        { source: 'Task Title', target: 'title', transform: 'none' },
      ],
      mode: 'upsert',
      upsertKey: ['id'],
      _packageId: 'probe_pkg',
      _provenance: 'package',
      _diagnostics: { valid: true },
    },
    {
      name: 'user_only_mapping',
      label: 'User feed import',
      sourceFormat: 'json',
      targetObject: 'user',
      fieldMapping: [{ source: 'id', target: 'id', transform: 'none' }],
      mode: 'insert',
      _diagnostics: { valid: true },
    },
  ],
};

const BASE_URL = 'http://list-import-mappings-pin.local';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function makeDS() {
  const requested: string[] = [];
  const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    requested.push(url);
    if (url.endsWith('/api/v1/discovery')) {
      return json({ success: true, data: { capabilities: {}, routes: {} } });
    }
    if (url.endsWith('/api/v1/meta/mapping')) {
      return json(WIRE_BODY);
    }
    return json({ success: false, error: { code: 'NOT_FOUND', message: `unexpected ${url}` } }, 404);
  });
  const ds = new ObjectStackAdapter({ baseUrl: BASE_URL, fetch: fetchImpl, autoReconnect: false });
  return { ds, requested };
}

describe('ObjectStackDataSource.listImportMappings (objectui#14026)', () => {
  beforeEach(() => {
    clearSharedDiscoveryCache();
  });

  it('returns a registered mapping artifact targeting the object, read through the real SDK', async () => {
    const { ds, requested } = makeDS();

    const mappings = await ds.listImportMappings('task');

    // The SDK route the adapter reads — not a stubbed client method.
    expect(requested).toContain(`${BASE_URL}/api/v1/meta/mapping`);
    // The artifact targeting `task` is served; the one targeting `user` is not.
    expect(mappings.map((m: any) => m.name)).toEqual(['task_feed_import']);
    // …and it is the served document itself, decorations included, so the
    // wizard's `asSavedMapping` predicate (`name` string, `targetObject`
    // string, `fieldMapping` array) accepts it as-is.
    const [m] = mappings;
    expect(typeof m.name).toBe('string');
    expect(m.targetObject).toBe('task');
    expect(Array.isArray(m.fieldMapping)).toBe(true);
    expect(m.mode).toBe('upsert');
    expect(m.upsertKey).toEqual(['id']);
  });

  it('answers an empty list, not a match, for an object no artifact targets', async () => {
    const { ds } = makeDS();
    expect(await ds.listImportMappings('project')).toEqual([]);
  });
});
