import type { CookieConfig, CookieValue } from "./types";
import { getSingleCookie, parseCookie } from "./cookies";

export interface StorageAdapter {
  get(): CookieValue;
  set(value: CookieValue): void;
  remove(): void;
}

export function cookieStorage(config: CookieConfig): StorageAdapter {
  const { name, path, domain, sameSite, secure, expiresAfterDays } = config;

  const protocol = typeof location !== "undefined" ? location.protocol : "https:";
  const hostname = typeof location !== "undefined" ? location.hostname : "";
  const resolvedDomain = domain || hostname;

  return {
    get(): CookieValue {
      if (typeof document === "undefined") return {} as CookieValue;
      const value = getSingleCookie(name);
      return parseCookie(decodeURIComponent(value));
    },

    set(value: CookieValue): void {
      if (typeof document === "undefined") return;

      const expiresAfterMs =
        typeof expiresAfterDays === "function"
          ? expiresAfterDays("custom") * 86400000
          : expiresAfterDays * 86400000;

      const date = new Date();
      date.setTime(date.getTime() + expiresAfterMs);

      const encodedValue = encodeURIComponent(JSON.stringify(value));

      let cookieStr =
        name +
        "=" +
        encodedValue +
        "; expires=" +
        date.toUTCString() +
        "; Path=" +
        path +
        "; SameSite=" +
        sameSite;

      if (hostname.includes(".")) cookieStr += "; Domain=" + resolvedDomain;
      if (secure && protocol === "https:") cookieStr += "; Secure";

      document.cookie = cookieStr;
    },

    remove(): void {
      if (typeof document === "undefined") return;

      const isWww = resolvedDomain.startsWith("www.");
      const mainDomain = isWww ? resolvedDomain.slice(4) : "";

      const doErase = (d?: string) => {
        let domainStr = "";
        if (d) {
          const prefixed = d.startsWith(".") ? d : "." + d;
          domainStr = "; domain=" + prefixed;
        }
        document.cookie =
          name + "=; path=" + path + domainStr + "; expires=Thu, 01 Jan 1970 00:00:01 GMT;";
      };

      doErase(resolvedDomain);
      if (isWww) doErase(mainDomain);
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
        localStorage.setItem(name, encodeURIComponent(JSON.stringify(value)));
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
