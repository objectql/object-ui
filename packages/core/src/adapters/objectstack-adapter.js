/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { ObjectStackClient } from '@objectstack/client';
import { convertFiltersToAST } from '../utils/filter-converter';
/**
 * ObjectStack Data Source Adapter
 *
 * Bridges the ObjectStack Client SDK with the ObjectUI DataSource interface.
 * This allows Object UI applications to seamlessly integrate with ObjectStack
 * backends while maintaining the universal DataSource abstraction.
 *
 * @example
 * ```typescript
 * import { ObjectStackAdapter } from '@object-ui/core/adapters';
 *
 * const dataSource = new ObjectStackAdapter({
 *   baseUrl: 'https://api.example.com',
 *   token: 'your-api-token'
 * });
 *
 * const users = await dataSource.find('users', {
 *   $filter: { status: 'active' },
 *   $top: 10
 * });
 * ```
 */
export class ObjectStackAdapter {
    constructor(config) {
        Object.defineProperty(this, "client", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "connected", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        this.client = new ObjectStackClient(config);
    }
    /**
     * Ensure the client is connected to the server.
     * Call this before making requests or it will auto-connect on first request.
     */
    async connect() {
        if (!this.connected) {
            await this.client.connect();
            this.connected = true;
        }
    }
    /**
     * Find multiple records with query parameters.
     * Converts OData-style params to ObjectStack query options.
     */
    async find(resource, params) {
        await this.connect();
        const queryOptions = this.convertQueryParams(params);
        const result = await this.client.data.find(resource, queryOptions);
        return {
            data: result.value,
            total: result.count,
            page: params?.$skip ? Math.floor(params.$skip / (params.$top || 20)) + 1 : 1,
            pageSize: params?.$top,
            hasMore: result.value.length === params?.$top,
        };
    }
    /**
     * Find a single record by ID.
     */
    async findOne(resource, id, _params) {
        await this.connect();
        try {
            const record = await this.client.data.get(resource, String(id));
            return record;
        }
        catch (error) {
            // If record not found, return null instead of throwing
            if (error?.status === 404) {
                return null;
            }
            throw error;
        }
    }
    /**
     * Create a new record.
     */
    async create(resource, data) {
        await this.connect();
        return this.client.data.create(resource, data);
    }
    /**
     * Update an existing record.
     */
    async update(resource, id, data) {
        await this.connect();
        return this.client.data.update(resource, String(id), data);
    }
    /**
     * Delete a record.
     */
    async delete(resource, id) {
        await this.connect();
        const result = await this.client.data.delete(resource, String(id));
        return result.success;
    }
    /**
     * Bulk operations (optional implementation).
     */
    async bulk(resource, operation, data) {
        await this.connect();
        switch (operation) {
            case 'create':
                return this.client.data.createMany(resource, data);
            case 'delete': {
                const ids = data.map(item => item.id).filter(Boolean);
                await this.client.data.deleteMany(resource, ids);
                return [];
            }
            case 'update': {
                // For update, we need to handle each record individually
                // or use the batch update if all records get the same changes
                const results = await Promise.all(data.map(item => this.client.data.update(resource, String(item.id), item)));
                return results;
            }
            default:
                throw new Error(`Unsupported bulk operation: ${operation}`);
        }
    }
    /**
     * Convert ObjectUI QueryParams to ObjectStack QueryOptions.
     * Maps OData-style conventions to ObjectStack conventions.
     */
    convertQueryParams(params) {
        if (!params)
            return {};
        const options = {};
        // Selection
        if (params.$select) {
            options.select = params.$select;
        }
        // Filtering - convert to ObjectStack FilterNode AST format
        if (params.$filter) {
            options.filters = convertFiltersToAST(params.$filter);
        }
        // Sorting - convert to ObjectStack format
        if (params.$orderby) {
            const sortArray = Object.entries(params.$orderby).map(([field, order]) => {
                return order === 'desc' ? `-${field}` : field;
            });
            options.sort = sortArray;
        }
        // Pagination
        if (params.$skip !== undefined) {
            options.skip = params.$skip;
        }
        if (params.$top !== undefined) {
            options.top = params.$top;
        }
        return options;
    }
    /**
     * Get access to the underlying ObjectStack client for advanced operations.
     */
    getClient() {
        return this.client;
    }
}
/**
 * Factory function to create an ObjectStack data source.
 *
 * @example
 * ```typescript
 * const dataSource = createObjectStackAdapter({
 *   baseUrl: process.env.API_URL,
 *   token: process.env.API_TOKEN
 * });
 * ```
 */
export function createObjectStackAdapter(config) {
    return new ObjectStackAdapter(config);
}
