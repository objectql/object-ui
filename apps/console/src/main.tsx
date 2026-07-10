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
import { ComponentRegistry } from '@object-ui/core';
import { registerPlaceholders } from '@object-ui/components';
import { initSentry, initRuntimeConfig, getProductName, getProductShortName, getFaviconUrl, getPwaDescription, getPwaThemeColor } from '@object-ui/app-shell';
import { loadLanguage } from './loadLanguage';
import { preflightAuth } from './lib/auth-preflight';

const AUTH_URL = `${import.meta.env.VITE_SERVER_URL || ''}/api/v1/auth`;

// Kick off Sentry init in the background (no-op if VITE_SENTRY_DSN is unset).
// Not awaited — observability must never block first paint.
void initSentry();

// ────────────────────────────────────────────────────────────────────────────
// Plugin registration
// ────────────────────────────────────────────────────────────────────────────
//
// Eager imports — core views needed on most pages.  These are cheap (no heavy
// 3rd-party deps) so paying their cost upfront is the right tradeoff.
import '@object-ui/plugin-grid';
import '@object-ui/plugin-form';
import '@object-ui/plugin-view';
import '@object-ui/plugin-list';
import '@object-ui/plugin-detail';

// Lazy plugins — registered as deferred loaders.  The first time the
// SchemaRenderer encounters one of these `type` values, the plugin module is
// imported on-demand (and its top-level `ComponentRegistry.register()` calls
// run as a side-effect).  This keeps maplibre-gl, recharts, frappe-gantt,
// markdown renderers, etc. out of the initial bundle.
ComponentRegistry.registerLazy('object-map', () => import('@object-ui/plugin-map'), {
  namespace: 'plugin-map',
  category: 'view',
});
ComponentRegistry.registerLazy('map', () => import('@object-ui/plugin-map'), {
  namespace: 'view',
  category: 'view',
});

ComponentRegistry.registerLazy('object-tree', () => import('@object-ui/plugin-tree'), {
  namespace: 'plugin-tree',
  category: 'view',
});
ComponentRegistry.registerLazy('tree', () => import('@object-ui/plugin-tree'), {
  namespace: 'view',
  category: 'view',
});

// Dashboard plugin — only used on dashboard / home pages. Lazy-load all 8
// component types so the ~150 KB widget/pivot/metric tree stays out of the
// initial bundle for users who never visit a dashboard.
for (const variant of ['dashboard', 'metric', 'metric-card', 'object-metric', 'pivot', 'object-pivot', 'dashboard-grid', 'object-data-table']) {
  ComponentRegistry.registerLazy(variant, () => import('@object-ui/plugin-dashboard'), {
    namespace: 'plugin-dashboard',
    category: 'view',
  });
}

ComponentRegistry.registerLazy('chart', () => import('@object-ui/plugin-charts'), {
  namespace: 'plugin-charts',
  category: 'chart',
});
// Additional chart variants registered by @object-ui/plugin-charts so the
// renderer can lazy-load when any chart type appears in a schema.
for (const variant of ['object-chart', 'bar-chart', 'pie-chart', 'donut-chart', 'radar-chart', 'scatter-chart', 'line-chart', 'area-chart', 'advanced-chart', 'chart:bar']) {
  ComponentRegistry.registerLazy(variant, () => import('@object-ui/plugin-charts'), {
    namespace: 'plugin-charts',
    category: 'chart',
  });
}

ComponentRegistry.registerLazy('object-gantt', () => import('@object-ui/plugin-gantt'), {
  namespace: 'plugin-gantt',
  category: 'view',
});
ComponentRegistry.registerLazy('gantt', () => import('@object-ui/plugin-gantt'), {
  namespace: 'view',
  category: 'view',
});

ComponentRegistry.registerLazy('markdown', () => import('@object-ui/plugin-markdown'), {
  namespace: 'plugin-markdown',
  category: 'display',
});

ComponentRegistry.registerLazy('object-timeline', () => import('@object-ui/plugin-timeline'), {
  namespace: 'plugin-timeline',
  category: 'view',
});
ComponentRegistry.registerLazy('timeline', () => import('@object-ui/plugin-timeline'), {
  namespace: 'view',
  category: 'view',
});

ComponentRegistry.registerLazy('object-calendar', () => import('@object-ui/plugin-calendar'), {
  namespace: 'plugin-calendar',
  category: 'view',
});
ComponentRegistry.registerLazy('calendar', () => import('@object-ui/plugin-calendar'), {
  namespace: 'view',
  category: 'view',
});
ComponentRegistry.registerLazy('calendar-view', () => import('@object-ui/plugin-calendar'), {
  namespace: 'plugin-calendar',
  category: 'view',
});

ComponentRegistry.registerLazy('object-kanban', () => import('@object-ui/plugin-kanban'), {
  namespace: 'plugin-kanban',
  category: 'view',
});
ComponentRegistry.registerLazy('kanban', () => import('@object-ui/plugin-kanban'), {
  namespace: 'view',
  category: 'view',
});
for (const variant of ['kanban-ui', 'kanban-enhanced']) {
  ComponentRegistry.registerLazy(variant, () => import('@object-ui/plugin-kanban'), {
    namespace: 'plugin-kanban',
    category: 'view',
  });
}

ComponentRegistry.registerLazy('report', () => import('@object-ui/plugin-report'), {
  namespace: 'plugin-report',
  category: 'view',
});
for (const variant of ['report-viewer', 'spec-report']) {
  ComponentRegistry.registerLazy(variant, () => import('@object-ui/plugin-report'), {
    namespace: 'plugin-report',
    category: 'view',
  });
}

// Register console-specific schema widgets (object detail page sections)
import './components/schema/registerObjectDetailWidgets';

// Register `developer:*` component refs.
import './registerDeveloperComponents';

// Register `studio:*` component refs (the application-builder entry).
import './registerStudioComponents';

// Register `account:*` component refs (My Profile, etc.).
import './registerAccountComponents';

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
const SERVER_BASE = (import.meta.env.VITE_SERVER_URL || '').replace(/\/+$/, '');
Promise.all([
  initRuntimeConfig(SERVER_BASE),
  preflightAuth(AUTH_URL),
]).finally(() => {
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
        <I18nProvider loadLanguage={loadLanguage}>
          <App />
        </I18nProvider>
      </MobileProvider>
    </React.StrictMode>
  );
});
