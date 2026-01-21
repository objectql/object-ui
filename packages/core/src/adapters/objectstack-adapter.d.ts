/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { ObjectStackClient } from '@objectstack/client';
import type { DataSource, QueryParams, QueryResult } from '@object-ui/types';
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
export declare class ObjectStackAdapter<T = any> implements DataSource<T> {
    private client;
    private connected;
    constructor(config: {
        baseUrl: string;
        token?: string;
        fetch?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
    });
    /**
     * Ensure the client is connected to the server.
     * Call this before making requests or it will auto-connect on first request.
     */
    connect(): Promise<void>;
    /**
     * Find multiple records with query parameters.
     * Converts OData-style params to ObjectStack query options.
     */
    find(resource: string, params?: QueryParams): Promise<QueryResult<T>>;
    /**
     * Find a single record by ID.
     */
    findOne(resource: string, id: string | number, _params?: QueryParams): Promise<T | null>;
    /**
     * Create a new record.
     */
    create(resource: string, data: Partial<T>): Promise<T>;
    /**
     * Update an existing record.
     */
    update(resource: string, id: string | number, data: Partial<T>): Promise<T>;
    /**
     * Delete a record.
     */
    delete(resource: string, id: string | number): Promise<boolean>;
    /**
     * Bulk operations (optional implementation).
     */
    bulk(resource: string, operation: 'create' | 'update' | 'delete', data: Partial<T>[]): Promise<T[]>;
    /**
     * Convert ObjectUI QueryParams to ObjectStack QueryOptions.
     * Maps OData-style conventions to ObjectStack conventions.
     */
    private convertQueryParams;
    /**
     * Get access to the underlying ObjectStack client for advanced operations.
     */
    getClient(): ObjectStackClient;
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
export declare function createObjectStackAdapter<T = any>(config: {
    baseUrl: string;
    token?: string;
    fetch?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
}): DataSource<T>;
