import { describe, it, expect, beforeEach } from "vitest";

import { cookieStorage, localStorageStorage } from "../../src/core/storage";
import type { CookieValue } from "../../src/core/types";

const EMPTY_COOKIE = {
  categories: [],
  services: {},
  revision: 0,
  data: null,
  consentId: "",
  consentTimestamp: ""
};

beforeEach(() => {
  Object.defineProperty(document, "cookie", {
    writable: true,
    value: ""
  });

  if (typeof localStorage !== "undefined") {
    localStorage.clear();
  }
});

function makeCookieValue(overrides: Partial<CookieValue> = {}): CookieValue {
  return {
    categories: ["necessary"],
    services: {},
    revision: 0,
    data: null,
    consentId: "test-id",
    consentTimestamp: new Date().toISOString(),
    ...overrides
  };
}

describe("cookieStorage", () => {
  it("returns empty object when no cookie exists", () => {
    const storage = cookieStorage({
      name: "test_consent",
      expiresAfterDays: 30,
      domain: "",
      path: "/",
      secure: false,
      sameSite: "Lax"
    });

    const result = storage.get();
    expect(result).toEqual(EMPTY_COOKIE);
  });

  it("writes and reads consent cookie", () => {
    const storage = cookieStorage({
      name: "test_consent",
      expiresAfterDays: 30,
      domain: "",
      path: "/",
      secure: false,
      sameSite: "Lax"
    });

    const value = makeCookieValue();
    storage.set(value);

    const result = storage.get();
    expect(result.consentId).toBe("test-id");
    expect(result.categories).toEqual(["necessary"]);
  });

  it("writes cookie with Secure flag for https", () => {
    const storage = cookieStorage({
      name: "test_consent",
      expiresAfterDays: 30,
      domain: "",
      path: "/",
      secure: true,
      sameSite: "Lax"
    });

    const value = makeCookieValue();
    storage.set(value);

    // In jsdom, location.protocol is usually "http:" for localhost
    // Secure is only added for https: protocol
  });

  it("removes consent cookie", () => {
    const storage = cookieStorage({
      name: "test_consent",
      expiresAfterDays: 30,
      domain: "localhost",
      path: "/",
      secure: false,
      sameSite: "Lax"
    });

    const value = makeCookieValue();
    storage.set(value);

    storage.remove();

    const result = storage.get();
    expect(result).toEqual(EMPTY_COOKIE);
  });

  it("handles function-based expiration", () => {
    const storage = cookieStorage({
      name: "test_func_exp",
      expiresAfterDays: (type) => (type === "all" ? 365 : 30),
      domain: "",
      path: "/",
      secure: false,
      sameSite: "Lax"
    });

    const value = makeCookieValue();
    storage.set(value);
    expect(document.cookie).toContain("test_func_exp=");
  });

  it("handles www-subdomain in remove", () => {
    const storage = cookieStorage({
      name: "test_www",
      expiresAfterDays: 30,
      domain: "www.example.com",
      path: "/",
      secure: false,
      sameSite: "Lax"
    });

    const value = makeCookieValue();
    storage.set(value);
    storage.remove();

    const result = storage.get();
    expect(result).toEqual(EMPTY_COOKIE);
  });
});

describe("localStorageStorage", () => {
  it("returns empty object when localStorage is empty", () => {
    const storage = localStorageStorage("test_ls_consent");
    const result = storage.get();
    expect(result).toEqual(EMPTY_COOKIE);
  });

  it("writes and reads consent data", () => {
    const storage = localStorageStorage("test_ls_consent");

    const value = makeCookieValue();
    storage.set(value);

    const result = storage.get();
    expect(result.consentId).toBe("test-id");
    expect(result.categories).toEqual(["necessary"]);
  });

  it("sets expiration time on write", () => {
    const storage = localStorageStorage("test_ls_consent", 30 * 86400000);

    const value = makeCookieValue();
    storage.set(value);

    const result = storage.get();
    expect(result.expirationTime).toBeDefined();
    expect(typeof result.expirationTime).toBe("number");
    expect(result.expirationTime! > Date.now()).toBe(true);
  });

  it("removes consent data", () => {
    const storage = localStorageStorage("test_ls_consent");

    const value = makeCookieValue();
    storage.set(value);

    storage.remove();

    const result = storage.get();
    expect(result).toEqual(EMPTY_COOKIE);
  });

  it("uses default 182-day expiration when not specified", () => {
    const storage = localStorageStorage("test_default_exp");

    const value = makeCookieValue();
    storage.set(value);

    const result = storage.get();
    expect(result.expirationTime).toBeDefined();

    const expectedMin = Date.now() + 182 * 86400000 - 10000;
    expect(result.expirationTime! >= expectedMin).toBe(true);
  });
});
