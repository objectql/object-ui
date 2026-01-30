/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Represents a cached schema entry with metadata
 */
interface CachedSchema {
  data: unknown;
  timestamp: number;
  accessCount: number;
  lastAccessed: number;
}

/**
 * Cache statistics for monitoring
 */
export interface CacheStats {
  size: number;
  maxSize: number;
  hits: number;
  misses: number;
  evictions: number;
  hitRate: number;
}

/**
 * MetadataCache - LRU cache with TTL expiration for schema metadata
 * 
 * Features:
 * - LRU (Least Recently Used) eviction policy
 * - TTL (Time To Live) based expiration (fixed from creation, not sliding)
 * - Memory limit controls
 * - Async-safe operations
 * - Performance statistics tracking
 * 
 * Note: Concurrent requests for the same uncached key may result in multiple
 * fetcher calls. For production use cases requiring request deduplication,
 * consider wrapping the cache with a promise-based deduplication layer.
 * 
 * @example
 * ```typescript
 * const cache = new MetadataCache({ maxSize: 100, ttl: 300000 });
 * 
 * const schema = await cache.get('users', async () => {
 *   return await fetchSchemaFromServer('users');
 * });
 * 
 * console.log(cache.getStats());
 * ```
 */
export class MetadataCache {
  private cache: Map<string, CachedSchema>;
  private maxSize: number;
  private ttl: number;
  private stats: {
    hits: number;
    misses: number;
    evictions: number;
  };

  /**
   * Create a new MetadataCache instance
   * 
   * @param options - Configuration options
   * @param options.maxSize - Maximum number of entries (default: 100)
   * @param options.ttl - Time to live in milliseconds (default: 5 minutes)
   */
  constructor(options: { maxSize?: number; ttl?: number } = {}) {
    this.cache = new Map();
    this.maxSize = options.maxSize || 100;
    this.ttl = options.ttl || 5 * 60 * 1000; // 5 minutes default
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
    };
  }

  /**
   * Get a value from cache or fetch it using the provided fetcher function
   * 
   * @param key - Cache key
   * @param fetcher - Async function to fetch data if not in cache
   * @returns Promise resolving to the cached or fetched data
   */
  async get<T = unknown>(key: string, fetcher: () => Promise<T>): Promise<T> {
    const now = Date.now();
    const cached = this.cache.get(key);

    // Check if cache entry exists and is not expired
    if (cached) {
      const age = now - cached.timestamp;
      
      if (age < this.ttl) {
        // Cache hit - update access metadata
        cached.accessCount++;
        cached.lastAccessed = now;
        this.stats.hits++;
        
        // Move to end (most recently used) by re-inserting
        this.cache.delete(key);
        this.cache.set(key, cached);
        
        return cached.data as T;
      } else {
        // Expired entry - remove it
        this.cache.delete(key);
      }
    }

    // Cache miss - fetch the data
    this.stats.misses++;
    const data = await fetcher();

    // Store in cache
    this.set(key, data);

    return data;
  }

  /**
   * Set a value in the cache
   * 
   * @param key - Cache key
   * @param data - Data to cache
   */
  private set(key: string, data: unknown): void {
    const now = Date.now();

    // Check if we need to evict entries
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    // Add or update the entry
    this.cache.set(key, {
      data,
      timestamp: now,
      accessCount: 1,
      lastAccessed: now,
    });
  }

  /**
   * Evict the least recently used entry
   */
  private evictLRU(): void {
    // The first entry in the Map is the least recently used
    // (since we move accessed items to the end)
    const firstKey = this.cache.keys().next().value;
    
    if (firstKey !== undefined) {
      this.cache.delete(firstKey);
      this.stats.evictions++;
    }
  }

  /**
   * Invalidate a specific cache entry or all entries
   * 
   * @param key - Optional key to invalidate. If omitted, invalidates all entries
   */
  invalidate(key?: string): void {
    if (key) {
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
  }

  /**
   * Clear all cache entries and reset statistics
   */
  clear(): void {
    this.cache.clear();
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
    };
  }

  /**
   * Get cache statistics
   * 
   * @returns Cache statistics including hit rate
   */
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? this.stats.hits / total : 0;

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hits: this.stats.hits,
      misses: this.stats.misses,
      evictions: this.stats.evictions,
      hitRate: hitRate,
    };
  }

  /**
   * Check if a key exists in the cache (and is not expired)
   * 
   * @param key - Cache key to check
   * @returns true if the key exists and is not expired
   */
  has(key: string): boolean {
    const cached = this.cache.get(key);
    
    if (!cached) {
      return false;
    }

    const age = Date.now() - cached.timestamp;
    
    if (age >= this.ttl) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }
}
