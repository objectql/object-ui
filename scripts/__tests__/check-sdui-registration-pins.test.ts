import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  EXIT_DROPPED,
  EXIT_NO_MEASUREMENT,
  EXIT_OK,
  NEGATIVE_CONTROL_KEY,
  RULED_CONTROLS,
  countChunksCarrying,
  derivePinnedKeys,
  main,
} from '../check-sdui-registration-pins.mjs';

/**
 * objectui#6683. This gate weighs the BUILT console for the registrations a
 * `sideEffects` array promises to keep. `"sideEffects": false` is statically
 * coherent and drops three of them to 0 chunks (measured, objectui#6535), so
 * the artifact question is not answerable from the source — and a gate about an
 * artifact is the easiest kind to make vacuous: point it at a missing `dist/`,
 * or at a matcher that matches everything, and it reports success forever.
 *
 * Both of those are tested here as FAILURES, alongside the ordinary red.
 */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** A fixture root: one array package with one registrar, plus a fake console dist. */
function fixture(chunks: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'objectui-6683-pins-'));
  fs.writeFileSync(path.join(dir, 'pnpm-workspace.yaml'), "packages:\n  - 'packages/*'\n");
  const pkg = path.join(dir, 'packages/pkg');
  fs.mkdirSync(path.join(pkg, 'src'), { recursive: true });
  fs.writeFileSync(
    path.join(pkg, 'package.json'),
    JSON.stringify({
      name: '@fixture/pkg',
      main: './dist/index.js',
      sideEffects: ['./dist/index.js', './src/index.ts'],
    }),
  );
  fs.writeFileSync(
    path.join(pkg, 'src/index.ts'),
    "import { ComponentRegistry } from 'somewhere';\nComponentRegistry.register('fixture:widget', 1);\n",
  );
  const assets = path.join(dir, 'apps/console/dist/assets');
  fs.mkdirSync(assets, { recursive: true });
  for (const [name, code] of Object.entries(chunks)) fs.writeFileSync(path.join(assets, name), code);
  return dir;
}

describe('countChunksCarrying', () => {
  const read = (f: string) => f;

  it('counts each of the three quote spellings a minifier may pick', () => {
    expect(countChunksCarrying(["r.register('a:b',x)"], 'a:b', read)).toBe(1);
    expect(countChunksCarrying(['r.register("a:b",x)'], 'a:b', read)).toBe(1);
    expect(countChunksCarrying(['r.register(`a:b`,x)'], 'a:b', read)).toBe(1);
  });

  it('does NOT count a bare substring', () => {
    // `attachments` is a real registry key AND a word that occurs all over a
    // bundle. A matcher that counted those would report every key present
    // whatever the bundler did — the vacuity this gate cannot afford.
    expect(countChunksCarrying(['const attachmentsPanel = 1;'], 'attachments', read)).toBe(0);
    expect(countChunksCarrying(["x('attachments')"], 'attachments', read)).toBe(1);
  });

  it('counts chunks, not occurrences', () => {
    expect(countChunksCarrying(["'a:b' 'a:b' 'a:b'"], 'a:b', read)).toBe(1);
    expect(countChunksCarrying(["'a:b'", "'a:b'"], 'a:b', read)).toBe(2);
  });
});

describe('the fixture console', () => {
  it('passes when the registration is in a chunk', () => {
    const dir = fixture({ 'index-abc.js': "R.register('fixture:widget',()=>1)" });
    try {
      expect(main([], dir, ['fixture:widget'])).toBe(EXIT_OK);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('fails when the same build no longer carries it', () => {
    // The partner of the case above: identical package, identical derivation,
    // one chunk's content changed. This is the shape `"sideEffects": false`
    // produces — a green build with the registration simply absent.
    const dir = fixture({ 'index-abc.js': 'console.log(1)' });
    try {
      expect(main([], dir, ['fixture:widget'])).toBe(EXIT_DROPPED);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('exits 2 — never 0 — when there is no build to weigh', () => {
    const dir = fixture({});
    fs.rmSync(path.join(dir, 'apps/console/dist'), { recursive: true, force: true });
    try {
      expect(main([], dir, ['fixture:widget'])).toBe(EXIT_NO_MEASUREMENT);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('exits 2 when a pinned control is no longer in the DERIVED set', () => {
    // The floor's own discrimination. `RULED_CONTROLS` is checked against the
    // derivation, so a `sideEffects` array that stopped naming the registering
    // module must not read as "0 keys, all present". Same fixture, a control
    // that nothing registers.
    const dir = fixture({ 'index-abc.js': "R.register('fixture:widget',1)" });
    try {
      expect(main([], dir, ['fixture:widget', 'never:registered'])).toBe(EXIT_NO_MEASUREMENT);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('exits 2 when a chunk carries the negative control, because then the matcher cannot miss', () => {
    const dir = fixture({
      'index-abc.js': `R.register('fixture:widget',1);const s='${NEGATIVE_CONTROL_KEY}';`,
    });
    try {
      expect(main([], dir, ['fixture:widget'])).toBe(EXIT_NO_MEASUREMENT);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('the real workspace', () => {
  it('derives the keys from the arrays, and the ruled controls are among them', () => {
    const { keys, sources, unreadable, modulesRead } = derivePinnedKeys(repoRoot);
    expect(unreadable).toEqual([]);
    expect(modulesRead).toBeGreaterThan(0);
    expect(keys.length, 'an empty key set makes every assertion in this gate vacuous').toBeGreaterThan(0);
    for (const control of RULED_CONTROLS) {
      expect(keys, `${control} is one of the three registrations the 2026-08-29 ruling pins`).toContain(control);
    }
    // The derivation must point at the module it read the key from, or a drop
    // would be reported without saying which array entry promised it.
    expect(sources.get('mcp:connect-agent')).toBe(
      'packages/app-shell/src/console/connect/ConnectAgentWidget.tsx',
    );
  });

  it('keeps RULED_CONTROLS a floor rather than the population', () => {
    // If the two ever coincide, the "derived" set has quietly become the hand
    // list the ruling forbids.
    const { keys } = derivePinnedKeys(repoRoot);
    expect(keys.length).toBeGreaterThan(RULED_CONTROLS.length);
  });

  it('nothing registers the negative control', () => {
    const { keys } = derivePinnedKeys(repoRoot);
    expect(keys).not.toContain(NEGATIVE_CONTROL_KEY);
  });
});
