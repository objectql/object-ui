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
