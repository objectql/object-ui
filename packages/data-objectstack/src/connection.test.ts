/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ObjectStackAdapter, ConnectionState, ConnectionStateEvent, BatchProgressEvent } from './index';

describe('Connection State Monitoring', () => {
  let adapter: ObjectStackAdapter;

  beforeEach(() => {
    adapter = new ObjectStackAdapter({
      baseUrl: 'http://localhost:3000',
      autoReconnect: false, // Disable auto-reconnect for testing
    });
  });

  it('should initialize with disconnected state', () => {
    expect(adapter.getConnectionState()).toBe('disconnected');
    expect(adapter.isConnected()).toBe(false);
  });

  it('should allow subscribing to connection state changes', () => {
    const listener = vi.fn();
    const unsubscribe = adapter.onConnectionStateChange(listener);

    expect(typeof unsubscribe).toBe('function');
    expect(listener).not.toHaveBeenCalled();

    // Cleanup
    unsubscribe();
  });

  it('should allow subscribing to batch progress events', () => {
    const listener = vi.fn();
    const unsubscribe = adapter.onBatchProgress(listener);

    expect(typeof unsubscribe).toBe('function');
    expect(listener).not.toHaveBeenCalled();

    // Cleanup
    unsubscribe();
  });

  it('should unsubscribe connection state listener', () => {
    const listener = vi.fn();
    const unsubscribe = adapter.onConnectionStateChange(listener);

    // Unsubscribe
    unsubscribe();

    // Listener should not be called after unsubscribe
    // (We can't easily test this without triggering a connection state change)
  });

  it('should unsubscribe batch progress listener', () => {
    const listener = vi.fn();
    const unsubscribe = adapter.onBatchProgress(listener);

    // Unsubscribe
    unsubscribe();

    // Listener should not be called after unsubscribe
  });

  it('should support auto-reconnect configuration', () => {
    const adapterWithReconnect = new ObjectStackAdapter({
      baseUrl: 'http://localhost:3000',
      autoReconnect: true,
      maxReconnectAttempts: 5,
      reconnectDelay: 2000,
    });

    expect(adapterWithReconnect.getConnectionState()).toBe('disconnected');
  });
});

describe('Batch Progress Events', () => {
  let adapter: ObjectStackAdapter;

  beforeEach(() => {
    adapter = new ObjectStackAdapter({
      baseUrl: 'http://localhost:3000',
    });
  });

  it('should allow subscribing to batch progress', () => {
    const listener = vi.fn();
    const unsubscribe = adapter.onBatchProgress(listener);

    expect(typeof unsubscribe).toBe('function');

    // Cleanup
    unsubscribe();
  });
});

describe('getDiscovery', () => {
  it('should return discoveryInfo from the underlying client after connect', async () => {
    const mockDiscovery = {
      name: 'test-server',
      version: '1.0.0',
      services: {
        auth: { enabled: false, status: 'unavailable' },
        data: { enabled: true, status: 'available' },
      },
    };

    const adapter = new ObjectStackAdapter({
      baseUrl: 'http://localhost:3000',
      autoReconnect: false,
    });

    // Mock the underlying client's connect method and discoveryInfo property
    const client = adapter.getClient();
    vi.spyOn(client, 'connect').mockResolvedValue(mockDiscovery as any);
    // Simulate what connect() does: sets discoveryInfo
    (client as any).discoveryInfo = mockDiscovery;

    const discovery = await adapter.getDiscovery();
    expect(discovery).toEqual(mockDiscovery);
    expect((discovery as any)?.services?.auth?.enabled).toBe(false);
  });

  it('should return null when connection fails', async () => {
    const adapter = new ObjectStackAdapter({
      baseUrl: 'http://localhost:3000',
      autoReconnect: false,
    });

    const client = adapter.getClient();
    vi.spyOn(client, 'connect').mockRejectedValue(new Error('Connection failed'));

    const discovery = await adapter.getDiscovery();
    expect(discovery).toBeNull();
  });
});
