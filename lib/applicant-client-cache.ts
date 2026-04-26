"use client"

type ClientCacheEntry<T> = {
  data: T
  expiresAt: number
}

const STORAGE_PREFIX = "visa-assistant:client-cache:"
const memoryCache = new Map<string, ClientCacheEntry<unknown>>()

export const APPLICANT_SELECTOR_CACHE_KEY = "applicants:selector:v2"
export const APPLICANT_SELECTOR_CACHE_TTL_MS = 45_000
export const APPLICANT_DETAIL_CACHE_TTL_MS = 60_000
export const APPLICANT_CRM_LIST_CACHE_PREFIX = "applicants:crm-list:v1:"
export const APPLICANT_CRM_LIST_CACHE_TTL_MS = 45_000
export const APPLICANT_CRM_SUMMARY_CACHE_PREFIX = "applicants:crm-summary:v1:"
export const APPLICANT_CRM_SUMMARY_CACHE_TTL_MS = 60_000
export const APPLICANT_CRM_ASSIGNEES_CACHE_PREFIX = "applicants:crm-assignees:v1:"
export const APPLICANT_CRM_ASSIGNEES_CACHE_TTL_MS = 300_000
export const FRANCE_AUTOMATION_PROFILES_CACHE_PREFIX = "france-automation:profiles:v1:"
export const FRANCE_AUTOMATION_PROFILES_CACHE_TTL_MS = 60_000

function getStorageKey(key: string) {
  return `${STORAGE_PREFIX}${key}`
}

function isExpired(entry: ClientCacheEntry<unknown>) {
  return entry.expiresAt <= Date.now()
}

function writeToStorage(key: string, entry: ClientCacheEntry<unknown>) {
  if (typeof window === "undefined") return
  try {
    window.sessionStorage.setItem(getStorageKey(key), JSON.stringify(entry))
  } catch {
    // Ignore storage quota and privacy mode errors.
  }
}

function removeFromStorage(key: string) {
  if (typeof window === "undefined") return
  try {
    window.sessionStorage.removeItem(getStorageKey(key))
  } catch {
    // Ignore storage access failures.
  }
}

export function getApplicantDetailCacheKey(applicantId: string, view: "full" | "active" = "full") {
  return `applicant-detail:${view}:${applicantId}`
}

export function getApplicantCrmListCacheKey(query: string) {
  return `${APPLICANT_CRM_LIST_CACHE_PREFIX}${query || "__default__"}`
}

export function getApplicantCrmSummaryCacheKey(scopeKey: string) {
  return `${APPLICANT_CRM_SUMMARY_CACHE_PREFIX}${scopeKey || "__default__"}`
}

export function getApplicantCrmAssigneesCacheKey(scopeKey: string) {
  return `${APPLICANT_CRM_ASSIGNEES_CACHE_PREFIX}${scopeKey || "__default__"}`
}

export function getFranceAutomationProfilesCacheKey(scopeKey: string) {
  return `${FRANCE_AUTOMATION_PROFILES_CACHE_PREFIX}${scopeKey || "__default__"}`
}

export function readClientCache<T>(key: string) {
  const memoryEntry = memoryCache.get(key)
  if (memoryEntry) {
    if (isExpired(memoryEntry)) {
      memoryCache.delete(key)
      removeFromStorage(key)
      return null
    }
    return memoryEntry.data as T
  }

  if (typeof window === "undefined") return null

  try {
    const raw = window.sessionStorage.getItem(getStorageKey(key))
    if (!raw) return null
    const parsed = JSON.parse(raw) as ClientCacheEntry<T>
    if (!parsed || typeof parsed !== "object" || typeof parsed.expiresAt !== "number") {
      removeFromStorage(key)
      return null
    }
    if (isExpired(parsed as ClientCacheEntry<unknown>)) {
      memoryCache.delete(key)
      removeFromStorage(key)
      return null
    }
    memoryCache.set(key, parsed as ClientCacheEntry<unknown>)
    return parsed.data
  } catch {
    removeFromStorage(key)
    return null
  }
}

export function writeClientCache<T>(key: string, data: T, ttlMs: number) {
  const entry: ClientCacheEntry<T> = {
    data,
    expiresAt: Date.now() + ttlMs,
  }
  memoryCache.set(key, entry as ClientCacheEntry<unknown>)
  writeToStorage(key, entry as ClientCacheEntry<unknown>)
}

export function clearClientCache(key: string) {
  memoryCache.delete(key)
  removeFromStorage(key)
}

export function clearClientCacheByPrefix(prefix: string) {
  for (const key of memoryCache.keys()) {
    if (key.startsWith(prefix)) {
      memoryCache.delete(key)
    }
  }

  if (typeof window === "undefined") return

  try {
    const storagePrefix = getStorageKey(prefix)
    for (let index = window.sessionStorage.length - 1; index >= 0; index -= 1) {
      const key = window.sessionStorage.key(index)
      if (key && key.startsWith(storagePrefix)) {
        window.sessionStorage.removeItem(key)
      }
    }
  } catch {
    // Ignore storage access failures.
  }
}

export async function prefetchJsonIntoClientCache<T>(
  key: string,
  url: string,
  options: {
    ttlMs: number
    force?: boolean
    init?: RequestInit
  },
) {
  if (!options.force) {
    const cached = readClientCache<T>(key)
    if (cached) return cached
  }

  const response = await fetch(url, {
    cache: "no-store",
    credentials: "include",
    ...options.init,
  })

  if (!response.ok) {
    throw new Error(`Failed to prefetch ${url}: ${response.status}`)
  }

  const data = (await response.json()) as T
  writeClientCache(key, data, options.ttlMs)
  return data
}
