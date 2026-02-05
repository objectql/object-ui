/**
 * Simple MSW Integration Test
 * 
 * Minimal test to verify MSW server is working
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import '@testing-library/jest-dom';
import { startMockServer, stopMockServer, getDriver } from '../mocks/server';

describe('MSW Server Integration', () => {
  beforeAll(async () => {
    await startMockServer();
  });

  afterAll(() => {
    stopMockServer();
  });

  it('should initialize MSW server with data', async () => {
    const driver = getDriver();
    expect(driver).toBeDefined();
    
    // Check that initial data was loaded
    const contacts = await driver!.find('contact', { object: 'contact' });
    expect(contacts).toHaveLength(7);
    expect(contacts[0].name).toBe('Alice Johnson');
  });

  it('should create a new contact via driver', async () => {
    const driver = getDriver();
    
    const newContact = await driver!.create('contact', {
      name: 'Test User',
      email: 'test@example.com',
      is_active: true,
      priority: 5
    }) as any;

    expect(newContact.name).toBe('Test User');
    expect(newContact.email).toBe('test@example.com');
  });
});
