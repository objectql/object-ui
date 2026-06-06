import { defineConfig, devices } from '@playwright/test';

/**
 * LIVE e2e — drives the REAL running stack (console dev server + ObjectStack
 * backend), unlike the default `playwright.config.ts` which serves a mocked
 * production build for blank-page smoke tests.
 *
 * Why a separate config: the interaction-critical widgets (Radix Select +
 * react-hook-form, lookup pickers) cannot be driven by synthetic DOM events —
 * only real browser input (what Playwright dispatches) makes them bind. These
 * tests therefore need an actual browser against an actual backend, and are the
 * canonical way to verify form/submit behaviour end-to-end.
 *
 * Prereqs (not started by this config — they are long-lived dev processes):
 *   - ObjectStack backend on http://localhost:3000  (e.g. `objectstack serve --dev`
 *     from examples/app-showcase)
 *   - Console dev server on http://localhost:5180    (`pnpm --filter @object-ui/console dev`)
 *
 * Run:  pnpm test:e2e:live           (all live specs)
 *       pnpm test:e2e:live --headed  (watch it drive the UI)
 *
 * Override targets via LIVE_APP_URL / LIVE_API_URL / LIVE_EMAIL / LIVE_PASSWORD.
 */
const APP = process.env.LIVE_APP_URL || 'http://localhost:5180';

export default defineConfig({
  testDir: './e2e/live',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  globalSetup: './e2e/live/global-setup.ts',
  use: {
    baseURL: APP,
    storageState: 'e2e/live/.auth/state.json',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
