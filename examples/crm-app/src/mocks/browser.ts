import { setupWorker } from 'msw/browser';
import { handlers, seedData } from './handlers';

// Seed Data
seedData().catch(console.error);

export const worker = setupWorker(...handlers);
