import { RoastResult } from "./types";

const TTL_MS = 60 * 60 * 1000; // 1 hour

interface CacheEntry {
  result: RoastResult;
  expiresAt: number;
}

const store = new Map<string, CacheEntry>();

export function getCached(url: string): RoastResult | null {
  const entry = store.get(url);
  if (!entry || Date.now() > entry.expiresAt) {
    store.delete(url);
    return null;
  }
  return entry.result;
}

export function setCache(url: string, result: RoastResult): void {
  store.set(url, { result, expiresAt: Date.now() + TTL_MS });
}
