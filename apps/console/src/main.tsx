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
        <I18nProvider>
          <App />
        </I18nProvider>
      </MobileProvider>
    </React.StrictMode>
  );
}

bootstrap();
