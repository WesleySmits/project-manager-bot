/**
 * Simple in-memory TTL cache for Notion database fetches.
 * Prevents hammering the Notion API on every page load.
 * Default TTL: 5 minutes.
 */

const TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry<T> {
    value: T;
    expiresAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();

/**
 * Get a cached value, or run `fn` to populate it.
 * The result is stored for TTL_MS milliseconds.
 */
export async function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const now = Date.now();
    const entry = store.get(key) as CacheEntry<T> | undefined;

    if (entry && entry.expiresAt > now) {
        return entry.value;
    }

    const value = await fn();
    store.set(key, { value, expiresAt: now + TTL_MS });
    return value;
}

/**
 * Explicitly invalidate one or all cache entries.
 * Call after write operations (createPage, updatePage) to keep data fresh.
 */
export function invalidate(key?: string): void {
    if (key) {
        store.delete(key);
    } else {
        store.clear();
    }
}
