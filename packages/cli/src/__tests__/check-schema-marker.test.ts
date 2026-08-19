/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * `objectui check`'s positive schema marker (objectui#5127).
 *
 * A root `type` is not evidence that a file is a UI schema — `type` heads at
 * least seven unrelated JSON vocabularies, and the most common of them is
 * `package.json`'s `"type": "module"`. The command judged all of them, so the
 * FIRST line a user saw running it in their own project was a warning about
 * their own package manifest: 45 of the 46 warnings this repository produced
 * were exactly that.
 *
 * Half of this file pins that those files stopped being judged. The OTHER half
 * pins that real schemas are still judged and still warn — a suite that only
 * proved things went quiet would pass a change that deleted the feature, which
 * is the failure mode this gate is one step away from by construction.
 *
 * Fixtures live under `os.tmpdir()`, never in the repo tree: `check()` globs
 * every JSON file under the directory it is handed, so a fixture committed
 * inside this workspace would be scanned by every other run of the command as
 * well — including the repo's own `pnpm check`.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { check, OBJECTUI_SCHEMA_URL } from '../commands/check.js';

let cwd: string;
let lines: string[];
let exitCodes: number[];
let restoreLog: () => void;

function writeSchema(name: string, body: unknown): void {
  writeFileSync(join(cwd, name), JSON.stringify(body));
}

/** Write a fixture verbatim — for JSONC sources, not `JSON.stringify` output. */
function writeRaw(name: string, body: string): void {
  writeFileSync(join(cwd, name), body);
}

/**
 * The CSI sequences chalk may add. The escape byte is built with
 * `String.fromCharCode` rather than spelled into the source, so this file holds
 * no raw control character and no escape a tooling pass could materialise into
 * one (objectui AGENTS.md byte discipline).
 */
const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g');

function plainLines(): string[] {
  return lines.map((l) => l.replace(ANSI, ''));
}

function unknownTypeWarnings(): string[] {
  return plainLines().filter((l) => l.includes('Unknown schema type'));
}

/** The count `check` reports for files it declined to judge, or 0 if silent. */
function skippedCount(): number {
  const line = plainLines().find((l) => l.startsWith('Skipped '));
  if (!line) return 0;
  const match = /^Skipped (\d+) file/.exec(line);
  if (!match) throw new Error(`skip line present but unparseable: ${line}`);
  return Number(match[1]);
}

beforeEach(() => {
  cwd = mkdtempSync(join(tmpdir(), 'objectui-check-marker-'));
  lines = [];
  exitCodes = [];
  const original = console.log;
  console.log = (...args: unknown[]) => {
    lines.push(args.map(String).join(' '));
  };
  // `check()` calls `process.exit(1)` itself; record the call instead of
  // letting it tear the Vitest worker down.
  const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
    exitCodes.push(code ?? 0);
    return undefined as never;
  }) as never);
  restoreLog = () => {
    console.log = original;
    exitSpy.mockRestore();
  };
});

afterEach(() => {
  restoreLog();
  rmSync(cwd, { recursive: true, force: true });
});

describe('objectui check — foreign root-`type` vocabularies are never judged', () => {
  it('says nothing about `package.json`\'s "type": "module" — the card\'s headline symptom', async () => {
    writeSchema('package.json', { name: 'x', version: '1.0.0', type: 'module' });
    await check(cwd);
    expect(unknownTypeWarnings()).toEqual([]);
  });

  it('says nothing about a JSON Schema document', async () => {
    // Two documents, and the SECOND one is the load-bearing half. `object` is
    // itself a registered component key, so a JSON Schema whose root type is
    // `object` was silent before this change too — it would pass here for a
    // reason that has nothing to do with the marker. `array` is not registered,
    // so the array document is one that genuinely warned before.
    //
    // Note the array document carries `items`, which is why `items` is absent
    // from the structural-key set even though ObjectUI nodes use it: a marker
    // key shared with JSON Schema re-admits exactly the files this gate exists
    // to keep out.
    writeSchema('thing.schema.json', {
      $schema: 'http://json-schema.org/draft-07/schema#',
      title: 'Thing',
      type: 'object',
      required: ['id'],
      properties: { id: { type: 'string' } },
    });
    writeSchema('tags.schema.json', {
      $schema: 'http://json-schema.org/draft-07/schema#',
      title: 'Tags',
      type: 'array',
      items: { type: 'string' },
    });
    await check(cwd);
    expect(unknownTypeWarnings()).toEqual([]);
    expect(skippedCount()).toBe(2);
  });

  it('says nothing about a deployment resource descriptor', async () => {
    // The third big root-`type` vocabulary after package manifests and JSON
    // Schema: infrastructure resources. `properties` is deliberately not a
    // marker key, so this file is not admitted by the structural arm.
    writeSchema('bucket.json', {
      type: 'aws:s3/bucket:Bucket',
      properties: { acl: 'private' },
    });
    await check(cwd);
    expect(unknownTypeWarnings()).toEqual([]);
    expect(skippedCount()).toBe(1);
  });

  it('never even sees a dot-prefixed config — those are outside the scan', async () => {
    // `.eslintrc.json` is the obvious fixture for this suite and it would be a
    // PHANTOM: `globSync` does not match dot-prefixed names without `dot: true`,
    // so the file is not scanned at all and an assertion of silence over it
    // holds whatever the marker does. Measured, and it is why this test asserts
    // the scope rather than the marker.
    //
    // The scanned sibling is the counter-probe: without it, "no warnings" here
    // would be indistinguishable from a scan that read nothing.
    writeSchema('.eslintrc.json', { root: true, type: 'totally-made-up-xyz', rules: {} });
    writeSchema('page.json', { type: 'totally-made-up-xyz', children: [] });
    await check(cwd);
    // Exactly one warning, from the scanned file — the dotfile contributed
    // neither a warning nor a skip.
    expect(unknownTypeWarnings()).toEqual([
      expect.stringContaining('Unknown schema type "totally-made-up-xyz" in page.json'),
    ]);
    expect(skippedCount()).toBe(0);
  });

  it('says nothing about a tsconfig-derived file, and does not count it as skipped', async () => {
    // A `tsconfig` carries no root `type` at all, so it was never ELIGIBLE for
    // judgement and must not inflate the skipped count either — that count
    // reports lost coverage, and a file that was never judged is not lost
    // coverage. It is written as real JSONC to keep the objectui#5237 parse
    // arm exercised alongside this one.
    writeRaw(
      'tsconfig.build.json',
      '{\n  // extends the base config\n  "extends": "./tsconfig.json",\n  "compilerOptions": { "outDir": "dist" },\n}\n'
    );
    await check(cwd);
    expect(unknownTypeWarnings()).toEqual([]);
    expect(skippedCount()).toBe(0);
    expect(exitCodes).toEqual([]);
  });

  it('does not judge a foreign file even when its `type` happens to name a real component', async () => {
    // `form` IS a registered component key, so this file was silent before the
    // marker too — but for the wrong reason. Pinning it keeps the gate honest:
    // the file is out of scope, not accidentally acceptable.
    writeSchema('package.json', { name: 'x', type: 'form' });
    await check(cwd);
    expect(unknownTypeWarnings()).toEqual([]);
    expect(skippedCount()).toBe(1);
  });
});

describe('objectui check — a real schema is still judged, by either marker arm', () => {
  it('judges a file that declares the ObjectUI `$schema` URL', async () => {
    writeSchema('leaf.json', {
      $schema: OBJECTUI_SCHEMA_URL,
      type: 'totally-made-up-xyz',
      label: 'Send Email',
    });
    await check(cwd);
    expect(unknownTypeWarnings()).toEqual([
      expect.stringContaining('Unknown schema type "totally-made-up-xyz" in leaf.json'),
    ]);
    expect(skippedCount()).toBe(0);
  });

  it('judges a file carrying a structural key, with no `$schema` at all', async () => {
    writeSchema('page.json', {
      type: 'totally-made-up-xyz',
      children: [{ type: 'text', body: 'hi' }],
    });
    await check(cwd);
    expect(unknownTypeWarnings()).toHaveLength(1);
    expect(unknownTypeWarnings()[0]).toContain('"totally-made-up-xyz"');
  });

  it('stays silent for a REGISTERED type on a judged file — the marker admits, it does not warn', async () => {
    writeSchema('grid.json', { type: 'object-grid', className: 'h-full' });
    writeSchema('ns-grid.json', { $schema: OBJECTUI_SCHEMA_URL, type: 'view:grid' });
    await check(cwd);
    expect(unknownTypeWarnings()).toEqual([]);
    expect(skippedCount()).toBe(0);
  });

  it('accepts the `$schema` URL on any objectui.org host, and rejects a lookalike origin', async () => {
    // The matcher compares the URL's HOST, not a string prefix: the canonical
    // spelling is still awaiting the maintainer's confirmation, and
    // `https://objectui.org.example.com/...` is a different origin that a
    // `startsWith` test would have answered YES for.
    writeSchema('www.json', {
      $schema: 'https://www.objectui.org/schema/v1/objectui.schema.json',
      type: 'totally-made-up-xyz',
    });
    writeSchema('lookalike.json', {
      $schema: 'https://objectui.org.example.com/schema.json',
      type: 'totally-made-up-xyz',
    });
    await check(cwd);
    expect(unknownTypeWarnings()).toEqual([
      expect.stringContaining('Unknown schema type "totally-made-up-xyz" in www.json'),
    ]);
    expect(skippedCount()).toBe(1);
  });

  it('does not treat a non-URL `$schema` value as an ObjectUI declaration', async () => {
    writeSchema('relative.json', { $schema: './objectui-schema.json', type: 'totally-made-up-xyz' });
    await check(cwd);
    expect(unknownTypeWarnings()).toEqual([]);
    expect(skippedCount()).toBe(1);
  });
});

describe('objectui check — the narrowed judgement surface is never silent (option D)', () => {
  it('reports how many eligible files went unjudged, and how to opt one in', async () => {
    writeSchema('package.json', { name: 'x', type: 'module' });
    // The two leaves are the majority shape of the real in-repo corpus: a
    // single node with no structural key, which is precisely the coverage this
    // interim gives up and which this count keeps visible.
    writeSchema('leaf-1.json', { type: 'button', label: 'Send Email', icon: 'mail' });
    writeSchema('leaf-2.json', { type: 'badge', variant: 'default' });
    await check(cwd);
    // Two leaves plus the manifest: three files had a root `type` string and
    // no marker.
    expect(skippedCount()).toBe(3);
    const hint = plainLines().find((l) => l.includes('A file is checked when it declares'));
    expect(hint).toBeDefined();
    expect(hint).toContain(OBJECTUI_SCHEMA_URL);
  });

  it('says nothing when every eligible file carried a marker', async () => {
    writeSchema('page.json', { type: 'card', children: [] });
    await check(cwd);
    expect(skippedCount()).toBe(0);
    expect(plainLines().some((l) => l.startsWith('Skipped '))).toBe(false);
  });

  it('is a report, not a failure — the run still passes', async () => {
    writeSchema('package.json', { name: 'x', type: 'module' });
    await check(cwd);
    expect(skippedCount()).toBe(1);
    expect(plainLines().some((l) => l.includes('All checks passed'))).toBe(true);
    expect(exitCodes).toEqual([]);
  });
});

describe('objectui check — the marker gate did not disturb the parse arm', () => {
  it('still counts malformed JSON as an error and still exits 1', async () => {
    writeRaw('broken.json', '{ "type": "card", "children": [ }');
    await check(cwd);
    expect(plainLines().some((l) => l.includes('Invalid JSON in broken.json'))).toBe(true);
    expect(plainLines().some((l) => l.includes('Found 1 errors'))).toBe(true);
    expect(exitCodes).toEqual([1]);
  });
});
