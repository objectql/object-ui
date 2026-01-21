/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Tests for ObjectQLDataSource
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ObjectQLDataSource } from '../ObjectQLDataSource';

// Mock fetch
global.fetch = vi.fn();

describe('ObjectQLDataSource', () => {
  let dataSource: ObjectQLDataSource;
  
  beforeEach(() => {
    vi.clearAllMocks();
    dataSource = new ObjectQLDataSource({
      baseUrl: 'https://api.example.com',
      token: 'test-token',
    });
  });
  
  describe('find', () => {
    it('should fetch multiple records', async () => {
      const mockData = {
        value: [
          { _id: '1', name: 'John' },
          { _id: '2', name: 'Jane' },
        ],
        count: 2
      };
      
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      });
      
      const result = await dataSource.find('contacts');
      
      expect(result.data).toEqual(mockData.value);
      expect(result.total).toBe(2);
    });
    
    it('should convert universal query params to ObjectStack format', async () => {
      const mockData = { value: [], count: 0 };
      
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      });
      
      await dataSource.find('contacts', {
        $select: ['name', 'email'],
        $filter: { status: 'active' },
        $orderby: { created: 'desc' },
        $skip: 10,
        $top: 20,
      });
      
      const fetchCall = (global.fetch as any).mock.calls[0];
      const url = fetchCall[0];
      
      // ObjectStack client uses different parameter names
      expect(url).toContain('skip=10');
      expect(url).toContain('top=20');
      expect(url).toContain('sort=created');
      expect(url).toContain('select=name');
    });
    
    it('should convert MongoDB-like operators in filters to AST format', async () => {
      const mockData = { value: [], count: 0 };
      
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      });
      
      await dataSource.find('contacts', {
        $filter: { 
          age: { $gte: 18, $lte: 65 },
          status: { $in: ['active', 'pending'] }
        }
      });
      
      const fetchCall = (global.fetch as any).mock.calls[0];
      const url = fetchCall[0];
      
      // Verify the filter is converted to AST format and JSON stringified
      // The new ObjectStack filter rules require complex filters to be in AST format:
      // ['and', ['age', '>=', 18], ['age', '<=', 65], ['status', 'in', ['active', 'pending']]]
      expect(url).toContain('filters=');
      // Verify it's JSON stringified (contains encoded brackets)
      expect(url).toMatch(/filters=%5B/); // %5B is the URL-encoded '['
    });

    it('should convert simple filters to AST format', async () => {
      const mockData = { value: [], count: 0 };
      
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      });
      
      await dataSource.find('contacts', {
        $filter: { status: 'active' }
      });
      
      const fetchCall = (global.fetch as any).mock.calls[0];
      const url = fetchCall[0];
      
      // Simple filters are also converted to AST format: ['status', '=', 'active']
      expect(url).toContain('filters=');
      expect(url).toMatch(/filters=%5B/); // %5B is the URL-encoded '['
    });
    
    it('should include authentication token in headers', async () => {
      const mockData = { value: [] };
      
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      });
      
      await dataSource.find('contacts');
      
      const fetchCall = (global.fetch as any).mock.calls[0];
      const options = fetchCall[1];
      
      expect(options.headers['Authorization']).toBe('Bearer test-token');
    });
  });
  
  describe('findOne', () => {
    it('should fetch a single record by ID', async () => {
      const mockData = { _id: '1', name: 'John' };
      
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      });
      
      const result = await dataSource.findOne('contacts', '1');
      
      expect(result).toEqual(mockData);
    });
    
    it('should return null for 404 errors', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({ 
          error: { 
            code: 'NOT_FOUND',
            message: 'Not found' 
          } 
        }),
      });
      
      const result = await dataSource.findOne('contacts', 'nonexistent');
      
      expect(result).toBeNull();
    });
  });
  
  describe('create', () => {
    it('should create a new record', async () => {
      const newRecord = { name: 'John', email: 'john@example.com' };
      const createdRecord = { _id: '1', ...newRecord };
      
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => createdRecord,
      });
      
      const result = await dataSource.create('contacts', newRecord);
      
      expect(result).toEqual(createdRecord);
      
      const fetchCall = (global.fetch as any).mock.calls[0];
      const options = fetchCall[1];
      
      expect(options.method).toBe('POST');
      expect(options.body).toBe(JSON.stringify(newRecord));
    });
  });
  
  describe('update', () => {
    it('should update an existing record', async () => {
      const updates = { name: 'Jane' };
      const updatedRecord = { _id: '1', name: 'Jane', email: 'jane@example.com' };
      
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => updatedRecord,
      });
      
      const result = await dataSource.update('contacts', '1', updates);
      
      expect(result).toEqual(updatedRecord);
      
      const fetchCall = (global.fetch as any).mock.calls[0];
      const options = fetchCall[1];
      
      // The ObjectStack client uses PUT or PATCH method for updates
      expect(['PUT', 'PATCH']).toContain(options.method);
      expect(options.body).toBe(JSON.stringify(updates));
    });
  });
  
  describe('delete', () => {
    it('should delete a record', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });
      
      const result = await dataSource.delete('contacts', '1');
      
      expect(result).toBe(true);
      
      const fetchCall = (global.fetch as any).mock.calls[0];
      const options = fetchCall[1];
      
      expect(options.method).toBe('DELETE');
    });
  });
  
  describe('bulk', () => {
    it('should execute bulk create operations', async () => {
      const bulkData = [
        { name: 'Contact 1' },
        { name: 'Contact 2' },
      ];
      const createdRecords = [
        { _id: '1', name: 'Contact 1' },
        { _id: '2', name: 'Contact 2' },
      ];
      
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => createdRecords,
      });
      
      const result = await dataSource.bulk('contacts', 'create', bulkData);
      
      expect(result).toEqual(createdRecords);
      
      const fetchCall = (global.fetch as any).mock.calls[0];
      const options = fetchCall[1];
      
      expect(options.method).toBe('POST');
    });
  });
  
  describe('error handling', () => {
    it('should handle API errors', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({ 
          error: { 
            code: 'INTERNAL_ERROR',
            message: 'Server error' 
          } 
        }),
      });
      
      await expect(dataSource.find('contacts')).rejects.toThrow();
    });
    
    it('should accept timeout configuration', () => {
      // Test that timeout configuration is accepted
      const dataSourceWithShortTimeout = new ObjectQLDataSource({
        baseUrl: 'https://api.example.com',
        timeout: 10,
      });
      
      expect(dataSourceWithShortTimeout).toBeDefined();
    });
  });
  
  describe('configuration', () => {
    it('should accept timeout configuration', () => {
      // Test that timeout configuration is accepted
      const dataSourceWithTimeout = new ObjectQLDataSource({
        baseUrl: 'https://api.example.com',
        timeout: 5000,
      });
      
      expect(dataSourceWithTimeout).toBeDefined();
    });
    
    it('should accept custom headers', () => {
      const dataSourceWithHeaders = new ObjectQLDataSource({
        baseUrl: 'https://api.example.com',
        headers: {
          'X-Custom-Header': 'custom-value'
        }
      });
      
      expect(dataSourceWithHeaders).toBeDefined();
    });
  });
});
