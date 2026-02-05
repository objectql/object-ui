/**
 * ObjectStack DataSource Adapter
 * 
 * Adapter that connects ObjectForm to ObjectStack Client
 */

import type { DataSource, QueryResult } from '@object-ui/types';
import type { ObjectStackClient } from '@objectstack/client';

export class ObjectStackDataSource implements DataSource {
  constructor(private client: ObjectStackClient) {}

  async getObjectSchema(objectName: string): Promise<any> {
    // Fetch object metadata from ObjectStack using standard getItem API
    // Note: getObject() is deprecated and might use legacy routes
    const metadata: any = await this.client.meta.getItem('object', objectName);
    
    // Unwrap 'item' property if present (API response wrapper)
    if (metadata && metadata.item) {
      return metadata.item;
    }
    
    return metadata;
  }

  async findOne(objectName: string, id: string): Promise<any> {
    const result: any = await this.client.data.get(objectName, id);
    // Unwrap 'record' or 'value' property if present (common in wrapped responses)
    if (result && typeof result === 'object') {
       if (result.record) return result.record;
       if (result.value) return result.value;
    }
    return result;
  }

  async create(objectName: string, data: any): Promise<any> {
    const result = await this.client.data.create(objectName, data);
    return result;
  }

  async update(objectName: string, id: string, data: any): Promise<any> {
    const result = await this.client.data.update(objectName, id, data);
    return result;
  }

  async delete(objectName: string, id: string): Promise<boolean> {
    const result = await this.client.data.delete(objectName, id);
    return result.success;
  }

  async find(objectName: string, options?: any): Promise<QueryResult<any>> {
    const result: any = await this.client.data.find(objectName, options || {});
    
    // Handle array response
    if (Array.isArray(result)) {
      return { data: result };
    }
    
    // Handle ObjectStack response format
    return {
      data: result.value || result,
      total: result.count,
    };
  }
}
