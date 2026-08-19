/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * `objectui check`'s unknown-type warning (objectui#5115).
 *
 * `scripts/__tests__/known-schema-types-derivation-5115.test.ts` pins that the
 * shipped key set equals the registry derivation. This file pins the other
 * half — that the COMMAND actually consults that set, and reports what it
 * finds — over real files in a temporary directory.
 *
 * Fixtures live under `os.tmpdir()`, never in the repo tree: `check()` globs
 * every JSON file under the directory it is handed, so a fixture committed
 * inside this workspace would be scanned by every other run of the command as
 * well — including the repo's own `pnpm check`.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { check, OBJECTUI_SCHEMA_URL } from '../commands/check.js';

let cwd: string;
let lines: string[];
let restoreLog: () => void;

/**
 * Every fixture declares the ObjectUI `$schema` URL, because objectui#5127
 * gated type judgement behind a positive marker: a bare `{"type": ...}` file is
 * not judged at all now. Without the declaration the three warning assertions
 * below would fail and — worse — the two SILENCE assertions would keep passing
 * while measuring nothing, which is the shape of a test that survives the
 * deletion of the feature it covers. The gate is pinned separately, in
 * `check-schema-marker.test.ts`; this file is about the derived key set.
 */
function writeSchema(name: string, body: Record<string, unknown>): void {
  writeFileSync(join(cwd, name), JSON.stringify({ $schema: OBJECTUI_SCHEMA_URL, ...body }));
}

/** Warnings only, with the ANSI colouring chalk may add stripped off. */
function unknownTypeWarnings(): string[] {
  // eslint-disable-next-line no-control-regex -- matching the CSI sequences chalk emits
  const ansi = /\u001b\[[0-9;]*m/g;
  return lines.map((l) => l.replace(ansi, '')).filter((l) => l.includes('Unknown schema type'));
}

beforeEach(() => {
  cwd = mkdtempSync(join(tmpdir(), 'objectui-check-'));
  lines = [];
  const original = console.log;
  console.log = (...args: unknown[]) => {
    lines.push(args.map(String).join(' '));
  };
  restoreLog = () => {
    console.log = original;
  };
});

afterEach(() => {
  restoreLog();
  rmSync(cwd, { recursive: true, force: true });
});

describe('objectui check — unknown schema types', () => {
  it('warns about `crud`, which four declaration faces describe and no renderer registers', async () => {
    // The defect objectui#5115 was filed for: this file passed in silence, and
    // then rendered the OBJUI-001 "Unknown component type" panel in the browser.
    writeSchema('crud-page.json', { type: 'crud', resource: '/api/accounts' });
    await check(cwd);
    expect(unknownTypeWarnings()).toEqual([
      expect.stringContaining('Unknown schema type "crud" in crud-page.json'),
    ]);
  });

  it('warns about `gallery`, whose registered spelling is `object-gallery`', async () => {
    writeSchema('gallery.json', { type: 'gallery' });
    await check(cwd);
    expect(unknownTypeWarnings()).toHaveLength(1);
    expect(unknownTypeWarnings()[0]).toContain('"gallery"');
  });

  it('is silent for registered types the old hand-written list did not carry', async () => {
    // `object-grid` (plugin-grid) and `view:grid` (the namespaced spelling of
    // the same registration) were both reported as unknown before objectui#5115.
    writeSchema('grid.json', { type: 'object-grid', objectApiName: 'account' });
    writeSchema('ns-grid.json', { type: 'view:grid', objectApiName: 'account' });
    writeSchema('gallery-ok.json', { type: 'object-gallery' });
    await check(cwd);
    expect(unknownTypeWarnings()).toEqual([]);
  });

  it('still warns for a type nothing registers', async () => {
    writeSchema('bogus.json', { type: 'totally-made-up-xyz' });
    await check(cwd);
    expect(unknownTypeWarnings()).toHaveLength(1);
  });

  it('reports an unknown type as a warning, never as a failure', async () => {
    // The check cannot know what a user project registers on its own, so an
    // unrecognised type must not fail the run. Pinned because tightening the
    // list would otherwise be free to become a breaking change by accident.
    writeSchema('bogus.json', { type: 'totally-made-up-xyz' });
    await check(cwd);
    expect(lines.some((l) => l.includes('All checks passed'))).toBe(true);
  });
});
