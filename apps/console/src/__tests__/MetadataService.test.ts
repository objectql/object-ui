/**
 * MetadataService unit tests
 *
 * Tests the service layer that wraps ObjectStack metadata API calls
 * for object and field CRUD operations.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MetadataService } from '../services/MetadataService';
import type { ObjectDefinition, DesignerFieldDefinition } from '@object-ui/types';

// ---------------------------------------------------------------------------
// Mock adapter / client
// ---------------------------------------------------------------------------

function createMockAdapter() {
  const mockClient = {
    meta: {
      saveItem: vi.fn().mockResolvedValue({}),
      getItem: vi.fn().mockResolvedValue({ item: { name: 'account', fields: [] } }),
    },
  };

  const adapter = {
    getClient: vi.fn().mockReturnValue(mockClient),
    invalidateCache: vi.fn(),
  } as any;

  return { adapter, mockClient };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeObject(overrides: Partial<ObjectDefinition> = {}): ObjectDefinition {
  return {
    id: 'account',
    name: 'account',
    label: 'Accounts',
    fieldCount: 3,
    sortOrder: 0,
    isSystem: false,
    enabled: true,
    ...overrides,
  };
}

function makeField(overrides: Partial<DesignerFieldDefinition> = {}): DesignerFieldDefinition {
  return {
    id: 'name',
    name: 'name',
    label: 'Name',
    type: 'text',
    sortOrder: 0,
    required: false,
    unique: false,
    readonly: false,
    hidden: false,
    externalId: false,
    trackHistory: false,
    indexed: false,
    isSystem: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests: saveObject
// ---------------------------------------------------------------------------

describe('MetadataService', () => {
  let service: MetadataService;
  let mockClient: ReturnType<typeof createMockAdapter>['mockClient'];
  let adapter: ReturnType<typeof createMockAdapter>['adapter'];

  beforeEach(() => {
    ({ adapter, mockClient } = createMockAdapter());
    service = new MetadataService(adapter);
  });

  describe('saveObject', () => {
    it('should call client.meta.saveItem with the correct payload', async () => {
      const obj = makeObject();
      await service.saveObject(obj);

      expect(mockClient.meta.saveItem).toHaveBeenCalledWith(
        'object',
        'account',
        expect.objectContaining({ name: 'account', label: 'Accounts', enabled: true }),
      );
    });

    it('should invalidate cache after save', async () => {
      await service.saveObject(makeObject());
      expect(adapter.invalidateCache).toHaveBeenCalledWith('object:account');
    });

    it('should propagate API errors', async () => {
      mockClient.meta.saveItem.mockRejectedValueOnce(new Error('Network error'));
      await expect(service.saveObject(makeObject())).rejects.toThrow('Network error');
    });
  });

  // -------------------------------------------------------------------------
  // Tests: deleteObject
  // -------------------------------------------------------------------------

  describe('deleteObject', () => {
    it('should save the object as disabled with _deleted flag', async () => {
      await service.deleteObject('account');

      expect(mockClient.meta.saveItem).toHaveBeenCalledWith(
        'object',
        'account',
        expect.objectContaining({ name: 'account', enabled: false, _deleted: true }),
      );
    });

    it('should invalidate cache after delete', async () => {
      await service.deleteObject('account');
      expect(adapter.invalidateCache).toHaveBeenCalledWith('object:account');
    });
  });

  // -------------------------------------------------------------------------
  // Tests: saveFields
  // -------------------------------------------------------------------------

  describe('saveFields', () => {
    it('should fetch existing object and merge fields', async () => {
      const fields = [makeField(), makeField({ id: 'email', name: 'email', label: 'Email', type: 'email' })];
      await service.saveFields('account', fields);

      expect(mockClient.meta.getItem).toHaveBeenCalledWith('object', 'account');
      expect(mockClient.meta.saveItem).toHaveBeenCalledWith(
        'object',
        'account',
        expect.objectContaining({
          name: 'account',
          fields: expect.arrayContaining([
            expect.objectContaining({ name: 'name', type: 'text' }),
            expect.objectContaining({ name: 'email', type: 'email' }),
          ]),
        }),
      );
    });

    it('should proceed even if fetching existing object fails', async () => {
      mockClient.meta.getItem.mockRejectedValueOnce(new Error('Not found'));
      const fields = [makeField()];
      await service.saveFields('new_object', fields);

      expect(mockClient.meta.saveItem).toHaveBeenCalledWith(
        'object',
        'new_object',
        expect.objectContaining({
          name: 'new_object',
          fields: [expect.objectContaining({ name: 'name' })],
        }),
      );
    });

    it('should invalidate cache after saving fields', async () => {
      await service.saveFields('account', [makeField()]);
      expect(adapter.invalidateCache).toHaveBeenCalledWith('object:account');
    });
  });

  // -------------------------------------------------------------------------
  // Tests: diffObjects (static)
  // -------------------------------------------------------------------------

  describe('diffObjects', () => {
    it('should detect a created object', () => {
      const prev = [makeObject()];
      const newObj = makeObject({ id: 'contact', name: 'contact', label: 'Contacts' });
      const next = [...prev, newObj];

      const result = MetadataService.diffObjects(prev, next);
      expect(result).toEqual({ type: 'create', object: newObj });
    });

    it('should detect a deleted object', () => {
      const obj1 = makeObject();
      const obj2 = makeObject({ id: 'contact', name: 'contact', label: 'Contacts' });
      const prev = [obj1, obj2];
      const next = [obj1];

      const result = MetadataService.diffObjects(prev, next);
      expect(result).toEqual({ type: 'delete', object: obj2 });
    });

    it('should detect an updated object', () => {
      const prev = [makeObject()];
      const updated = makeObject({ label: 'Updated Accounts' });
      const next = [updated];

      const result = MetadataService.diffObjects(prev, next);
      expect(result).toEqual({ type: 'update', object: updated });
    });

    it('should return null when arrays are identical', () => {
      const objs = [makeObject()];
      expect(MetadataService.diffObjects(objs, objs)).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Tests: diffFields (static)
  // -------------------------------------------------------------------------

  describe('diffFields', () => {
    it('should detect a created field', () => {
      const prev = [makeField()];
      const newField = makeField({ id: 'email', name: 'email', label: 'Email' });
      const next = [...prev, newField];

      const result = MetadataService.diffFields(prev, next);
      expect(result).toEqual({ type: 'create', field: newField });
    });

    it('should detect a deleted field', () => {
      const f1 = makeField();
      const f2 = makeField({ id: 'email', name: 'email', label: 'Email' });
      const prev = [f1, f2];
      const next = [f1];

      const result = MetadataService.diffFields(prev, next);
      expect(result).toEqual({ type: 'delete', field: f2 });
    });

    it('should detect an updated field', () => {
      const prev = [makeField()];
      const updated = makeField({ label: 'Full Name' });
      const next = [updated];

      const result = MetadataService.diffFields(prev, next);
      expect(result).toEqual({ type: 'update', field: updated });
    });

    it('should return null when arrays are identical', () => {
      const fields = [makeField()];
      expect(MetadataService.diffFields(fields, fields)).toBeNull();
    });
  });
});
