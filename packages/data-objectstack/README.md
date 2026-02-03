# @object-ui/data-objectstack

Official ObjectStack data adapter for Object UI.

## Overview

This package provides the `ObjectStackAdapter` class, which connects Object UI's universal `DataSource` interface with the `@objectstack/client` SDK.

This enables strictly typed, metadata-driven UI components to communicate seamlessly with ObjectStack backends (Steedos, Salesforce, etc.).

## Installation

```bash
npm install @object-ui/data-objectstack @objectstack/client
```

## Usage

### Basic Setup

```typescript
import { createObjectStackAdapter } from '@object-ui/data-objectstack';
import { SchemaRenderer } from '@object-ui/react';

// 1. Create the adapter
const dataSource = createObjectStackAdapter({
  baseUrl: 'https://api.example.com',
  token: 'your-api-token' // Optional if effectively handling auth elsewhere
});

// 2. Pass to the Renderer
function App() {
  return (
    <SchemaRenderer 
      schema={mySchema} 
      dataSource={dataSource} 
    />
  );
}
```

### Advanced Configuration

```typescript
const dataSource = createObjectStackAdapter({
  baseUrl: 'https://api.example.com',
  token: 'your-api-token',
  // Configure metadata cache
  cache: {
    maxSize: 100,      // Maximum number of cached schemas (default: 100)
    ttl: 5 * 60 * 1000 // Time to live in ms (default: 5 minutes)
  },
  // Configure auto-reconnect
  autoReconnect: true,           // Enable auto-reconnect (default: true)
  maxReconnectAttempts: 5,       // Max reconnection attempts (default: 3)
  reconnectDelay: 2000           // Initial delay between reconnects in ms (default: 1000)
});
```

## Features

- ✅ **CRUD Operations**: Implements `find`, `findOne`, `create`, `update`, `delete`.
- ✅ **Metadata Caching**: Automatic LRU caching of schema metadata with TTL expiration.
- ✅ **Metadata Fetching**: Implements `getObjectSchema` to power auto-generated forms and grids.
- ✅ **Query Translation**: Converts Object UI's OData-like query parameters to ObjectStack's native query format.
- ✅ **Bulk Operations**: Supports optimized batch create/update/delete with detailed error reporting.
- ✅ **Error Handling**: Comprehensive error hierarchy with unique error codes and debugging details.
- ✅ **Connection Monitoring**: Real-time connection state tracking with event listeners.
- ✅ **Auto-Reconnect**: Automatic reconnection with exponential backoff on connection failures.
- ✅ **Batch Progress**: Progress events for tracking bulk operation status.

## Metadata Caching

The adapter includes built-in metadata caching to improve performance when fetching schemas:

```typescript
// Get cache statistics
const stats = dataSource.getCacheStats();
console.log(`Cache hit rate: ${stats.hitRate * 100}%`);
console.log(`Cache size: ${stats.size}/${stats.maxSize}`);

// Manually invalidate cache entries
dataSource.invalidateCache('users'); // Invalidate specific schema
dataSource.invalidateCache();        // Invalidate all cached schemas

// Clear cache and statistics
dataSource.clearCache();
```

### Cache Configuration

- **LRU Eviction**: Automatically evicts least recently used entries when cache is full
- **TTL Expiration**: Entries expire after the configured time-to-live from creation (default: 5 minutes)
  - Note: TTL is fixed from creation time, not sliding based on access
- **Memory Limits**: Configurable maximum cache size (default: 100 entries)
- **Concurrent Access**: Handles async operations safely. Note that concurrent requests for the same uncached key may result in multiple fetcher calls.

## Connection State Monitoring

The adapter provides real-time connection state monitoring with automatic reconnection:

```typescript
// Monitor connection state changes
const unsubscribe = dataSource.onConnectionStateChange((event) => {
  console.log('Connection state:', event.state);
  console.log('Timestamp:', new Date(event.timestamp));
  
  if (event.error) {
    console.error('Connection error:', event.error);
  }
});

// Check current connection state
console.log(dataSource.getConnectionState()); // 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error'

// Check if connected
if (dataSource.isConnected()) {
  console.log('Adapter is connected');
}

// Unsubscribe from events when done
unsubscribe();
```

### Connection States

- `disconnected` - Not connected to server
- `connecting` - Attempting initial connection
- `connected` - Successfully connected
- `reconnecting` - Attempting to reconnect after failure
- `error` - Connection failed (check event.error for details)

### Auto-Reconnect

The adapter automatically attempts to reconnect on connection failures:

- **Exponential Backoff**: Delay increases with each attempt (delay × 2^(attempts-1))
- **Configurable Attempts**: Set `maxReconnectAttempts` (default: 3)
- **Configurable Delay**: Set `reconnectDelay` for initial delay (default: 1000ms)
- **Automatic**: Enabled by default, disable with `autoReconnect: false`

## Batch Operation Progress

Track progress of bulk operations in real-time:

```typescript
// Monitor batch operation progress
const unsubscribe = dataSource.onBatchProgress((event) => {
  console.log(`${event.operation}: ${event.percentage.toFixed(1)}%`);
  console.log(`Completed: ${event.completed}/${event.total}`);
  console.log(`Failed: ${event.failed}`);
});

// Perform bulk operation
const users = await dataSource.bulk('users', 'create', largeDataset);

// Unsubscribe when done
unsubscribe();
```

### Progress Event Properties

- `operation` - Operation type ('create' | 'update' | 'delete')
- `total` - Total number of items
- `completed` - Number of successfully completed items
- `failed` - Number of failed items
- `percentage` - Completion percentage (0-100)

## Error Handling

The adapter provides a comprehensive error hierarchy for better error handling:

### Error Types

```typescript
import {
  ObjectStackError,        // Base error class
  MetadataNotFoundError,   // Schema/metadata not found (404)
  BulkOperationError,      // Bulk operation failures with partial results
  ConnectionError,         // Network/connection errors (503/504)
  AuthenticationError,     // Authentication failures (401/403)
  ValidationError,         // Data validation errors (400)
} from '@object-ui/data-objectstack';
```

### Error Handling Example

```typescript
try {
  const schema = await dataSource.getObjectSchema('users');
} catch (error) {
  if (error instanceof MetadataNotFoundError) {
    console.error(`Schema not found: ${error.details.objectName}`);
  } else if (error instanceof ConnectionError) {
    console.error(`Connection failed to: ${error.url}`);
  } else if (error instanceof AuthenticationError) {
    console.error('Authentication required');
  }
  
  // All errors have consistent structure
  console.error({
    code: error.code,
    message: error.message,
    statusCode: error.statusCode,
    details: error.details
  });
}
```

### Bulk Operation Errors

Bulk operations provide detailed error reporting with partial success information:

```typescript
try {
  await dataSource.bulk('users', 'update', records);
} catch (error) {
  if (error instanceof BulkOperationError) {
    const summary = error.getSummary();
    console.log(`${summary.successful} succeeded, ${summary.failed} failed`);
    console.log(`Failure rate: ${summary.failureRate * 100}%`);
    
    // Inspect individual failures
    summary.errors.forEach(({ index, error }) => {
      console.error(`Record ${index} failed:`, error);
    });
  }
}
```

### Error Codes

All errors include unique error codes for programmatic handling:

- `METADATA_NOT_FOUND` - Schema/metadata not found
- `BULK_OPERATION_ERROR` - Bulk operation failure
- `CONNECTION_ERROR` - Connection/network error
- `AUTHENTICATION_ERROR` - Authentication failure
- `VALIDATION_ERROR` - Data validation error
- `UNSUPPORTED_OPERATION` - Unsupported operation
- `NOT_FOUND` - Resource not found
- `UNKNOWN_ERROR` - Unknown error

## Batch Operations

The adapter supports optimized batch operations with automatic fallback:

```typescript
// Batch create
const newUsers = await dataSource.bulk('users', 'create', [
  { name: 'Alice', email: 'alice@example.com' },
  { name: 'Bob', email: 'bob@example.com' },
]);

// Batch update (uses updateMany if available, falls back to individual updates)
const updated = await dataSource.bulk('users', 'update', [
  { id: '1', name: 'Alice Smith' },
  { id: '2', name: 'Bob Jones' },
]);

// Batch delete
await dataSource.bulk('users', 'delete', [
  { id: '1' },
  { id: '2' },
]);
```

### Performance Optimizations

- Automatically uses `createMany`, `updateMany`, `deleteMany` when available
- Falls back to individual operations with detailed error tracking
- Provides partial success reporting for resilient error handling
- Atomic operations where supported by the backend

## API Reference

### ObjectStackAdapter

#### Constructor

```typescript
new ObjectStackAdapter(config: {
  baseUrl: string;
  token?: string;
  fetch?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  cache?: {
    maxSize?: number;
    ttl?: number;
  };
  autoReconnect?: boolean;
  maxReconnectAttempts?: number;
  reconnectDelay?: number;
})
```

#### Methods

- `connect()` - Establish connection to ObjectStack server
- `find(resource, params?)` - Query multiple records
- `findOne(resource, id, params?)` - Get a single record by ID
- `create(resource, data)` - Create a new record
- `update(resource, id, data)` - Update an existing record
- `delete(resource, id)` - Delete a record
- `bulk(resource, operation, data)` - Batch operations (create/update/delete)
- `getObjectSchema(objectName)` - Get schema metadata (cached)
- `getCacheStats()` - Get cache statistics
- `invalidateCache(key?)` - Invalidate cache entries
- `clearCache()` - Clear all cache entries
- `getClient()` - Access underlying ObjectStack client
- `getConnectionState()` - Get current connection state
- `isConnected()` - Check if adapter is connected
- `onConnectionStateChange(listener)` - Subscribe to connection state changes (returns unsubscribe function)
- `onBatchProgress(listener)` - Subscribe to batch operation progress (returns unsubscribe function)

## Best Practices

1. **Enable Caching**: Use default cache settings for optimal performance
2. **Handle Errors**: Use typed error handling for better user experience
3. **Batch Operations**: Use bulk methods for large datasets
4. **Monitor Cache**: Check cache hit rates in production
5. **Invalidate Wisely**: Clear cache after schema changes
6. **Connection Monitoring**: Subscribe to connection state changes for better UX
7. **Auto-Reconnect**: Use default auto-reconnect settings for resilient applications
8. **Batch Progress**: Monitor progress for long-running bulk operations

## Troubleshooting

### Common Issues

#### Schema Not Found

```typescript
// Error: MetadataNotFoundError
// Solution: Verify object name and ensure schema exists on server
const schema = await dataSource.getObjectSchema('correct_object_name');
```

#### Connection Errors

```typescript
// Error: ConnectionError
// Solution: Check baseUrl and network connectivity
const dataSource = createObjectStackAdapter({
  baseUrl: 'https://correct-url.example.com',
  token: 'valid-token'
});
```

#### Cache Issues

```typescript
// Clear cache if stale data is being returned
dataSource.clearCache();

// Or invalidate specific entries
dataSource.invalidateCache('users');
```

## License

MIT
