/**
 * Main Entry Point
 * 
 * Initializes MSW and renders the React application.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { App } from './App';
import { startMockServer } from './mocks/browser';

// Register plugins
import '@object-ui/plugin-charts';
import '@object-ui/plugin-list';
import '@object-ui/plugin-detail';

// Start MSW before rendering the app
async function bootstrap() {
  // Initialize Mock Service Worker if enabled
  if (import.meta.env.VITE_USE_MOCK_SERVER !== 'false') {
    await startMockServer();
  }

  // Render the React app
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

bootstrap();
