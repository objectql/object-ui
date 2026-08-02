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
 * Statistics reported by {@link MetadataCache.getStats} for monitoring.
 *
 * NOT the spec's `CacheStats` (`@objectstack/spec/contracts`), whose name this
 * interface wore until objectui#3160 (objectstack#4115 ledger batch 6). That one
 * describes the platform's `ICacheService` — a server-side KV cache measured by
 * `keyCount` and `memoryUsage`. This one describes the browser-side LRU in front
 * of `/api/v1/meta/*`: it is bounded (`size`/`maxSize`), it evicts, it coalesces
 * concurrent fetches onto one in-flight promise, and it reports a `hitRate`.
 * Neither type has a key the other has, so this is a name collision, not a
 * dialect — deriving would have replaced every field.
 */
export interface MetadataCacheStats {
  size: number;
  maxSize: number;
  hits: number;
  misses: number;
  evictions: number;
  /** Number of concurrent fetches that were coalesced onto an in-flight request. */
  coalesced: number;
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
 * Concurrent requests for the same uncached key are deduplicated via an
 * internal in-flight Promise map: only the first call invokes the fetcher,
 * and subsequent callers receive the same Promise.
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
  private inflight: Map<string, Promise<unknown>>;
  private maxSize: number;
  private ttl: number;
  private stats: {
    hits: number;
    misses: number;
    evictions: number;
    coalesced: number;
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
    this.inflight = new Map();
    this.maxSize = options.maxSize || 100;
    this.ttl = options.ttl || 5 * 60 * 1000; // 5 minutes default
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      coalesced: 0,
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

    // Cache miss - dedupe concurrent fetches for the same key
    const existing = this.inflight.get(key);
    if (existing) {
      this.stats.coalesced++;
      return existing as Promise<T>;
    }

    this.stats.misses++;
    const promise = (async () => {
      try {
        const data = await fetcher();
        this.set(key, data);
        return data;
      } finally {
        this.inflight.delete(key);
      }
    })();
    this.inflight.set(key, promise as Promise<unknown>);
    return promise;
  }

  /**
   * Prime the cache with a pre-fetched value. Useful when a bulk endpoint
   * (e.g. list of all object schemas) returns data that would otherwise
   * be fetched again per item.
   */
  prime(key: string, data: unknown): void {
    this.set(key, data);
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
    this.inflight.clear();
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      coalesced: 0,
    };
  }

  /**
   * Get cache statistics
   * 
   * @returns Cache statistics including hit rate
   */
  getStats(): MetadataCacheStats {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? this.stats.hits / total : 0;

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hits: this.stats.hits,
      misses: this.stats.misses,
      evictions: this.stats.evictions,
      coalesced: this.stats.coalesced,
      hitRate: hitRate,
    };
  }

  /**
   * Get a cached value synchronously without triggering a fetch.
   * Returns undefined if not in cache or expired.
   */
  getCachedSync<V = unknown>(key: string): V | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    // Check TTL
    if (this.ttl > 0 && Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return undefined;
    }

    // Update access order for LRU
    this.cache.delete(key);
    this.cache.set(key, entry);
    this.stats.hits++;

    return entry.data as V;
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
