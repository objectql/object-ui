/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * This package registers its components as a MODULE LOAD SIDE EFFECT, and its
 * manifest has to say so (objectui#3899).
 *
 * `src/index.ts` ends with a bare `try { registerLayout(); } catch {}`, which is
 * the only thing that puts `page-header`, `page:card`, `app-shell`,
 * `responsive-grid`, `navigation-renderer` and `app-schema-renderer` into the
 * `ComponentRegistry`. The manifest used to declare `"sideEffects": false` —
 * a promise to bundlers that no module here does anything on evaluation, so any
 * module whose exports go unused may be dropped whole.
 *
 * Both statements cannot be true. Measured on main@230ffd875 by bundling
 * `import '@object-ui/layout';` (the side-effect-only import, i.e. the
 * documented "import it to register" pattern) with the repo's own bundler:
 *
 *   sideEffects: false  ->  bundle is 0 bytes, zero registrations
 *   this array          ->  bundle keeps all six `ComponentRegistry.register` calls
 *
 * Zero bytes, exit code 0, no warning. The failure surfaces far away as a red
 * `Unknown component type` panel (OBJUI-001) on a green build. Nobody was bitten
 * only because every consumer today also imports a NAMED export, which forces
 * evaluation regardless — coincidence, not design. objectui#3787 hit the hazard
 * and routed around it by calling `registerLayout()` explicitly.
 *
 * ## What this file pins, and what it deliberately does not
 *
 * It pins the MANIFEST as a bundling contract: the declaration keeps naming
 * every module form a bundler can resolve this package to, and a real bundler
 * run confirms each of those forms actually survives a side-effect-only import.
 *
 * The spelling is NOT what the probes are sensitive to, which is worth writing
 * down because it is the natural guess. Measured on vite 8 / rolldown 1.2.1,
 * `./dist/index.js`, `dist/index.js`, `dist/*.js` and `**\/index.js` all match
 * the same file. So a red probe means the path is not covered AT ALL, or the
 * bundler changed how it honours the field — never a leading-`./` nit.
 *
 * It does NOT pin the auto-registration itself. Replacing it with an explicit
 * registration API is a separate, deliberately-not-taken direction (breaking for
 * any consumer relying on load-time registration) that the issue leaves to the
 * maintainer. If that lands, `declaresLoadTimeRegistration` below turns red — on
 * purpose. That test is not defending the side effect, it is defending the
 * INVARIANT: the manifest and the module body must agree. Remove the side effect
 * and the honest manifest is `false` again, so both change together or neither
 * does. A red test here means "update the other half", never "put it back".
 */

import { describe, it, expect } from 'vitest';
import { build } from 'vite';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

/** `packages/layout` — two levels up from `src/__tests__`. */
const PKG_DIR = resolve(__dirname, '../..');
const SRC_DIR = join(PKG_DIR, 'src');

interface Manifest {
  name: string;
  main?: string;
  module?: string;
  sideEffects?: unknown;
  exports?: Record<string, Record<string, string> | string>;
}

const manifest: Manifest = JSON.parse(readFileSync(join(PKG_DIR, 'package.json'), 'utf8'));

/** `"dist/index.js"` and `"./dist/index.js"` name one file; compare on this. */
const normalize = (p: string): string => (p.startsWith('./') ? p.slice(2) : p);

/**
 * Every module path a bundler can resolve `@object-ui/layout` to, derived from
 * the manifest rather than hardcoded — a renamed `fileName` in `vite.config.ts`
 * or a new `exports` subpath then shows up here as a missing declaration instead
 * of drifting silently.
 *
 * `src/index.ts` is in the list even though `files` does not publish it, because
 * two in-repo consumers bundle the source tree directly by alias
 * (`apps/console/vite.config.ts` and `examples/console-starter/vite.config.ts`
 * both map the specifier at `packages/layout/src`), and the bundler reads THIS
 * manifest for those files too — measured, not assumed: with the published
 * paths alone declared, the console's alias shape still produced a 0-byte
 * bundle. Publishing is not the only consumption surface.
 */
function resolvableEntryPaths(): string[] {
  const found = new Set<string>();
  for (const field of [manifest.main, manifest.module]) {
    if (typeof field === 'string') found.add(normalize(field));
  }
  for (const target of Object.values(manifest.exports ?? {})) {
    const conditions = typeof target === 'string' ? { default: target } : target;
    for (const [condition, file] of Object.entries(conditions)) {
      // `types` points at a `.d.ts`; type declarations are erased and never
      // carry a side effect, so they are not a bundling surface.
      if (condition === 'types' || typeof file !== 'string') continue;
      found.add(normalize(file));
    }
  }
  found.add('src/index.ts');
  return [...found].sort();
}

const declaredSideEffects = (): string[] => {
  const declared = manifest.sideEffects;
  expect(
    Array.isArray(declared),
    'packages/layout/package.json must declare `sideEffects` as an ARRAY naming the modules that ' +
      'register components at load time (objectui#3899). `false` is the lie this file exists to catch; ' +
      '`true` would be honest but hands the whole package to every bundler as unshakeable.',
  ).toBe(true);
  return declared as string[];
};

/** The bare specifier the probes resolve, so each probe picks its own target. */
const SPECIFIER = '@object-ui/layout';

/** Marker that only survives if the bundler kept the module body. */
const MARKER = '__objectui_3899_load_time_side_effect__';

/**
 * Bundle `import '@object-ui/layout';` — nothing else, no named import — with
 * `target` supplying the module, and return the emitted code.
 *
 * Every bare specifier except the package under test is external, so the bundle
 * holds this package's own graph and nothing more. `write: false` keeps it in
 * memory; measured at ~250ms cold and ~40ms warm, so this is a real build and
 * still cheap enough to be an ordinary unit test.
 */
async function bundleSideEffectOnlyImport(target: string): Promise<string> {
  const dir = mkdtempSync(join(tmpdir(), 'objectui-3899-entry-'));
  try {
    const entry = join(dir, 'entry.mjs');
    writeFileSync(entry, `import ${JSON.stringify(SPECIFIER)};\n`);

    const result: unknown = await build({
      configFile: false,
      logLevel: 'silent',
      resolve: { alias: { [SPECIFIER]: target } },
      build: {
        write: false,
        minify: false,
        lib: { entry, formats: ['es'], fileName: 'bundle' },
        rollupOptions: {
          external: (id: string) => !/^[./]/.test(id) && !id.startsWith('/') && id !== SPECIFIER,
        },
      },
    });

    const bundles = Array.isArray(result) ? result : [result];
    const output = (bundles[0] as { output?: Array<{ type: string; code?: string }> } | undefined)?.output;
    if (!output) {
      throw new Error(
        'The probe build returned no output. It must produce an in-memory bundle to inspect — a watcher ' +
          'or an empty result means this helper needs updating, not that the assertion below passed.',
      );
    }
    return output
      .filter((chunk) => chunk.type === 'chunk')
      .map((chunk) => chunk.code ?? '')
      .join('\n');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * A copy of this package whose manifest is byte-for-byte the real one except for
 * `sideEffects`, used to run the same probe under a different declaration.
 *
 * Copying rather than mutating the real `package.json`: a test that edits its own
 * package manifest leaves a dirty tree behind when it fails, and two of these run
 * in the same worker.
 *
 * `entryPaths` get a marker module written at exactly the manifest's own relative
 * paths, which is what lets the published `dist/*` forms be probed in an unbuilt
 * worktree. Those probes therefore prove that the DECLARED GLOBS MATCH the
 * published paths in the bundler's matcher — not that `dist` holds the
 * registration. The latter is what `declaresLoadTimeRegistration` (the source
 * side) and the package build (the artifact side) are for.
 */
function mirrorPackage(sideEffects: unknown, entryPaths: string[] = []): string {
  const dir = mkdtempSync(join(tmpdir(), 'objectui-3899-mirror-'));
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ ...manifest, sideEffects }, null, 2));

  for (const rel of entryPaths) {
    const file = join(dir, normalize(rel));
    mkdirSync(dirname(file), { recursive: true });
    // The marker is a global assignment: a side effect no bundler can prove
    // away, so its absence means the MODULE was dropped, never that the
    // statement was optimised out.
    writeFileSync(
      file,
      `globalThis[${JSON.stringify(MARKER)}] = ${JSON.stringify(rel)};\n` +
        (rel.endsWith('.cjs') ? 'module.exports = { unused: 1 };\n' : 'export const unused = 1;\n'),
    );
  }
  return dir;
}

/** The source tree, copied so the same probe can run under a different manifest. */
function mirrorSourceTree(sideEffects: unknown): string {
  const dir = mirrorPackage(sideEffects);
  cpSync(SRC_DIR, join(dir, 'src'), {
    recursive: true,
    filter: (src) => !src.includes('__tests__'),
  });
  return join(dir, 'src');
}

describe('@object-ui/layout declares its load-time registration (objectui#3899)', () => {
  it('names every module form a bundler can resolve, and nothing that is not one', () => {
    const declared = declaredSideEffects().map(normalize);
    const required = resolvableEntryPaths();

    const missing = required.filter((p) => !declared.includes(p));
    expect(
      missing,
      [
        'A module form of @object-ui/layout is not covered by `sideEffects`, so a bundler resolving the',
        'package that way may drop the registration entirely — silently, on a green build (objectui#3899).',
        '',
        'Add each path below to `sideEffects` in packages/layout/package.json, spelled with a leading',
        `"./" to match how \`exports\` spells the same paths: ${missing.join(', ')}`,
      ].join('\n'),
    ).toEqual([]);

    // The other direction. An entry naming nothing real is not harmless: it
    // reads as "this module has side effects" to the next author and makes the
    // list look maintained when it is not.
    const phantom = declared.filter((p) => !required.includes(p));
    expect(
      phantom,
      [
        '`sideEffects` names a path that is not a module form of this package.',
        'If a NEW module genuinely has load-time side effects, teach resolvableEntryPaths() where it',
        'comes from (an `exports` subpath, a build output, a source alias) so the derivation stays the',
        `authority. Otherwise delete it: ${phantom.join(', ')}`,
      ].join('\n'),
    ).toEqual([]);

    // Anti-vacuity: a derivation that silently produced [] would make both
    // assertions above pass over nothing. These are the three forms measured on
    // main@230ffd875 — the ESM and UMD published entries plus the source alias.
    expect(required).toEqual(['dist/index.js', 'dist/index.umd.cjs', 'src/index.ts']);
  });

  it('declaresLoadTimeRegistration: the barrel still registers on evaluation', () => {
    const barrel = readFileSync(join(SRC_DIR, 'index.ts'), 'utf8');

    // A bare `registerLayout()` call at column 0 — module body, not inside the
    // function declaration (whose own body is indented).
    expect(
      /^\s{0,2}registerLayout\(\);/m.test(barrel),
      [
        'src/index.ts no longer calls `registerLayout()` at load time, so the `sideEffects` array in',
        'package.json is now claiming a side effect that does not happen.',
        '',
        'This test does NOT ask for the call back. It asks the two halves to agree: if the registration',
        'became an explicit API the consumer calls (the direction objectui#3899 left to the maintainer),',
        'then the honest manifest is `sideEffects: false` and this file should be deleted with the same',
        'change. What it forbids is exactly one of the two moving.',
      ].join('\n'),
    ).toBe(true);
  });

  it('keeps a side-effect-only import alive through the workspace source alias', async () => {
    // The in-place, real-tree probe: the actual src/, read through the actual
    // manifest, in the shape apps/console and examples/console-starter bundle.
    const code = await bundleSideEffectOnlyImport(SRC_DIR);

    expect(
      code,
      'Bundling `import "@object-ui/layout";` through the workspace src alias dropped the component ' +
        'registrations. This is objectui#3899 exactly: a bundler took the manifest at its word. Check ' +
        'that `sideEffects` names "./src/index.ts".',
    ).toContain('page-header');

    // Every key the barrel registers, so losing all but one cannot pass on the
    // strength of that one. Read out of the source rather than listed here:
    // objectui#3899's own prose named a `sidebar-nav` key that this package has
    // never registered, and a hardcoded list is how that kind of mistake becomes
    // a test asserting a component that does not exist.
    //
    // The parenthetical that used to sit in that sentence — "the SidebarNav
    // component reaches the registry under `navigation-renderer`" — was the same
    // mistake one step further on, and is corrected here (objectui#3999):
    // `SidebarNav` reaches the registry under NO key at all. `navigation-renderer`
    // is a DIFFERENT component in a different file (`NavigationRenderer.tsx`,
    // which never mentions `SidebarNav`); `src/index.ts` imports `SidebarNav`
    // only to re-export it. It is consumed as a plain React component in JSX,
    // which is why nothing below asserts a key for it and why the README
    // documents it as JSX rather than as a JSON node type.
    const registeredKeys = [...readFileSync(join(SRC_DIR, 'index.ts'), 'utf8').matchAll(
      /ComponentRegistry\.register\(\s*'([^']+)'/g,
    )].map((match) => match[1]);

    expect(
      registeredKeys.length,
      'No `ComponentRegistry.register` call found in src/index.ts — the loop below would assert nothing.',
    ).toBeGreaterThanOrEqual(6);

    for (const key of registeredKeys) {
      expect(code, `the \`${key}\` registration must survive a side-effect-only import`).toContain(key);
    }
  });

  it.each(['./dist/index.js', './dist/index.umd.cjs'])(
    'keeps a side-effect-only import alive through the published entry %s',
    async (entryPath) => {
      const mirror = mirrorPackage(manifest.sideEffects, [entryPath]);
      try {
        const code = await bundleSideEffectOnlyImport(join(mirror, normalize(entryPath)));
        expect(
          code,
          `The declared \`sideEffects\` globs do not cover ${entryPath}, so a consumer resolving the ` +
            'published package that way loses the registration. Add the path — this is not a spelling ' +
            'nit: rolldown matches it with or without the leading "./", and through `dist/*.js` too.',
        ).toContain(MARKER);
      } finally {
        rmSync(mirror, { recursive: true, force: true });
      }
    },
  );

  it.each(['./dist/index.js', './dist/index.umd.cjs'])(
    'and the declaration is what keeps it: `sideEffects: false` drops %s',
    async (entryPath) => {
      // The control. Without it every assertion above could be green because the
      // bundler never shakes anything here, and the pin would prove nothing —
      // the exact shape of "green for an empty reason". This is objectui#3899's
      // reverse verification, run every time rather than once by hand.
      const mirror = mirrorPackage(false, [entryPath]);
      try {
        const code = await bundleSideEffectOnlyImport(join(mirror, normalize(entryPath)));
        expect(
          code,
          `A package declaring \`sideEffects: false\` did NOT lose ${entryPath} on a side-effect-only ` +
            'import. The bundler no longer honours the flag the way this pin assumes, so the probes above ' +
            'have stopped measuring anything — fix the probe before trusting them again.',
        ).not.toContain(MARKER);
      } finally {
        rmSync(mirror, { recursive: true, force: true });
      }
    },
  );

  it('and the same control holds for the source tree', async () => {
    const mirrored = mirrorSourceTree(false);
    try {
      const code = await bundleSideEffectOnlyImport(mirrored);
      expect(
        code,
        'A copy of this package declaring `sideEffects: false` kept its registrations, so the source-alias ' +
          'probe above is not measuring the manifest at all.',
      ).not.toContain('page-header');
    } finally {
      rmSync(resolve(mirrored, '..'), { recursive: true, force: true });
    }
  });
});
