/**
 * Main Entry Point
 * 
 * Initializes MSW and renders the React application.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { App } from './App';
import { I18nProvider } from '@object-ui/i18n';
import { MobileProvider } from '@object-ui/mobile';

// Register plugins (side-effect imports for ComponentRegistry)
import '@object-ui/plugin-grid';
import '@object-ui/plugin-kanban';
import '@object-ui/plugin-calendar';
import '@object-ui/plugin-gantt';
import '@object-ui/plugin-charts';
import '@object-ui/plugin-list';
import '@object-ui/plugin-detail';
import '@object-ui/plugin-timeline';
import '@object-ui/plugin-map';
import '@object-ui/plugin-view';
import '@object-ui/plugin-form';
import '@object-ui/plugin-dashboard';
import '@object-ui/plugin-report';
import '@object-ui/plugin-markdown';

/**
 * Load application-specific translations for a given language from the API.
 *
 * The @objectstack/spec REST API (`/api/v1/i18n/translations/:locale`) wraps
 * its response in the standard envelope: `{ data: { locale, translations } }`.
 * We extract `data.translations` when present, and fall back to the raw JSON
 * for mock / local-dev environments that may return flat translation objects.
 */
async function loadLanguage(lang: string): Promise<Record<string, unknown>> {
  try {
    const res = await fetch(`/api/v1/i18n/translations/${lang}`);
    if (!res.ok) {
      console.warn(`[i18n] Failed to load translations for '${lang}': HTTP ${res.status}`);
      return {};
    }
    const json = await res.json();
    // Unwrap the spec REST API envelope when present
    if (json && typeof json === 'object' && json.data && json.data.translations && typeof json.data.translations === 'object') {
      return json.data.translations as Record<string, unknown>;
    }
    // Fallback: mock server / local dev returns flat translation objects
    return json;
  } catch (err) {
    console.warn(`[i18n] Failed to load translations for '${lang}':`, err);
    return {};
  }
}

// Start MSW before rendering the app
async function bootstrap() {
  // Initialize Mock Service Worker if enabled (lazy-loaded to keep production bundle lean)
  if (import.meta.env.VITE_USE_MOCK_SERVER !== 'false') {
    const { startMockServer } = await import('./mocks/browser');
    await startMockServer();
  }

  // Render the React app
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <MobileProvider pwa={{ enabled: true, name: 'ObjectUI Console', shortName: 'Console' }}>
        <I18nProvider loadLanguage={loadLanguage}>
          <App />
        </I18nProvider>
      </MobileProvider>
    </React.StrictMode>
  );
}

bootstrap();
