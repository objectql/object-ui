/**
 * MSW Integration Tests
 * 
 * Verifies the MSW server (powered by MSWPlugin) correctly handles:
 * - Basic CRUD operations via the ObjectStack protocol
 * - Query parameters: filter, sort, top, skip
 *
 * MSWPlugin routes all requests through the ObjectStack protocol stack,
 * ensuring behaviour is identical to server mode (HonoServerPlugin).
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

  // ── Protocol-level query tests (filter / sort / top) ───────────────────
  // These tests hit the MSW HTTP layer via fetch, which MSWPlugin routes
  // through HttpDispatcher → ObjectStack protocol. If the protocol handles
  // filter/sort/top correctly, these will pass.

  it('should support top (limit) via HTTP', async () => {
    const res = await fetch('http://localhost/api/v1/data/contact?top=3');
    expect(res.ok).toBe(true);
    const body = await res.json();

    // HttpDispatcher wraps in { success, data: { value: [...] } }
    const data = body.data ?? body;
    const records = data.value ?? data.records ?? data;
    expect(Array.isArray(records)).toBe(true);
    expect(records.length).toBeLessThanOrEqual(3);
  });

  it('should support sort via HTTP', async () => {
    const res = await fetch('http://localhost/api/v1/data/contact?sort=name');
    expect(res.ok).toBe(true);
    const body = await res.json();

    const data = body.data ?? body;
    const records = data.value ?? data.records ?? data;
    expect(Array.isArray(records)).toBe(true);
    expect(records.length).toBeGreaterThan(0);

    // Verify records are sorted by name ascending
    const names = records.map((r: any) => r.name);
    const sorted = [...names].sort((a: string, b: string) => a.localeCompare(b));
    expect(names).toEqual(sorted);
  });

  it('should support filter via HTTP', async () => {
    // Filter contacts where priority = "high" using tuple format
    const filter = JSON.stringify(['priority', '=', 'high']);
    const res = await fetch(`http://localhost/api/v1/data/contact?filter=${encodeURIComponent(filter)}`);
    expect(res.ok).toBe(true);
    const body = await res.json();

    const data = body.data ?? body;
    const records = data.value ?? data.records ?? data;
    expect(Array.isArray(records)).toBe(true);
    expect(records.length).toBeGreaterThan(0);
    // All returned records should have priority 'high'
    for (const record of records) {
      expect(record.priority).toBe('high');
    }
  });
});
