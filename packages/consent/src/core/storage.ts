import type { CookieConfig, CookieValue } from "./types";
import { getSingleCookie, parseCookie, setCookieValue, eraseCookiesHelper } from "./cookies";

export interface StorageAdapter {
  get(): CookieValue;
  set(value: CookieValue): void;
  remove(): void;
}

export function cookieStorage(config: CookieConfig): StorageAdapter {
  const { name, domain } = config;
  const hostname = typeof location !== "undefined" ? location.hostname : "";
  const resolvedDomain = domain || hostname;

  return {
    get(): CookieValue {
      if (typeof document === "undefined") return {} as CookieValue;
      const value = getSingleCookie(name);
      return parseCookie(decodeURIComponent(value));
    },

    set(value: CookieValue): void {
      setCookieValue(value, config);
    },

    remove(): void {
      eraseCookiesHelper([name], resolvedDomain, config.path);
    },
  };
}

export function localStorageStorage(name: string, expiresAfterMs?: number): StorageAdapter {
  const expires = expiresAfterMs ?? 182 * 86400000;

  return {
    get(): CookieValue {
      if (typeof localStorage === "undefined") return {} as CookieValue;
      try {
        const stored = localStorage.getItem(name);
        return stored ? parseCookie(stored) : ({} as CookieValue);
      } catch {
        return {} as CookieValue;
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
    },
  };
}
