import { ObjectStackClient } from '@objectstack/client';
import { ObjectStackAdapter } from '@object-ui/data-objectstack';

// Use empty string to use current origin. 
// Matches MSW baseUrl: ''
const BASE_URL = '/api/v1'; 

export const client = new ObjectStackClient({
  baseUrl: BASE_URL, 
  fetch: globalThis.fetch.bind(globalThis)
});

export const dataSource = new ObjectStackAdapter({
  baseUrl: BASE_URL,
  token: 'mock-token',
  fetch: globalThis.fetch.bind(globalThis)
});

export const initClient = async () => {
    console.log('[Client] Connecting...');
    // Only connect client (adapter connects lazily or we can connect it too)
    await client.connect();
    // await dataSource.connect(); // Adapter usually auto-connects on request
    console.log('[Client] Connected');
}