#!/usr/bin/env node
// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * The live-e2e backend's `better-auth` pin: it writes the override, and it
 * refuses to let the override fail quietly.
 *
 *   node e2e/live/ci/better-auth-pin.mjs overrides VERSION
 *   node e2e/live/ci/better-auth-pin.mjs verify APP_DIR VERSION
 *
 * Exit: 0 = the pinned world matches reality
 *       1 = it does not, named by which of the three ways it stopped matching
 *
 * ## Why the pin exists (objectstack#16186)
 *
 * `@objectstack/plugin-auth` imports `createLocalAccountIssuer` from
 * `@better-auth/core/db` and declares `@better-auth/core` with a CARET range
 * (`^1.7.1` at 17.2.0, `^1.7.2` at 17.3.0). `@better-auth/core@1.7.3` REMOVED
 * that public export — in a patch release, upstream better-auth#10909 — and
 * 1.7.3 is both the top of the published `1.7.x` set and `latest`, so every
 * caret in the family floats onto it and no range in the published manifest can
 * protect against it. Measured in this lane's own install path: the import dies
 * with `SyntaxError: The requested module '@better-auth/core/db' does not
 * provide an export named 'createLocalAccountIssuer'`.
 *
 * What that costs is not one plugin. AuthPlugin fails to load, `auth` is
 * reported as a missing core service, no `sys_*` table is ever created, the
 * seeded sign-in never answers, and `start-backend.sh` times out at 300s — so
 * the console is never built, Playwright never runs, and the lane's whole
 * product (a console x published-backend integration reading) is lost on every
 * PR. The backend does not refuse to start, which is the confusing part: it
 * binds the port, loads 42 plugins and prints `Server is ready` while auth is
 * absent (objectui#8084).
 *
 * ⛔ The pin is NOT a repair of `OBJECTSTACK_VERSION` / `OBJECTSTACK_REF`.
 * objectui#7689's triage forbids repairing this lane by moving those, and this
 * does not move them. It pins a TRANSITIVE dependency of the published artifact
 * to the version that artifact's own manifest was authored against, restoring
 * the resolution the publisher intended. When objectstack#16186 lands upstream
 * — plugin-auth pinning `@better-auth/core` itself, or moving off the removed
 * export — this file and the `BETTER_AUTH_VERSION` key in `backend.env` should
 * be deleted in the same PR that bumps `OBJECTSTACK_VERSION` past the fix.
 *
 * ## Why `verify` exists, and why it runs on EVERY start
 *
 * Pinning a dependency to make a red lane green is a gate weakening, and it was
 * taken deliberately (objectui#8084) on ONE condition: quieting the red must not
 * quiet the information. A pin that stops applying must be LOUD, because the
 * thing it decays into is precisely the outcome the lane exists to detect, minus
 * the explanation — a 300-second timeout with no stated cause.
 *
 * Three ways the pinned world can stop matching reality, and this file names
 * which one it is rather than reporting a single undifferentiated failure:
 *
 *   PIN-NOT-DECLARED   the `overrides` block never reached the manifest npm
 *                      installed from. The classic silent failure: `overrides`
 *                      is npm's spelling, `pnpm.overrides` is pnpm's, and each
 *                      is INERT under the other package manager — no warning,
 *                      no error, exit 0, a fully resolved tree that ignored the
 *                      pin. This lane installs with `npm install`, so the npm
 *                      spelling is the load-bearing one.
 *   PIN-NOT-RESOLVED   the override was declared and the installed tree does
 *                      not match it anyway (a stale cached fixture reused
 *                      across a pin change, a nested copy npm declined to
 *                      dedupe, a hand-edited manifest).
 *   EXPORT-MISSING     the pinned version installed cleanly and the export the
 *                      auth plugin needs is still not there. This is the check
 *                      that survives the other two being satisfiable by a
 *                      version number alone: it asks the question the plugin
 *                      asks, with the resolver the plugin uses.
 *
 * ⚠️ EXPORT-MISSING is a CANARY, not a contract. It probes the one named import
 * that broke. If `@objectstack/plugin-auth` grows a second import that a future
 * `@better-auth/*` drops, this will not see it — the 300s readiness timeout
 * will, in the way it always did. Widen `REQUIRED_IMPORTS` when that happens.
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/**
 * The packages the override pins, and the ONE list both halves of this file
 * read — `overrides` writes exactly these names, `verify` checks exactly these
 * names. Two lists would be a drift the lane could not see: pinning a name
 * nothing checks, or checking a name nothing pins, both read as green.
 *
 * MEASURED against this lane's own install path at `@objectstack/*@17.2.0`
 * rather than copied from the upstream workaround — every name below really is
 * in the installed tree, all ten of them resolving to 1.7.3 before the pin:
 *
 *   node_modules/@better-auth/{core,drizzle-adapter,kysely-adapter,
 *     memory-adapter,mongo-adapter,prisma-adapter,telemetry}
 *   node_modules/@objectstack/plugin-auth/node_modules/{better-auth,
 *     @better-auth/oauth-provider,@better-auth/sso}
 *
 * ⛔ TWO deliberate exclusions, each of which would be a bug to "fix" by adding:
 *
 *   `@better-auth/scim` — present, but `@objectstack/plugin-auth@17.2.0` pins it
 *   EXACTLY at `1.7.0-rc.1`, not with a caret. It is therefore not floating,
 *   it is not what broke, and overriding it to 1.7.2 would OVERRIDE THE
 *   PUBLISHER rather than restore their intent — the opposite of this pin's
 *   whole justification. The upstream workaround lists it; this lane measured
 *   its own tree and left it alone.
 *
 *   `@better-auth/utils` — present at 0.4.2 and 0.5.0. A separate version line
 *   that never had a 1.7.x, so pinning it to 1.7.2 would fail the install.
 */
const FAMILY = [
  'better-auth',
  '@better-auth/core',
  '@better-auth/drizzle-adapter',
  '@better-auth/kysely-adapter',
  '@better-auth/memory-adapter',
  '@better-auth/mongo-adapter',
  '@better-auth/oauth-provider',
  '@better-auth/prisma-adapter',
  '@better-auth/sso',
  '@better-auth/telemetry',
];

/**
 * The named imports EXPORT-MISSING probes, as `[specifier, name]`. Exactly the
 * one that broke; see the canary note in the header before adding to it.
 */
const REQUIRED_IMPORTS = [['@better-auth/core/db', 'createLocalAccountIssuer']];

/** The package whose absence makes the whole pin pointless. */
const KEYSTONE = '@better-auth/core';

const ISSUE = 'objectstack#16186 (downstream: objectui#8084)';

/** `overrides` object for the app manifest, in npm's top-level spelling. */
function overridesFor(version) {
  const out = {};
  for (const name of FAMILY) out[name] = version;
  return out;
}

function die(tag, lines) {
  console.error(`[better-auth-pin] FAIL ${tag}`);
  for (const line of lines) console.error(`[better-auth-pin]   ${line}`);
  console.error(`[better-auth-pin]   root cause: ${ISSUE}`);
  process.exit(1);
}

/**
 * Every installed copy of a FAMILY package under `dir`, nested ones included.
 *
 * Walks `node_modules` by hand rather than shelling out to `npm ls`: the answer
 * must be about what is ON DISK, which is the thing a restored cache can make
 * disagree with any manifest.
 */
function installedCopies(appDir) {
  const found = [];
  const walk = (nodeModules) => {
    let entries;
    try {
      entries = fs.readdirSync(nodeModules, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
      const dirs = entry.name.startsWith('@')
        ? fs
            .readdirSync(path.join(nodeModules, entry.name), { withFileTypes: true })
            .filter((e) => e.isDirectory())
            .map((e) => path.join(nodeModules, entry.name, e.name))
        : [path.join(nodeModules, entry.name)];
      for (const pkgDir of dirs) {
        const manifest = path.join(pkgDir, 'package.json');
        if (fs.existsSync(manifest)) {
          try {
            const pkg = JSON.parse(fs.readFileSync(manifest, 'utf8'));
            if (FAMILY.includes(pkg.name)) {
              found.push({ name: pkg.name, version: pkg.version, dir: path.relative(appDir, pkgDir) });
            }
          } catch {
            /* an unreadable manifest is npm's business, not this gate's */
          }
        }
        walk(path.join(pkgDir, 'node_modules'));
      }
    }
  };
  walk(path.join(appDir, 'node_modules'));
  return found;
}

function verify(appDir, version) {
  // ── PIN-NOT-DECLARED ────────────────────────────────────────────────────
  const manifestPath = path.join(appDir, 'package.json');
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (error) {
    die('(PIN-NOT-DECLARED)', [
      `could not read ${manifestPath}: ${error.message}`,
      'start-backend.sh rewrites this manifest before installing; if it is not there,',
      'the prepare step did not run or did not finish.',
    ]);
  }
  const declared = manifest.overrides || {};
  const wrong = FAMILY.filter((name) => declared[name] !== version);
  if (wrong.length > 0) {
    die('(PIN-NOT-DECLARED)', [
      `${path.relative(appDir, manifestPath) || 'package.json'} does not declare the whole family at ${version}.`,
      ...wrong.map((name) => `  ${name}: declared ${JSON.stringify(declared[name] ?? null)}, want ${JSON.stringify(version)}`),
      manifest.pnpm && manifest.pnpm.overrides
        ? 'NOTE: a `pnpm.overrides` block IS present. This app is installed with `npm install`,'
        : 'The npm spelling is the top-level `overrides` key. `pnpm.overrides` is inert here:',
      'npm reads `overrides`, pnpm reads `pnpm.overrides`, and each ignores the other silently.',
    ]);
  }

  // ── PIN-NOT-RESOLVED ────────────────────────────────────────────────────
  const copies = installedCopies(appDir);
  // A zero-hit "everything matches" is not a reading. If the keystone is not
  // installed at all, the loop below would pass over an empty set and this
  // whole gate would be decorative.
  if (!copies.some((c) => c.name === KEYSTONE)) {
    die('(PIN-NOT-RESOLVED)', [
      `no copy of ${KEYSTONE} is installed under ${appDir}/node_modules.`,
      `That is either a broken install, or ${KEYSTONE} is no longer a dependency of`,
      '@objectstack/plugin-auth at this OBJECTSTACK_VERSION. If it is the latter, the pin and',
      'this guard have outlived their purpose: delete BETTER_AUTH_VERSION from backend.env and',
      'delete this file, deliberately and in one PR. Do not leave a pin that pins nothing.',
    ]);
  }
  const drifted = copies.filter((c) => c.version !== version);
  if (drifted.length > 0) {
    die('(PIN-NOT-RESOLVED)', [
      `the override is declared at ${version} but the installed tree does not match it:`,
      ...drifted.map((c) => `  ${c.name}@${c.version}  at ${c.dir}`),
      'A restored fixture cache is the likeliest cause — the cache key is the hash of',
      'backend.env, so a pin change must change that file, and start-backend.sh must not',
      'reuse a stamped fixture across it.',
    ]);
  }

  // ── EXPORT-MISSING ──────────────────────────────────────────────────────
  // Asked with the resolver the plugin itself uses: a real ESM named import,
  // resolved from the app directory. `--input-type=module -e` takes its
  // resolution base from the cwd, so bare specifiers hit this app's tree.
  for (const [specifier, name] of REQUIRED_IMPORTS) {
    const probe = `import { ${name} } from '${specifier}'; if (typeof ${name} === 'undefined') { console.error('bound but undefined'); process.exit(3); }`;
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', probe], {
      cwd: appDir,
      encoding: 'utf8',
    });
    if (result.status !== 0) {
      die('(EXPORT-MISSING)', [
        `${specifier} does not provide a usable export named '${name}',`,
        `even though the family installed cleanly at ${version}.`,
        'This is the exact import @objectstack/plugin-auth makes; when it fails, AuthPlugin does',
        'not load, no sys_* table is created, the seeded sign-in never answers, and this lane',
        'times out after 300s having produced no Playwright run at all.',
        `node exited ${result.status}:`,
        ...String(result.stderr || '')
          .trim()
          .split('\n')
          .slice(0, 6)
          .map((l) => `  ${l}`),
        `A NEW version pin will not necessarily fix this — check whether ${ISSUE} has landed`,
        'upstream, and if it has, retire this pin instead of moving it.',
      ]);
    }
  }

  const shown = copies.map((c) => `${c.name}@${c.version}`).sort();
  console.log(
    `[better-auth-pin] ok: ${copies.length} installed copies pinned at ${version}, ` +
      `${REQUIRED_IMPORTS.length} required import(s) resolved`,
  );
  console.log(`[better-auth-pin]   ${shown.join(', ')}`);
}

const [command, ...rest] = process.argv.slice(2);

if (command === 'overrides') {
  const version = rest[0];
  if (!version) {
    console.error('usage: better-auth-pin.mjs overrides VERSION');
    process.exit(2);
  }
  process.stdout.write(JSON.stringify(overridesFor(version)));
} else if (command === 'verify') {
  const [appDir, version] = rest;
  if (!appDir || !version) {
    console.error('usage: better-auth-pin.mjs verify APP_DIR VERSION');
    process.exit(2);
  }
  verify(path.resolve(appDir), version);
} else {
  console.error('usage: better-auth-pin.mjs overrides VERSION | verify APP_DIR VERSION');
  process.exit(2);
}
