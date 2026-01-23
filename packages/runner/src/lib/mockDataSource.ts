/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { DataSource } from '@object-ui/core';

/**
 * 模拟数据源 (Mock Adapter)
 * 在真实项目中，你会在这里使用 fetch/axios 调用你的 API。
 */
export class MockDataSource implements DataSource {
  async find(resource: string, params?: any): Promise<any[]> {
    console.log(`[DataSource] Querying ${resource}`, params);
    return [];
  }

  async findOne(resource: string, id: string): Promise<any> {
    return null;
  }

  async create(resource: string, data: any): Promise<any> {
    // 模拟网络请求
    await new Promise(resolve => setTimeout(resolve, 800));
    
    console.log(`[DataSource] Created ${resource}:`, data);
    alert(`Success! Created record in "${resource}":\n${JSON.stringify(data, null, 2)}`);
    
    return { id: Math.random().toString(), ...data };
  }

  async update(resource: string, id: string, data: any): Promise<any> {
    return data;
  }

  async delete(resource: string, id: string): Promise<any> {
    return true;
  }

  async getObjectSchema(objectName: string): Promise<any> {
    if (!objectName || typeof objectName !== 'string') {
      throw new Error('Invalid object name');
    }
    
    console.log(`[DataSource] Getting schema for ${objectName}`);
    // Return a minimal schema for mock purposes
    return {
      name: objectName,
      label: objectName,
      fields: {}
    };
  }
}
