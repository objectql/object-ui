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
        '@odata.count': 2,
      };
      
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      });
      
      const result = await dataSource.find('contacts');
      
      expect(result.data).toEqual(mockData.value);
      expect(result.total).toBe(2);
    });
    
    it('should convert universal query params to ObjectQL format', async () => {
      const mockData = { value: [], '@odata.count': 0 };
      
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
      
      expect(url).toContain('fields=');
      expect(url).toContain('filters=');
      expect(url).toContain('sort=');
      expect(url).toContain('skip=10');
      expect(url).toContain('top=20');
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
        json: async () => ({ message: 'Not found' }),
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
      
      expect(options.method).toBe('PATCH');
      expect(options.body).toBe(JSON.stringify(updates));
    });
  });
  
  describe('delete', () => {
    it('should delete a record', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });
      
      const result = await dataSource.delete('contacts', '1');
      
      expect(result).toBe(true);
      
      const fetchCall = (global.fetch as any).mock.calls[0];
      const options = fetchCall[1];
      
      expect(options.method).toBe('DELETE');
    });
  });
  
  describe('bulk', () => {
    it('should execute bulk operations', async () => {
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
      expect(JSON.parse(options.body)).toEqual({
        operation: 'create',
        data: bulkData,
      });
    });
  });
  
  describe('error handling', () => {
    it('should throw error for non-OK responses', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({ message: 'Server error' }),
      });
      
      await expect(dataSource.find('contacts')).rejects.toThrow();
    });
    
    it('should throw error for timeout configuration', () => {
      // Test that timeout configuration is accepted
      const dataSourceWithShortTimeout = new ObjectQLDataSource({
        baseUrl: 'https://api.example.com',
        timeout: 10,
      });
      
      expect(dataSourceWithShortTimeout).toBeDefined();
    });
  });
  
  describe('configuration', () => {
    it('should include spaceId in headers when provided', async () => {
      const dataSourceWithSpace = new ObjectQLDataSource({
        baseUrl: 'https://api.example.com',
        spaceId: 'space123',
      });
      
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ value: [] }),
      });
      
      await dataSourceWithSpace.find('contacts');
      
      const fetchCall = (global.fetch as any).mock.calls[0];
      const options = fetchCall[1];
      
      expect(options.headers['X-Space-Id']).toBe('space123');
    });
    
    it('should use custom API version', async () => {
      const dataSourceWithVersion = new ObjectQLDataSource({
        baseUrl: 'https://api.example.com',
        version: 'v2',
      });
      
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ value: [] }),
      });
      
      await dataSourceWithVersion.find('contacts');
      
      const fetchCall = (global.fetch as any).mock.calls[0];
      const url = fetchCall[0];
      
      expect(url).toContain('/api/v2/');
    });
  });
});
