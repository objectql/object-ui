/**
 * Main Entry Point
 *
 * Renders the React application.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { App } from './App';
import { I18nProvider } from '@object-ui/i18n';
import { MobileProvider, generatePWAManifest } from '@object-ui/mobile';
import { registerPlaceholders } from '@object-ui/components';
import { initSentry, initRuntimeConfig, getProductName, getProductShortName, getFaviconUrl, getPwaDescription, getPwaThemeColor } from '@object-ui/app-shell';
import { loadLanguage } from './loadLanguage';
import { loadLocales } from './loadLocales';
import { seedTenantLanguage } from './languageSeed';
import { preflightAuth } from './lib/auth-preflight';

const AUTH_URL = `${import.meta.env.VITE_SERVER_URL || ''}/api/v1/auth`;

// ────────────────────────────────────────────────────────────────────────────
// Plugin registration
// ────────────────────────────────────────────────────────────────────────────
//
// The SDUI block layer (eager core views + lazy heavy plugins) lives in its own
// module so it can be imported without booting the app — the public-contract
// test and the manifest dump both read the REAL list from there rather than
// keeping a copy that can drift (objectui#2953).
import './register-plugins';

// Register `developer:*` component refs.
import './registerDeveloperComponents';

// Register `studio:*` component refs (the application-builder entry).
import './registerStudioComponents';

// Register `account:*` component refs (My Profile, etc.).
import './registerAccountComponents';

// Register `approvals:*` component refs (the Approvals Inbox entry).
import './registerApprovalsComponents';

// (Per-type metadata-admin override for `object` was removed: the
// `object` type now uses the same generic ResourceListPage as every
// other metadata type for visual consistency. The visual ObjectManager
// designer is still available from the object's edit page preview.)

// Register placeholder fallbacks for any protocol-defined component types
// that don't yet have a real renderer (e.g. ai:chat_window). Must run AFTER
// all real plugin registrations above so it only fills the gaps and never
// shadows a registered renderer.
registerPlaceholders();

// Resolve server-pushed runtime config + drop stale Bearer tokens BEFORE
// React mounts. `initRuntimeConfig()` populates the singleton consumed by
// marketplace + install code paths (cloud URL, capability flags) — without
// it the SPA would fall back to defaults on first paint and hit 404s.
// Both kicks are awaited so first paint sees definitive values, but each
// one absorbs its own failures so a missing endpoint never blocks boot.
// `index.html`'s pre-boot branding script resolves this SAME variable through
// Vite's HTML env substitution, so both callers build one `/api/v1/runtime/config`
// URL and share one request instead of asking two servers (objectui#5660).
// Change the spelling here and that script has to change with it;
// `src/__tests__/runtimeConfigBootDedup.test.ts` fails when the two stop agreeing.
const SERVER_BASE = (import.meta.env.VITE_SERVER_URL || '').replace(/\/+$/, '');
// The third entry seeds the UI language from the tenant's server-side locale
// (objectui#4035). It joins this existing gate rather than adding one of its
// own, which is what keeps it off the critical path: it runs CONCURRENTLY with
// the two round-trips above, is bounded at ~500ms, absorbs every failure, and
// short-circuits to a no-op on every boot except a device's true first visit
// (any later boot reads its answer synchronously out of the seed cache).
Promise.all([
  initRuntimeConfig(SERVER_BASE),
  preflightAuth(AUTH_URL),
  seedTenantLanguage(SERVER_BASE),
]).finally(() => {
  // Kick off Sentry init (no-op unless a DSN was injected at build time AND
  // this runtime granted `telemetry.allowClientErrorReporting`). Still not
  // awaited — observability must never block first paint.
  //
  // ⛔ Ordering is load-bearing, not stylistic: this call used to run at
  // module-eval time, BEFORE `initRuntimeConfig()` was even started. The
  // server-pushed telemetry permission fails closed, so from there it would
  // read DENIED on every boot and memoize that verdict — turning the switch
  // objectui#5522 asked for into a permanent removal, silently, including for
  // the hosted console. Reading a server value requires waiting for the
  // server. `.finally()` (not `.then()`) keeps the pre-existing guarantee that
  // a failed config fetch never blocks boot — and on that path the permission
  // is denied, so the failure direction is silence.
  void initSentry();

  // Apply runtime branding before React mounts — avoids a flash of the
  // static defaults for operators who configure OS_PRODUCT_NAME etc.
  document.title = getProductName();

  // Inject dynamic favicon if the operator configured one.
  const faviconUrl = getFaviconUrl();
  if (faviconUrl) {
    const link = document.getElementById('favicon') as HTMLLinkElement | null;
    if (link) {
      link.href = faviconUrl;
      // Update type attr when switching from svg to png
      link.type = faviconUrl.endsWith('.svg') ? 'image/svg+xml' : 'image/png';
    }
  }

  // Generate a dynamic PWA manifest from runtime branding and inject it.
  // Blob URL replaces the static /manifest.json so PWA install prompts use
  // the branded name, short name, description, theme color, and favicon.
  const manifestJson = generatePWAManifest({
    enabled: true,
    name: getProductName(),
    shortName: getProductShortName(),
    description: getPwaDescription(),
    themeColor: getPwaThemeColor(),
    backgroundColor: '#ffffff',
    display: 'standalone',
    startUrl: './',
    scope: './',
    orientation: 'any',
    icons: [{ src: faviconUrl || './favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
  });
  const blob = new Blob([JSON.stringify(manifestJson)], { type: 'application/json' });
  const manifestUrl = URL.createObjectURL(blob);
  const existingManifest = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
  if (existingManifest) existingManifest.remove();
  const manifestLink = document.createElement('link');
  manifestLink.rel = 'manifest';
  manifestLink.href = manifestUrl;
  document.head.appendChild(manifestLink);

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <MobileProvider pwa={{ enabled: true, name: getProductName(), shortName: getProductShortName() }}>
        <I18nProvider loadLanguage={loadLanguage} loadLocales={loadLocales}>
          <App />
        </I18nProvider>
      </MobileProvider>
    </React.StrictMode>
  );
});
