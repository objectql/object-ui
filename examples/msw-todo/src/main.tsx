/**
 * Main Entry Point
 * 
 * Initializes MSW and renders the React application.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { startMockServer } from './mocks/browser';

async function bootstrap() {
  // Initialize Mock Service Worker
  await startMockServer();

  // Render the React app
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

bootstrap().catch(err => {
  console.error("FATAL: Application failed to start", err);
  document.body.innerHTML = `<div style="color:red; padding: 20px;"><h1>Application Error</h1><pre>${err.message}</pre></div>`;
});
