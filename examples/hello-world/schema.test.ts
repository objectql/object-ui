/**
 * objectui#5236 — `examples/hello-world/schema.json` is the smallest example
 * in the repo, the one a newcomer opens first, and `App.tsx` renders it
 * directly (`import schema from './schema.json'` fed to `SchemaRenderer`).
 * A node whose `type` is not a registered component key renders the
 * OBJUI-001 "Unknown component type" panel instead of the intended UI.
 *
 * This walks every node in the schema and checks its `type` against
 * `KNOWN_SCHEMA_TYPES` — the generated, registration-derived list `objectui
 * check` itself uses (`packages/cli/src/utils/known-schema-types.ts`,
 * objectui#5115) — rather than restating `page`/`card`/`text`/`button` as
 * fossil literals here. That keeps the pin meaningful if the example's node
 * types ever change: it fails on any type this repository does not
 * register, not just on a diff from today's four values.
 */
import { describe, expect, it } from 'vitest';

import { KNOWN_SCHEMA_TYPES } from '../../packages/cli/src/utils/known-schema-types.js';
import schema from './schema.json';

interface SchemaNode {
  type?: unknown;
  children?: unknown;
  [key: string]: unknown;
}

function collectTypes(node: unknown, out: string[]): void {
  if (!node || typeof node !== 'object') return;
  const n = node as SchemaNode;
  if (typeof n.type === 'string') out.push(n.type);
  if (Array.isArray(n.children)) {
    for (const child of n.children) collectTypes(child, out);
  }
}

describe('examples/hello-world schema.json', () => {
  const types: string[] = [];
  collectTypes(schema, types);
  const knownTypes = new Set(KNOWN_SCHEMA_TYPES);

  it('has at least one node to check (fixture sanity)', () => {
    expect(types.length).toBeGreaterThan(0);
  });

  it.each(types)('node type %j is a registered component key', (type) => {
    expect(knownTypes.has(type)).toBe(true);
  });
});
