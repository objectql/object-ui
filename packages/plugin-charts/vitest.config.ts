/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// objectui#5406 — this config is STANDALONE: it does not import the root
// `vitest.config.mts`, so nothing routed a package-cwd run here through the
// invocation guard, the way a root-importing config does as a side effect of
// the import. Without the call below, `cd` into this package and `pnpm exec
// vitest run` executes the suite under a config CI never uses — no
// `@object-ui/*` alias table, a different setup file, no project split — so
// its green says nothing about CI. (Measured on the sibling `plugin-grid`,
// whose config was identical to this one: one such run printed
// `Test Files 1 passed (1)` / `Tests 5 passed (5)` and exited 0.)
//
// Deleting this reopens the hole for this package alone, silently — which is
// why it is enforced rather than written down:
// `scripts/__tests__/vitest-invocation-guard.test.ts` walks every
// `vitest.config.*` in the repo and fails on any that neither imports the root
// config nor calls the guard.
import {
  assertCanonicalVitestInvocation,
  repoRootFrom,
} from '../../scripts/vitest-invocation-guard.mjs';

assertCanonicalVitestInvocation({ repoRoot: repoRootFrom(import.meta.url) });

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
  },
});
