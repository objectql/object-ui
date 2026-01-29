import { beforeAll, afterEach, afterAll } from 'vitest';
import { setupServer } from 'msw/node';
import '@testing-library/jest-dom';
import { handlers, seedData } from './handlers';

// Initialize mock data
seedData().catch(console.error);

export const server = setupServer(...handlers);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
