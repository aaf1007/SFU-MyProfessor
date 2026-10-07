import { normalizeName } from "./name-match";
import type { ProfessorData } from "../shared/professor";

// Persistent schedule-lookup cache in chrome.storage.local. "Not on RMP" results are
// cached too (for less time) so TAs and sessionals don't re-query on every visit.
// Failures are never cached.

export const FOUND_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const NOT_FOUND_TTL_MS = 24 * 60 * 60 * 1000;
// Bump the version when ProfessorData's shape changes so old entries are ignored.
const KEY_PREFIX = "professor:v2:";

interface CacheEntry {
  data: ProfessorData | null;
  expiresAt: number;
}

/** The subset of chrome.storage.StorageArea the cache uses (injectable for tests). */
export interface CacheStorage {
  get(keys: string | null): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string | string[]): Promise<void>;
}

const isEntry = (value: unknown): value is CacheEntry =>
  !!value && typeof value === "object" &&
  typeof (value as CacheEntry).expiresAt === "number" &&
  "data" in value;

export function createProfessorCache(storage: CacheStorage, now: () => number = Date.now) {
  const keyFor = (name: string) => `${KEY_PREFIX}${normalizeName(name)}`;

  /** Cached data, `null` for a cached "not found", or `undefined` on a miss. */
  async function get(name: string): Promise<ProfessorData | null | undefined> {
    const key = keyFor(name);
    try {
      const entry = (await storage.get(key))[key];
      if (!isEntry(entry)) return undefined;
      if (entry.expiresAt <= now()) {
        await storage.remove(key);
        return undefined;
      }
      return entry.data;
    } catch (error) {
      console.warn("Professor cache read failed:", error);
      return undefined;
    }
  }

  async function set(name: string, data: ProfessorData | null): Promise<void> {
    const entry: CacheEntry = { data, expiresAt: now() + (data ? FOUND_TTL_MS : NOT_FOUND_TTL_MS) };
    try {
      await storage.set({ [keyFor(name)]: entry });
    } catch (error) {
      console.warn("Professor cache write failed:", error);
    }
  }

  /** Removes expired entries and entries from older cache versions. */
  async function prune(): Promise<void> {
    try {
      const all = await storage.get(null);
      const stale = Object.entries(all)
        .filter(([key, value]) => key.startsWith("professor:") &&
          (!key.startsWith(KEY_PREFIX) || !isEntry(value) || value.expiresAt <= now()))
        .map(([key]) => key);
      if (stale.length) await storage.remove(stale);
    } catch (error) {
      console.warn("Professor cache prune failed:", error);
    }
  }

  return { get, set, prune };
}
