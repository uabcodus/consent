import {
  getSingleCookie,
  parseCookie,
  setCookieValue,
  eraseCookiesHelper,
  createEmptyCookieValue,
  safeDecodeURI
} from "./cookies";
import type { CookieConfig, CookieValue, StorageAdapter } from "./types";

export function cookieStorage(config: CookieConfig): StorageAdapter {
  const { name, domain } = config;
  const hostname = typeof location !== "undefined" ? location.hostname : "";
  const resolvedDomain = domain || hostname;

  return {
    get(): CookieValue {
      if (typeof document === "undefined") return createEmptyCookieValue();
      const value = getSingleCookie(name);
      if (!value) return createEmptyCookieValue();
      return parseCookie(safeDecodeURI(value));
    },

    set(value: CookieValue): void {
      setCookieValue(value, config);
    },

    remove(): void {
      eraseCookiesHelper([name], resolvedDomain, config.path);
    }
  };
}

export function localStorageStorage(name: string, expiresAfterMs?: number): StorageAdapter {
  const expires = expiresAfterMs ?? 182 * 86400000;

  return {
    get(): CookieValue {
      if (typeof localStorage === "undefined") return createEmptyCookieValue();
      try {
        const stored = localStorage.getItem(name);
        return stored ? parseCookie(stored) : createEmptyCookieValue();
      } catch {
        return createEmptyCookieValue();
      }
    },

    set(value: CookieValue): void {
      if (typeof localStorage === "undefined") return;
      try {
        value.expirationTime = new Date().getTime() + expires;
        localStorage.setItem(name, JSON.stringify(value));
      } catch {
        /* noop */
      }
    },

    remove(): void {
      if (typeof localStorage === "undefined") return;
      try {
        localStorage.removeItem(name);
      } catch {
        /* noop */
      }
    }
  };
}
