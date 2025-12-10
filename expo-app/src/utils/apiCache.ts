// API Cache Utility - Prevents excessive API calls
// Simple in-memory cache with TTL (Time To Live)

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class ApiCache {
  private cache = new Map<string, CacheEntry<any>>();
  private pendingRequests = new Map<string, Promise<any>>();

  // Get cached data if valid, otherwise return null
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  // Set cache with TTL (default 30 seconds)
  set<T>(key: string, data: T, ttlMs: number = 30000): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlMs,
    });
  }

  // Invalidate specific cache key
  invalidate(key: string): void {
    this.cache.delete(key);
  }

  // Invalidate all cache keys matching a prefix
  invalidatePrefix(prefix: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  // Clear all cache
  clear(): void {
    this.cache.clear();
  }

  // Deduplicate concurrent requests for the same key
  async dedupe<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    // Check cache first
    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Check if request is already pending
    const pending = this.pendingRequests.get(key);
    if (pending) {
      return pending;
    }

    // Make request and cache result
    const promise = fetcher().then((data) => {
      this.set(key, data);
      this.pendingRequests.delete(key);
      return data;
    }).catch((error) => {
      this.pendingRequests.delete(key);
      throw error;
    });

    this.pendingRequests.set(key, promise);
    return promise;
  }
}

// Singleton instance
export const apiCache = new ApiCache();

// Debounce utility function
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  waitMs: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | null = null;

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      func(...args);
    }, waitMs);
  };
}

// Throttle utility function - ensures function runs at most once per interval
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limitMs: number
): (...args: Parameters<T>) => void {
  let lastRun = 0;
  let pendingArgs: Parameters<T> | null = null;
  let timeoutId: NodeJS.Timeout | null = null;

  return (...args: Parameters<T>) => {
    const now = Date.now();
    const timeSinceLastRun = now - lastRun;

    if (timeSinceLastRun >= limitMs) {
      lastRun = now;
      func(...args);
    } else {
      pendingArgs = args;
      if (!timeoutId) {
        timeoutId = setTimeout(() => {
          lastRun = Date.now();
          if (pendingArgs) {
            func(...pendingArgs);
            pendingArgs = null;
          }
          timeoutId = null;
        }, limitMs - timeSinceLastRun);
      }
    }
  };
}

