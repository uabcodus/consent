import type { CookieConfig, CookieValue } from "./types";

export function safeDecodeURI(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function tryParseJson(value: string): unknown | null {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function escapeRegex(name: string): string {
  return name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function getSingleCookie(name: string): string {
  if (typeof document === "undefined") return "";
  const found = document.cookie.match("(^|;)\\s*" + escapeRegex(name) + "\\s*=\\s*([^;]+)");
  return found ? (found.pop() ?? "") : "";
}

export function getAllCookieNames(regex?: RegExp): Array<string> {
  if (typeof document === "undefined") return [];
  const allCookies = document.cookie.split(/;\s*/);
  const names: Array<string> = [];
  for (const cookie of allCookies) {
    const name = cookie.split("=")[0];
    if (!name) continue;
    if (regex) {
      try {
        if (safeRegexTest(regex, name)) names.push(name);
      } catch {
        /* noop */
      }
    } else {
      names.push(name);
    }
  }
  return names;
}

function parseCookieValue(value: string, requiresConsentId: boolean): CookieValue | null {
  const parsed = tryParseJson(value);
  if (!parsed || typeof parsed !== "object") return null;
  if (requiresConsentId && !(parsed as Record<string, unknown>).consentId) return null;
  return parsed as CookieValue;
}

export function parseCookie(value: string | null | undefined): CookieValue {
  if (!value) return createEmptyCookieValue();
  return parseCookieValue(value, false) ?? createEmptyCookieValue();
}

export function parseConsentCookie(cookieString: string | undefined | null): CookieValue | null {
  if (!cookieString) return null;
  try {
    const decoded = safeDecodeURI(cookieString);
    return parseCookieValue(decoded, true);
  } catch {
    return null;
  }
}

export function getPluginCookie(config: CookieConfig): CookieValue {
  const value = getSingleCookie(config.name);
  return parseCookie(safeDecodeURI(value));
}

export function setCookieValue(cookieContent: CookieValue, config: CookieConfig): void {
  if (typeof document === "undefined") return;

  const { name, path, domain, sameSite, secure } = config;
  const protocol = typeof location !== "undefined" ? location.protocol : "https:";
  const hostname = typeof location !== "undefined" ? location.hostname : "";

  const expiresAfterMs =
    typeof config.expiresAfterDays === "function"
      ? config.expiresAfterDays("custom") * 86400000
      : config.expiresAfterDays * 86400000;

  const date = new Date();
  date.setTime(date.getTime() + expiresAfterMs);

  const encodedValue = encodeURIComponent(JSON.stringify(cookieContent));

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
    cookies?: Array<{
      name: string | RegExp;
      path?: string;
      domain?: string;
    }>;
  };
  services?: Record<
    string,
    {
      onAccept?: () => void;
      onReject?: () => void;
      cookies?: Array<{
        name: string | RegExp;
        path?: string;
        domain?: string;
      }>;
    }
  >;
}

export function autoclearRejectedCookies(
  categoryNames: Array<string>,
  categoryConfigs: Record<string, AutoClearCategoryConfig>,
  acceptedCategories: Array<string>,
  defaultDomain: string,
  defaultPath: string
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
        eraseCookiesHelper(found, item.domain ?? defaultDomain, item.path ?? defaultPath);
      }
    }

    if (cat.autoClear.reloadPage) reload = true;
  }

  return { reload };
}

function safeRegexTest(regex: RegExp, str: string): boolean {
  if (regex.global || regex.sticky) {
    const clone = new RegExp(regex.source, regex.flags.replace(/[gy]/g, ""));
    return clone.test(str);
  }
  return regex.test(str);
}

function createEmptyCookieValue(): CookieValue {
  return {
    categories: [],
    services: {},
    revision: 0,
    data: null,
    consentId: "",
    consentTimestamp: ""
  };
}

export { createEmptyCookieValue };

export function findMatchingCookies(
  allCookies: Array<string>,
  name: string | RegExp
): Array<string> {
  if (name instanceof RegExp) {
    return allCookies.filter((c) => safeRegexTest(name, c));
  }
  return allCookies.includes(name) ? [name] : [];
}

export function isCookiePresent(name: string): boolean {
  if (typeof document === "undefined") return false;
  return (
    document.cookie.indexOf(name + "=") !== -1 || document.cookie.indexOf(" " + name + "=") !== -1
  );
}
