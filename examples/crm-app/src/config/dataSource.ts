import { ObjectStackAdapter } from '@object-ui/data-objectstack';

export const dataSource = new ObjectStackAdapter({
  baseUrl: typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000',
  // In a real app we would have token management, but for MSW mock we might not need auth or use a dummy token.
  token: 'mock-token',
  fetch: (globalThis.fetch as any), // Ensure we use the global fetch which Mocks/Browsers patch
});
