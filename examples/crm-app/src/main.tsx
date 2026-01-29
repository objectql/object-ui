import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

import { startMockServer } from './mocks/runtime';

async function enableMocking() {
  if (process.env.NODE_ENV !== 'development') {
    return;
  }
  return startMockServer();
}

enableMocking().then(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
});
