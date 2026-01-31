/**
 * ObjectStack DataSource Adapter
 * 
 * Adapter that connects ObjectForm to ObjectStack Client
 */

import type { DataSource } from '@object-ui/types';
import type { ObjectStackClient } from '@objectstack/client';

export class ObjectStackDataSource implements DataSource {
  constructor(private client: ObjectStackClient) {}

  async getObjectSchema(objectName: string): Promise<any> {
    // Fetch object metadata from ObjectStack
    const metadata = await this.client.metadata.getObject(objectName);
    return metadata;
  }

  async findOne(objectName: string, id: string): Promise<any> {
    const result = await this.client.data.findById(objectName, id);
    return result.value;
  }

  async create(objectName: string, data: any): Promise<any> {
    const result = await this.client.data.create(objectName, data);
    return result.value;
  }

  async update(objectName: string, id: string, data: any): Promise<any> {
    const result = await this.client.data.update(objectName, id, data);
    return result.value;
  }

  async delete(objectName: string, id: string): Promise<void> {
    await this.client.data.delete(objectName, id);
  }

  async find(objectName: string, options?: any): Promise<any[]> {
    const result = await this.client.data.find(objectName, options);
    return result.value;
  }
}
