import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Plain-JS CI helpers. Types are INFERRED from the .mjs sources by
// `tsconfig.scripts.json` (`allowJs`) — see objectui#3494 and that file's header.
import { specShapeKeys, ExtractionError } from '../check-action-forward-parity.mjs';
import { schemaAcceptSet } from '../check-designer-field-key-parity.mjs';

/**
 * objectui#6923 — the counter-example the ruling asks for, in the shape it asks
 * for it.
 *
 * ## What was consolidated, and what deliberately was not
 *
 * One literal Zod wrapper-key list — `['in', 'out', 'innerType', 'schema',
 * 'left', 'right']` — had five copies: three TypeScript test files and two
 * `.mjs` CI gates. The copies spanned a language boundary, so the
 * objectui#5872 class-(1) pattern (consolidate onto `@object-ui/test-support`)
 * was unavailable: that package's `exports["."]` is TypeScript SOURCE, and a
 * bare `node scripts/check-*.mjs` cannot import it.
 *
 * The 2026-08-31 ruling gave the DATA a build-free home
 * (`packages/test-support/src/zod-wrapper-keys.json`, reachable as
 * `@object-ui/test-support/zod-wrapper-keys`) and drew an explicit boundary
 * around it: the WALKS stay with their callers. They are not even identical —
 * the designer gate reads `node._def ?? node.def ?? node._zod?.def` where the
 * action gate reads `s._def ?? s.def` — and unifying THOSE needs its own ruling.
 * So this file tests the two walks THROUGH THEIR OWN PUBLIC ENTRY POINTS rather
 * than testing a shared function, because there is no shared function.
 *
 * ## Why "both sides import the same list" is not the test
 *
 * That assertion passes just as well when the list is EMPTY. And an empty list
 * is precisely the failure this family has already been measured producing: on
 * an empty vocabulary in PR #6047's ablation, the "spec accepts a name we do not
 * implement" half of three of four parity gates stayed GREEN, because it filters
 * an empty list. A gate that silently stops matching is that failure with CI's
 * authority behind it.
 *
 * So the ruling's constraint 4 is what this file pays: **empty the list and the
 * gate must go red.** Two halves, and the second is what makes it true:
 *
 *   1. every key in the list is LOAD-BEARING — one fixture per key, reachable
 *      only through that key, driven through each gate's real entry point. Empty
 *      the list, or delete any single entry, and these fail by name;
 *   2. an unlisted wrapper spelling is LOUD — `ExtractionError`, never a clean
 *      empty verdict. That is the drift scenario itself: Zod moves a spelling,
 *      the list stops matching, and the gate must say so rather than derive an
 *      empty vocabulary and pass everything.
 *
 * ## Why fixtures and not the installed spec
 *
 * Measured against `@objectstack/spec@17.2.0` while writing this: with the
 * wrapper list emptied, `ui.ActionSchema` and `automation.FlowNodeSchema` become
 * unreachable (the walk returns null — the gates raise), but `data.FieldSchema`
 * and `data.ObjectSchema` still resolve 71 and 42 keys, because those two expose
 * `.shape` at depth 0 and never need a wrapper hop at all.
 *
 * A counter-test anchored on the installed schemas would therefore be VACUOUS
 * for the designer gate today, and could go vacuous for the others the next time
 * upstream unwraps something — silently, which is the whole complaint. Fixtures
 * cannot rot that way: this file constructs nodes whose shape is reachable ONLY
 * through the wrapper key under test, so the discrimination is guaranteed by
 * construction rather than borrowed from a dependency.
 */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DATA_FILE = path.join(repoRoot, 'packages/test-support/src/zod-wrapper-keys.json');

/** The list as it sits on disk — the bytes both language sides resolve to. */
const onDisk: string[] = JSON.parse(readFileSync(DATA_FILE, 'utf8'));

/**
 * A node whose object shape is reachable ONLY by stepping through `key`.
 *
 * `shape` is deliberately not at the top level and not on `_def` directly: both
 * walks check those first and would answer without consulting the vocabulary at
 * all, which would make every assertion below pass with the list emptied.
 */
const wrappedIn = (key: string) => ({ _def: { [key]: { shape: { alpha: 1, beta: 2 } } } });

const SHAPE_KEYS = ['alpha', 'beta'];

describe('the shared Zod wrapper-key list (objectui#6923)', () => {
  it('is a non-empty list of strings', () => {
    expect(Array.isArray(onDisk)).toBe(true);
    expect(onDisk.length).toBeGreaterThan(0);
    expect(onDisk.every((k) => typeof k === 'string' && k.length > 0)).toBe(true);
  });

  it('still carries every spelling the five former hand copies walked', () => {
    // The membership the copies agreed on the day they were consolidated.
    // Growing this list is expected; SHRINKING it is the drift, and the
    // load-bearing tests below are what make a shrink fail rather than go quiet.
    expect(onDisk).toEqual(['in', 'out', 'innerType', 'schema', 'left', 'right']);
  });

  it('is what the package `exports` subpath resolves to, so `node` reads these bytes', () => {
    const manifest = JSON.parse(
      readFileSync(path.join(repoRoot, 'packages/test-support/package.json'), 'utf8'),
    );
    // The mechanism the ruling named: a subpath pointing straight at the data
    // file, so a bare-node gate resolves it without a build step. If this moves,
    // the two `.mjs` gates stop resolving and CI says so — but it says so as a
    // module-not-found deep in a gate run, which is a poor way to learn it.
    expect(manifest.exports['./zod-wrapper-keys']).toBe('./src/zod-wrapper-keys.json');
    expect(manifest.private).toBe(true);
  });
});

describe('constraint 4 — emptying the list must turn the gates RED, not quiet', () => {
  describe('check-action-forward-parity.mjs', () => {
    it.each(onDisk)('resolves a shape reachable only through `%s`', (key) => {
      expect(specShapeKeys(wrappedIn(key), 'fixture')).toEqual(SHAPE_KEYS);
    });

    it('raises on a wrapper spelling the list does not carry', () => {
      // Not `toThrow()` alone: the gate's own error type is the contract, and a
      // bare throw would be satisfied by any incidental TypeError.
      expect(() => specShapeKeys(wrappedIn('bogusWrapper'), 'fixture')).toThrow(ExtractionError);
      expect(() => specShapeKeys(wrappedIn('bogusWrapper'), 'fixture')).toThrow(
        /could not resolve `fixture`'s shape/,
      );
    });
  });

  describe('check-designer-field-key-parity.mjs', () => {
    // Reached through the gate's own `importSpec` seam, so the walk under test
    // is the one the gate really runs — this gate keeps its walk module-private
    // and the ruling's boundary says to leave it there.
    const acceptSetFor = (node: unknown) =>
      schemaAcceptSet('FieldSchema', async () => ({ FieldSchema: node }));

    it.each(onDisk)('resolves a shape reachable only through `%s`', async (key) => {
      const { accept } = await acceptSetFor(wrappedIn(key));
      expect([...accept]).toEqual(SHAPE_KEYS);
    });

    it('raises on a wrapper spelling the list does not carry', async () => {
      await expect(acceptSetFor(wrappedIn('bogusWrapper'))).rejects.toThrow(
        /could not resolve `FieldSchema`'s shape/,
      );
    });
  });
});
