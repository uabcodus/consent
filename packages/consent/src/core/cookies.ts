import type { CookieConfig, CookieValue } from "./types";
import { safeRun } from "./utils";

const DEFAULT_COOKIE_NAME = "cc_cookie";

const defaultCookieConfig: CookieConfig = {
  name: DEFAULT_COOKIE_NAME,
  expiresAfterDays: 182,
  domain: "",
  path: "/",
  secure: true,
  sameSite: "Lax",
};

export function resolveCookieConfig(userCookie?: Partial<CookieConfig>): CookieConfig {
  const config = { ...defaultCookieConfig, ...userCookie };
  if (typeof window !== "undefined") {
    config.domain = config.domain || location.hostname;
  }
  return config;
}

export function getSingleCookie(name: string): string {
  if (typeof document === "undefined") return "";
  const found = document.cookie.match("(^|;)\\s*" + name + "\\s*=\\s*([^;]+)");
  return found ? (found.pop() ?? "") : "";
}

export function getAllCookieNames(regex?: RegExp): Array<string> {
  if (typeof document === "undefined") return [];
  const allCookies = document.cookie.split(/;\s*/);
  const names: Array<string> = [];
  for (const cookie of allCookies) {
    const name = cookie.split("=")[0];
    if (regex) {
      if (safeRun(() => regex.test(name))) names.push(name);
    } else {
      names.push(name);
    }
  }
  return names;
}

export function parseCookie(value: string | null | undefined): CookieValue {
  if (!value) return {} as CookieValue;
  const parsed = safeRun(() => JSON.parse(value), null);
  return (parsed && typeof parsed === "object" ? parsed : {}) as CookieValue;
}

export function parseConsentCookie(cookieString: string | undefined | null): CookieValue | null {
  if (!cookieString) return null;
  try {
    const decoded = decodeURIComponent(cookieString);
    const parsed = JSON.parse(decoded);
    if (!parsed || typeof parsed !== "object") return null;
    if (!parsed.consentId) return null;
    return parsed as CookieValue;
  } catch {
    return null;
  }
}

export function getPluginCookie(config: CookieConfig): CookieValue {
  const name = config.name;
  if (config.useLocalStorage) {
    try {
      const stored = localStorage.getItem(name);
      return stored ? parseCookie(stored) : ({} as CookieValue);
    } catch {
      return {} as CookieValue;
    }
  }
  const value = getSingleCookie(name);
  return parseCookie(decodeURIComponent(value));
}

export function setCookieValue(
  cookieContent: CookieValue,
  config: CookieConfig,
  _useRemainingExpirationTime?: boolean,
): void {
  if (typeof document === "undefined") return;

  const { name, path, domain, sameSite, secure, useLocalStorage } = config;
  const protocol = typeof location !== "undefined" ? location.protocol : "https:";
  const hostname = typeof location !== "undefined" ? location.hostname : "";

  const expiresAfterMs =
    typeof config.expiresAfterDays === "function"
      ? config.expiresAfterDays("custom") * 86400000
      : config.expiresAfterDays * 86400000;

  const date = new Date();
  date.setTime(date.getTime() + expiresAfterMs);

  const value = JSON.stringify(cookieContent);
  const encodedValue = encodeURIComponent(value);

  if (useLocalStorage) {
    try {
      localStorage.setItem(name, encodedValue);
    } catch {
      /* noop */
    }
    return;
  }

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

  if (hostname.includes(".")) cookieStr += "; Domain=" + domain;
  if (secure && protocol === "https:") cookieStr += "; Secure";

  document.cookie = cookieStr;
}

export function eraseCookiesHelper(cookieNames: Array<string>, domain: string, path: string): void {
  if (cookieNames.length === 0 || typeof document === "undefined") return;

  const isWww = domain.startsWith("www.");
  const mainDomain = isWww ? domain.slice(4) : "";

  const erase = (cookie: string, d?: string) => {
    let domainStr = "";
    if (d) {
      const prefixed = d.startsWith(".") ? d : "." + d;
      domainStr = "; domain=" + prefixed;
    }
    document.cookie =
      cookie + "=; path=" + path + domainStr + "; expires=Thu, 01 Jan 1970 00:00:01 GMT;";
  };

  for (const cookieName of cookieNames) {
    erase(cookieName, domain);
    if (isWww) erase(cookieName, mainDomain);
  }
}

export interface AutoClearCategoryConfig {
  autoClear?: {
    reloadPage?: boolean;
    cookies?: Array<{ name: string | RegExp; path?: string; domain?: string }>;
  };
  services?: Record<
    string,
    {
      onAccept?: () => void;
      onReject?: () => void;
      cookies?: Array<{ name: string | RegExp; path?: string; domain?: string }>;
    }
  >;
}

export function autoclearRejectedCookies(
  categoryNames: Array<string>,
  categoryConfigs: Record<string, AutoClearCategoryConfig>,
  acceptedCategories: Array<string>,
  _acceptedServices: Record<string, Array<string>>,
  cookieConfig: CookieConfig,
): { reload: boolean } {
  const allCookies = getAllCookieNames();
  let reload = false;

  for (const categoryName of categoryNames) {
    const cat = categoryConfigs[categoryName];
    if (!cat?.autoClear) continue;

    const isDisabled = !acceptedCategories.includes(categoryName);
    if (!isDisabled) continue;

    if (cat.autoClear.cookies) {
      for (const item of cat.autoClear.cookies) {
        const found = findMatchingCookies(allCookies, item.name);
        eraseCookiesHelper(
          found,
          item.domain ?? cookieConfig.domain,
          item.path ?? cookieConfig.path,
        );
      }
    }

    if (cat.autoClear.reloadPage) reload = true;
  }

  return { reload };
}

function findMatchingCookies(allCookies: Array<string>, name: string | RegExp): Array<string> {
  if (name instanceof RegExp) {
    return allCookies.filter((c) => name.test(c));
  }
  return allCookies.includes(name) ? [name] : [];
}
