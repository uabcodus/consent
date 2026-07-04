import { describe, it, expect, beforeEach, vi } from "vitest";
import { createConsent } from "../../src/core/consent";

function mockCookie(name: string, value: string) {
  Object.defineProperty(document, "cookie", {
    writable: true,
    value: `${name}=${encodeURIComponent(value)}`,
  });
}

function clearCookies() {
  Object.defineProperty(document, "cookie", {
    writable: true,
    value: "",
  });
}

beforeEach(() => {
  clearCookies();
  document.documentElement.innerHTML = "";
});

const basicConfig = {
  mode: "opt-in" as const,
  categories: {
    necessary: { readOnly: true } as const,
    analytics: {} as const,
    marketing: {} as const,
  },
};

describe("createConsent", () => {
  describe("initialization", () => {
    it("creates a consent instance with initial state", () => {
      const consent = createConsent(basicConfig);

      expect(consent.state.valid).toBe(false);
      expect(consent.state.skipped).toBe(false);
      expect(consent.state.mode).toBe("opt-in");
    });

    it("accepts only readOnly categories by default in opt-in mode", () => {
      const consent = createConsent(basicConfig);

      expect(consent.state.categories.necessary.accepted).toBe(true);
      expect(consent.state.categories.analytics.accepted).toBe(false);
      expect(consent.state.categories.marketing.accepted).toBe(false);
    });

    it("marks readOnly categories correctly", () => {
      const consent = createConsent(basicConfig);

      expect(consent.state.categories.necessary.readOnly).toBe(true);
      expect(consent.state.categories.analytics.readOnly).toBe(false);
      expect(consent.state.categories.marketing.readOnly).toBe(false);
    });

    it("accepts default-enabled categories in opt-out mode", () => {
      const consent = createConsent({
        mode: "opt-out",
        categories: {
          necessary: { readOnly: true },
          analytics: { enabled: true },
          marketing: {} as const,
        },
      });

      expect(consent.state.categories.necessary.accepted).toBe(true);
      expect(consent.state.categories.analytics.accepted).toBe(true);
      expect(consent.state.categories.marketing.accepted).toBe(false);
    });

    it("starts valid when valid cookie is provided via initialCookie", () => {
      const cookieValue = {
        categories: ["necessary", "analytics"],
        services: {},
        revision: 0,
        data: null,
        consentId: "test-id",
        consentTimestamp: new Date().toISOString(),
        lastConsentTimestamp: new Date().toISOString(),
      };

      const consent = createConsent({
        ...basicConfig,
        initialCookie: cookieValue,
      });

      expect(consent.state.valid).toBe(true);
      expect(consent.state.cookie).toEqual(cookieValue);
    });

    it("starts valid when valid cookie string is provided via initialCookie", () => {
      const cookieValue = {
        categories: ["necessary"],
        services: {},
        revision: 0,
        data: null,
        consentId: "test-id",
        consentTimestamp: new Date().toISOString(),
        lastConsentTimestamp: new Date().toISOString(),
      };

      const consent = createConsent({
        ...basicConfig,
        initialCookie: JSON.stringify(cookieValue),
      });

      expect(consent.state.valid).toBe(true);
    });

    it("detects bots and marks skipped", () => {
      const originalWebdriver = navigator.webdriver;
      Object.defineProperty(navigator, "webdriver", {
        writable: true,
        value: true,
      });

      const consent = createConsent(basicConfig);

      expect(consent.state.skipped).toBe(true);
      expect(consent.state.valid).toBe(true);

      Object.defineProperty(navigator, "webdriver", {
        writable: true,
        value: originalWebdriver,
      });
    });

    it("does not skip bots when hideFromBots is false", () => {
      const originalWebdriver = navigator.webdriver;
      Object.defineProperty(navigator, "webdriver", {
        writable: true,
        value: true,
      });

      const consent = createConsent({
        ...basicConfig,
        hideFromBots: false,
      });

      expect(consent.state.skipped).toBe(false);

      Object.defineProperty(navigator, "webdriver", {
        writable: true,
        value: originalWebdriver,
      });
    });
  });

  describe("accept", () => {
    it("accepts all categories", () => {
      const consent = createConsent(basicConfig);

      consent.accept("all");

      expect(consent.state.valid).toBe(true);
      expect(consent.state.categories.necessary.accepted).toBe(true);
      expect(consent.state.categories.analytics.accepted).toBe(true);
      expect(consent.state.categories.marketing.accepted).toBe(true);
      expect(consent.state.acceptType).toBe("all");
    });

    it("accepts necessary only", () => {
      const consent = createConsent(basicConfig);

      consent.accept("necessary");

      expect(consent.state.valid).toBe(true);
      expect(consent.state.categories.necessary.accepted).toBe(true);
      expect(consent.state.categories.analytics.accepted).toBe(false);
      expect(consent.state.categories.marketing.accepted).toBe(false);
      expect(consent.state.acceptType).toBe("necessary");
    });

    it("accepts specific categories by name", () => {
      const consent = createConsent(basicConfig);

      consent.accept("analytics");

      expect(consent.state.categories.analytics.accepted).toBe(true);
      expect(consent.state.categories.marketing.accepted).toBe(false);
      expect(consent.state.acceptType).toBe("custom");
    });

    it("accepts multiple categories as array", () => {
      const consent = createConsent(basicConfig);

      consent.accept(["analytics", "marketing"]);

      expect(consent.state.categories.analytics.accepted).toBe(true);
      expect(consent.state.categories.marketing.accepted).toBe(true);
      expect(consent.state.acceptType).toBe("all");
    });

    it("excludes specific categories", () => {
      const consent = createConsent(basicConfig);

      consent.accept("all", ["marketing"]);

      expect(consent.state.categories.analytics.accepted).toBe(true);
      expect(consent.state.categories.marketing.accepted).toBe(false);
      expect(consent.state.acceptType).toBe("custom");
    });

    it("fires onFirstConsent callback on first accept", () => {
      const onFirstConsent = vi.fn();
      const onConsent = vi.fn();

      const consent = createConsent({
        ...basicConfig,
        callbacks: { onFirstConsent, onConsent },
      });

      consent.accept("all");

      expect(onFirstConsent).toHaveBeenCalledTimes(1);
      expect(onConsent).toHaveBeenCalledTimes(1);
      expect(onFirstConsent.mock.calls[0][0].cookie).toBeDefined();
    });

    it("fires onChange callback on subsequent accept changes", () => {
      const onChange = vi.fn();

      const consent = createConsent({
        ...basicConfig,
        callbacks: { onChange },
      });

      consent.accept("all");
      expect(onChange).not.toHaveBeenCalled();

      consent.reject("analytics");
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange.mock.calls[0][0].changedCategories).toContain("analytics");
    });

    it("supports runtime event listeners", () => {
      const listener = vi.fn();
      const consent = createConsent(basicConfig);

      const unsub = consent.on("firstConsent", listener);
      consent.accept("all");

      expect(listener).toHaveBeenCalledTimes(1);

      unsub();
      consent.reset(true);
      consent.accept("all");

      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  describe("reject", () => {
    it("rejects specific categories", () => {
      const consent = createConsent(basicConfig);
      consent.accept("all");

      expect(consent.state.categories.analytics.accepted).toBe(true);

      consent.reject("analytics");

      expect(consent.state.categories.analytics.accepted).toBe(false);
      expect(consent.state.acceptType).toBe("custom");
    });

    it("rejects all categories except readOnly", () => {
      const consent = createConsent(basicConfig);
      consent.accept("all");

      consent.reject("all");

      expect(consent.state.categories.necessary.accepted).toBe(true);
      expect(consent.state.categories.analytics.accepted).toBe(false);
      expect(consent.state.categories.marketing.accepted).toBe(false);
      expect(consent.state.acceptType).toBe("necessary");
    });

    it("cannot reject readOnly categories", () => {
      const consent = createConsent(basicConfig);

      consent.reject("necessary");

      expect(consent.state.categories.necessary.accepted).toBe(true);
    });
  });

  describe("services", () => {
    const servicesConfig = {
      categories: {
        analytics: {
          services: {
            ga: {} as const,
            mixpanel: {} as const,
          },
        },
      },
    };

    it("accepts services", () => {
      const consent = createConsent(servicesConfig);

      consent.acceptService("ga", "analytics");

      expect(consent.state.services.analytics.ga).toBe(true);
      expect(consent.state.services.analytics.mixpanel).toBe(false);
      expect(consent.state.categories.analytics.accepted).toBe(true);
    });

    it("rejects services", () => {
      const consent = createConsent(servicesConfig);

      consent.acceptService("all", "analytics");
      expect(consent.state.services.analytics.ga).toBe(true);
      expect(consent.state.services.analytics.mixpanel).toBe(true);

      consent.rejectService("ga", "analytics");

      expect(consent.state.services.analytics.ga).toBe(false);
      expect(consent.state.services.analytics.mixpanel).toBe(true);
    });

    it("accepts all services in a category", () => {
      const consent = createConsent(servicesConfig);

      consent.acceptService("all", "analytics");

      expect(consent.state.services.analytics.ga).toBe(true);
      expect(consent.state.services.analytics.mixpanel).toBe(true);
    });

    it("acceptedService returns correct value", () => {
      const consent = createConsent(servicesConfig);

      expect(consent.acceptedService("ga", "analytics")).toBe(false);

      consent.acceptService("ga", "analytics");

      expect(consent.acceptedService("ga", "analytics")).toBe(true);
    });
  });

  describe("state", () => {
    it("provides reactive state", () => {
      const consent = createConsent(basicConfig);

      expect(consent.state.categories.analytics.accepted).toBe(false);
      consent.accept("analytics");
      expect(consent.state.categories.analytics.accepted).toBe(true);
    });

    it("state exposes categories and services", () => {
      const consent = createConsent(basicConfig);
      consent.accept("analytics");

      const state = consent.state;
      expect(state.categories.analytics.accepted).toBe(true);
      expect(state.categories.necessary.accepted).toBe(true);
      expect(state.categories.marketing.accepted).toBe(false);
    });
  });

  describe("subscription", () => {
    it("subscribes to state changes", () => {
      const consent = createConsent(basicConfig);
      const listener = vi.fn();

      consent.subscribe(listener);

      consent.accept("all");
      expect(listener).toHaveBeenCalled();

      const state = listener.mock.calls[listener.mock.calls.length - 1]![0];
      expect(state.valid).toBe(true);
    });

    it("unsubscribes correctly", () => {
      const consent = createConsent(basicConfig);
      const listener = vi.fn();

      const unsub = consent.subscribe(listener);
      consent.accept("all");
      expect(listener).toHaveBeenCalledTimes(1);

      unsub();
      consent.reject("analytics");
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  describe("reset", () => {
    it("resets consent state", () => {
      const consent = createConsent(basicConfig);
      consent.accept("all");
      expect(consent.state.valid).toBe(true);

      consent.reset();

      expect(consent.state.valid).toBe(false);
      expect(consent.state.categories.analytics.accepted).toBe(false);
    });

    it("resets and deletes cookie", () => {
      const consent = createConsent(basicConfig);
      consent.accept("all");

      mockCookie(
        "cc_cookie",
        JSON.stringify({
          categories: ["necessary", "analytics"],
          services: {},
          revision: 0,
          data: null,
          consentId: "test",
          consentTimestamp: new Date().toISOString(),
          lastConsentTimestamp: new Date().toISOString(),
        }),
      );

      consent.reset(true);

      const cookie = consent.getCookie() as { consentId?: string };
      expect(cookie.consentId).toBeUndefined();
    });
  });

  describe("cookies", () => {
    it("sets consent cookie on accept", () => {
      const consent = createConsent(basicConfig);
      consent.accept("all");

      expect(document.cookie).toContain("cc_cookie=");
    });

    it("getCookie returns cookie data", () => {
      const consent = createConsent(basicConfig);
      consent.accept("analytics");

      const categoriesField = consent.getCookie("categories");
      expect(categoriesField).toContain("analytics");
    });

    it("setCookieData sets custom data", () => {
      const consent = createConsent(basicConfig);
      consent.accept("all");

      const changed = consent.setCookieData({
        value: { userId: "123" },
        mode: "set",
      });

      expect(changed).toBe(true);

      const data = consent.getCookie("data");
      expect(data).toEqual({ userId: "123" });
    });

    it("getConfig returns configuration", () => {
      const consent = createConsent(basicConfig);
      const config = consent.getConfig() as Record<string, unknown>;

      expect(config.categories).toBeDefined();
      expect(config.mode).toBe("opt-in");
    });
  });

  describe("validConsent", () => {
    it("returns false before consent", () => {
      const consent = createConsent(basicConfig);
      expect(consent.validConsent()).toBe(false);
    });

    it("returns true after consent", () => {
      const consent = createConsent(basicConfig);
      consent.accept("all");
      expect(consent.validConsent()).toBe(true);
    });
  });

  describe("eraseCookies", () => {
    it("erases cookies by name", () => {
      const consent = createConsent(basicConfig);

      Object.defineProperty(document, "cookie", {
        writable: true,
        value: "test_cookie=value1",
      });

      consent.eraseCookies("test_cookie");

      expect(document.cookie).not.toContain("test_cookie=value1");
    });
  });

  describe("loadScript", () => {
    it("resolves true for existing scripts", async () => {
      const consent = createConsent(basicConfig);

      const script = document.createElement("script");
      script.src = "https://example.com/test.js";
      document.head.appendChild(script);

      const result = await consent.loadScript("https://example.com/test.js");
      expect(result).toBe(true);
    });
  });
});
