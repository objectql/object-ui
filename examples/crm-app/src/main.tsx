/**
 * Main Entry Point
 * 
 * Initializes MSW and renders the CRM application.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

import { startMockServer } from './mocks/browser';
import { initClient } from './client';

async function bootstrap() {
  // 1. Start MSW Mock Server (Critical: Must be first)
  console.log('🛑 Bootstrapping Mock Server...');
  await startMockServer();

  // 2. Initialize Clients (Must happen AFTER MSW is ready)
  // This ensures discovery requests (/api/v1/metadata) are intercepted by MSW
  // instead of falling through to the Vite Dev Server (which returns 404 HTML).
  console.log('🔌 Connecting Clients...');
  await initClient(); 

  // 3. Render React App
  console.log('🚀 Rendering App...');
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