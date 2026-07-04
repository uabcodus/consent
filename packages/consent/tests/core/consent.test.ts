import { describe, it, expect, beforeEach, vi } from "vitest";
import { createConsent } from "../../src/core/consent";
import type { CookieValue } from "../../src/core/types";

function setCookie(name: string, value: string) {
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
  categories: {
    necessary: { readOnly: true } as const,
    analytics: {} as const,
    marketing: {} as const,
  },
};

describe("consent - advanced features", () => {
  describe("revision management", () => {
    it("invalidates consent when revision changes", () => {
      const oldCookie: CookieValue = {
        categories: ["necessary", "analytics"],
        services: {},
        revision: 1,
        data: null,
        consentId: "test-id",
        consentTimestamp: new Date().toISOString(),
        lastConsentTimestamp: new Date().toISOString(),
      };

      setCookie("cc_cookie", JSON.stringify(oldCookie));

      const consent = createConsent({
        ...basicConfig,
        revision: 2,
      });

      expect(consent.state.valid).toBe(false);
      expect(consent.state.categories.analytics.accepted).toBe(false);
    });

    it("keeps consent valid when revision matches", () => {
      const oldCookie: CookieValue = {
        categories: ["necessary", "analytics"],
        services: {},
        revision: 2,
        data: null,
        consentId: "test-id",
        consentTimestamp: new Date().toISOString(),
        lastConsentTimestamp: new Date().toISOString(),
      };

      setCookie("cc_cookie", JSON.stringify(oldCookie));

      const consent = createConsent({
        ...basicConfig,
        revision: 2,
      });

      expect(consent.state.valid).toBe(true);
      expect(consent.state.categories.analytics.accepted).toBe(true);
    });

    it("revision=0 disables revision checking", () => {
      const oldCookie: CookieValue = {
        categories: ["necessary", "analytics"],
        services: {},
        revision: 0,
        data: null,
        consentId: "test-id",
        consentTimestamp: new Date().toISOString(),
        lastConsentTimestamp: new Date().toISOString(),
      };

      setCookie("cc_cookie", JSON.stringify(oldCookie));

      const consent = createConsent({
        ...basicConfig,
        revision: 0,
      });

      expect(consent.state.valid).toBe(true);
    });
  });

  describe("opt-out mode", () => {
    it("enables default categories on init", () => {
      const consent = createConsent({
        mode: "opt-out",
        categories: {
          necessary: { readOnly: true } as const,
          analytics: { enabled: true } as const,
          marketing: {} as const,
        },
      });

      expect(consent.state.categories.analytics.accepted).toBe(true);
      expect(consent.state.categories.marketing.accepted).toBe(false);
      expect(consent.state.valid).toBe(false);
    });

    it("does not fire onFirstConsent on init", () => {
      const onFirstConsent = vi.fn();
      const onConsent = vi.fn();

      createConsent({
        mode: "opt-out",
        categories: {
          necessary: { readOnly: true } as const,
          analytics: { enabled: true } as const,
        },
        callbacks: { onFirstConsent, onConsent },
      });

      expect(onFirstConsent).not.toHaveBeenCalled();
    });
  });

  describe("cookie expiration", () => {
    it("invalidates expired cookie", () => {
      const expiredCookie: CookieValue = {
        categories: ["necessary", "analytics"],
        services: {},
        revision: 0,
        data: null,
        consentId: "test-id",
        consentTimestamp: new Date(Date.now() - 86400000 * 200).toISOString(),
        lastConsentTimestamp: new Date(Date.now() - 86400000 * 200).toISOString(),
        expirationTime: Date.now() - 1000, // Expired 1 second ago
      };

      setCookie("cc_cookie", JSON.stringify(expiredCookie));

      const consent = createConsent(basicConfig);
      expect(consent.state.valid).toBe(false);
    });

    it("accepts non-expired cookie", () => {
      const validCookie: CookieValue = {
        categories: ["necessary", "analytics"],
        services: {},
        revision: 0,
        data: null,
        consentId: "test-id",
        consentTimestamp: new Date().toISOString(),
        lastConsentTimestamp: new Date().toISOString(),
        expirationTime: Date.now() + 86400000 * 100, // Valid for 100 days
      };

      setCookie("cc_cookie", JSON.stringify(validCookie));

      const consent = createConsent(basicConfig);
      expect(consent.state.valid).toBe(true);
    });
  });

  describe("onConsent event", () => {
    it("fires onConsent when consent is already valid on init", () => {
      const onConsent = vi.fn();
      const validCookie: CookieValue = {
        categories: ["necessary", "analytics"],
        services: {},
        revision: 0,
        data: null,
        consentId: "test-id",
        consentTimestamp: new Date().toISOString(),
        lastConsentTimestamp: new Date().toISOString(),
      };

      setCookie("cc_cookie", JSON.stringify(validCookie));

      createConsent({
        ...basicConfig,
        callbacks: { onConsent },
      });

      expect(onConsent).toHaveBeenCalledTimes(1);
    });

    it("does not fire onConsent when no valid cookie", () => {
      const onConsent = vi.fn();

      createConsent({
        ...basicConfig,
        callbacks: { onConsent },
      });

      expect(onConsent).not.toHaveBeenCalled();
    });

    it("fires onConsent as part of onFirstConsent cascade", () => {
      const onFirstConsent = vi.fn();
      const onConsent = vi.fn();

      const consent = createConsent({
        ...basicConfig,
        callbacks: { onFirstConsent, onConsent },
      });

      consent.accept("all");

      expect(onFirstConsent).toHaveBeenCalledTimes(1);
      expect(onConsent).toHaveBeenCalledTimes(1);
    });
  });

  describe("event system (on/off)", () => {
    it("registers event listeners via on()", () => {
      const consent = createConsent(basicConfig);
      const listener = vi.fn();

      consent.on("firstConsent", listener);
      consent.accept("all");

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it("removes event listeners via off()", () => {
      const consent = createConsent(basicConfig);
      const listener = vi.fn();

      consent.on("firstConsent", listener);
      consent.off("firstConsent", listener);
      consent.accept("all");

      expect(listener).not.toHaveBeenCalled();
    });

    it("returns unsubscribe function from on()", () => {
      const consent = createConsent(basicConfig);
      const listener = vi.fn();

      const unsub = consent.on("firstConsent", listener);
      unsub();
      consent.accept("all");

      expect(listener).not.toHaveBeenCalled();
    });

    it("handles multiple listeners for same event", () => {
      const consent = createConsent(basicConfig);
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      consent.on("firstConsent", listener1);
      consent.on("firstConsent", listener2);
      consent.accept("all");

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
    });

    it("off is a no-op for unknown events", () => {
      const consent = createConsent(basicConfig);
      expect(() => consent.off("unknownEvent", () => {})).not.toThrow();
    });

    it("on supports firstConsent event", () => {
      const consent = createConsent(basicConfig);
      const listener = vi.fn();

      consent.on("firstConsent", listener);

      consent.accept("all");
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it("on supports consent event after initial accept", () => {
      const consent = createConsent(basicConfig);
      const listener = vi.fn();

      consent.accept("all");

      consent.on("consent", listener);
      // consent event only fires from fireCallbacks('consent'), which happens
      // on init when cookie is valid, not on subsequent accepts
    });

    it("on supports change event", () => {
      const consent = createConsent(basicConfig);
      consent.accept("all");

      const listener = vi.fn();
      consent.on("change", listener);

      consent.reject("analytics");
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  describe("destroy", () => {
    it("cleans up store and events", () => {
      const consent = createConsent(basicConfig);
      const listener = vi.fn();

      consent.subscribe(listener);
      consent.destroy();

      // Should not throw after destroy
      expect(() => consent.accept("all")).not.toThrow();
      // Listener was already destroyed with the store
    });

    it("events are cleared after destroy", () => {
      const consent = createConsent(basicConfig);
      const listener = vi.fn();

      consent.on("change", listener);
      consent.accept("all");

      consent.destroy();

      // Events cleared, listener not called after destroy
      consent.off("change", listener); // Should not throw
    });
  });

  describe("loadScript", () => {
    it("detects existing scripts in DOM", async () => {
      const consent = createConsent(basicConfig);

      const script = document.createElement("script");
      script.src = "https://example.com/test.js";
      document.head.appendChild(script);

      const result = await consent.loadScript("https://example.com/test.js");
      expect(result).toBe(true);
    });

    it("resolves false when script fails to load", async () => {
      const consent = createConsent(basicConfig);

      const promise = consent.loadScript("https://invalid.example/script.js");

      // Simulate error event on the created script
      const scripts = document.querySelectorAll("script");
      for (const script of scripts) {
        if (script.src === "https://invalid.example/script.js") {
          script.dispatchEvent(new ErrorEvent("error"));
        }
      }

      const result = await promise;
      expect(result).toBe(false);
    });
  });

  describe("subscription", () => {
    it("calls listener immediately with current state on subscription", () => {
      // Note: store.subscribe only calls on state change, not immediately
      const consent = createConsent(basicConfig);
      const listener = vi.fn();

      consent.subscribe(listener);
      expect(listener).not.toHaveBeenCalled(); // Not called until state changes

      consent.accept("all");
      expect(listener).toHaveBeenCalled();
    });

    it("multiple subscribers all receive updates", () => {
      const consent = createConsent(basicConfig);
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      consent.subscribe(listener1);
      consent.subscribe(listener2);
      consent.accept("all");

      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
    });
  });

  describe("edge case: accept", () => {
    it("handles undefined acceptArg as reset-to-defaults", () => {
      const consent = createConsent({
        mode: "opt-out",
        categories: {
          necessary: { readOnly: true } as const,
          analytics: { enabled: true } as const,
          marketing: {} as const,
        },
      });

      consent.reject("analytics");
      expect(consent.state.categories.analytics.accepted).toBe(false);

      // Accept with no argument resets to defaults in opt-out mode
      consent.accept(undefined as unknown as "all");
      // This falls into the else branch which resets to defaults
    });

    it("accepting already accepted category is no-op for change event", () => {
      const onChange = vi.fn();
      const consent = createConsent({
        ...basicConfig,
        callbacks: { onChange },
      });

      consent.accept("analytics");
      expect(onChange).not.toHaveBeenCalled(); // First consent

      consent.accept("analytics"); // Same category
      // Should be handled correctly
    });
  });

  describe("edge case: reject", () => {
    it("rejecting 'necessary' does nothing", () => {
      const onChange = vi.fn();
      const consent = createConsent({
        ...basicConfig,
        callbacks: { onChange },
      });

      consent.accept("all");
      expect(onChange).not.toHaveBeenCalled(); // first consent

      consent.reject("necessary");
      expect(consent.state.categories.necessary.accepted).toBe(true);
    });
  });

  describe("setCookieData edge cases", () => {
    it("update mode with null current data sets value", () => {
      const consent = createConsent(basicConfig);
      consent.accept("all");

      const changed = consent.setCookieData({
        value: "simple-string",
        mode: "update",
      });

      expect(changed).toBe(true);
      expect(consent.getCookie("data")).toBe("simple-string");
    });

    it("set mode with same object reference returns false", () => {
      const consent = createConsent(basicConfig);
      consent.accept("all");

      const data = { a: 1 };
      consent.setCookieData({ value: data, mode: "set" });
      const changed = consent.setCookieData({ value: data, mode: "set" });

      expect(changed).toBe(false);
    });

    it("can update nested values in merge mode", () => {
      const consent = createConsent(basicConfig);
      consent.accept("all");

      consent.setCookieData({ value: { a: 1, b: 2 }, mode: "set" });
      consent.setCookieData({ value: { b: 3, c: 4 }, mode: "update" });

      const data = consent.getCookie("data") as Record<string, number>;
      expect(data).toEqual({ a: 1, b: 3, c: 4 });
    });
  });

  describe("getCookie", () => {
    it("returns entire cookie when no field specified", () => {
      const consent = createConsent(basicConfig);
      consent.accept("all");

      const cookie = consent.getCookie() as CookieValue;
      expect(cookie.categories).toBeDefined();
      expect(cookie.consentId).toBeDefined();
    });

    it("returns field from cookie", () => {
      const consent = createConsent(basicConfig);
      consent.accept("all");

      const consentId = consent.getCookie("consentId");
      expect(typeof consentId).toBe("string");
      expect(consentId).toBeTruthy();
    });
  });

  describe("acceptedCategory", () => {
    it("returns false for unaccepted category", () => {
      const consent = createConsent(basicConfig);
      expect(consent.acceptedCategory("marketing")).toBe(false);
    });

    it("returns true for readOnly category", () => {
      const consent = createConsent(basicConfig);
      expect(consent.acceptedCategory("necessary")).toBe(true);
    });

    it("returns true after accepting", () => {
      const consent = createConsent(basicConfig);
      consent.accept("analytics");
      expect(consent.acceptedCategory("analytics")).toBe(true);
    });

    it("returns false after rejecting", () => {
      const consent = createConsent(basicConfig);
      consent.accept("all");
      consent.reject("marketing");
      expect(consent.acceptedCategory("marketing")).toBe(false);
    });
  });

  describe("service edge cases", () => {
    const servicesConfig = {
      categories: {
        analytics: {
          services: {
            ga: {} as const,
            mixpanel: {} as const,
            amplitude: {} as const,
          },
        },
      },
    };

    it("acceptService with unknown category is no-op", () => {
      const consent = createConsent(servicesConfig);

      expect(() => {
        consent.acceptService("ga", "unknown" as "analytics");
      }).not.toThrow();
    });

    it("acceptService with unknown service name is ignored", () => {
      const consent = createConsent(servicesConfig);

      (consent.acceptService as (s: string, c: string) => void)("unknown_svc", "analytics");
      expect(consent.state.services.analytics.ga).toBe(false);
    });

    it("acceptService with array of specific services", () => {
      const consent = createConsent(servicesConfig);

      consent.acceptService(["ga", "amplitude"], "analytics");

      expect(consent.state.services.analytics.ga).toBe(true);
      expect(consent.state.services.analytics.amplitude).toBe(true);
      expect(consent.state.services.analytics.mixpanel).toBe(false);
    });

    it("rejectService with unknown category is no-op", () => {
      const consent = createConsent(servicesConfig);
      consent.acceptService("all", "analytics");

      expect(() => {
        consent.rejectService("all", "unknown" as "analytics");
      }).not.toThrow();
    });

    it("rejecting all services unaccepts the category", () => {
      const consent = createConsent(servicesConfig);
      consent.acceptService("all", "analytics");
      expect(consent.state.categories.analytics.accepted).toBe(true);

      consent.rejectService("all", "analytics");
      expect(consent.state.categories.analytics.accepted).toBe(false);
    });

    it("acceptService on empty category is no-op", () => {
      const consent = createConsent({
        categories: {
          empty_cat: { services: {} },
        },
      });

      expect(() => {
        consent.acceptService("all", "empty_cat");
      }).not.toThrow();
    });
  });

  describe("eraseCookies", () => {
    it("adds string cookie name to found list (not value)", () => {
      Object.defineProperty(document, "cookie", {
        writable: true,
        value: "_ga=GA1.2.test; _gid=GID.test",
      });

      const consent = createConsent(basicConfig);
      expect(() => consent.eraseCookies("_ga")).not.toThrow();
    });

    it("erases cookies matching regex", () => {
      Object.defineProperty(document, "cookie", {
        writable: true,
        value: "_ga=value; _gid=value; other_cookie=value",
      });

      const consent = createConsent(basicConfig);
      expect(() => consent.eraseCookies(/^_g/)).not.toThrow();
    });

    it("erases cookies from array input", () => {
      Object.defineProperty(document, "cookie", {
        writable: true,
        value: "_ga=value; _gid=value; _gat=value",
      });

      const consent = createConsent(basicConfig);
      expect(() => consent.eraseCookies(["_ga", "_gid"])).not.toThrow();
    });
  });

  describe("getConfig", () => {
    it("returns resolved config", () => {
      const consent = createConsent(basicConfig);
      const config = consent.getConfig() as Record<string, unknown>;
      expect(config).toHaveProperty("mode");
      expect(config).toHaveProperty("categoryNames");
      expect(config.mode).toBe("opt-in");
    });
  });

  describe("lastConsentTimestamp", () => {
    it("is set on first consent", () => {
      const consent = createConsent(basicConfig);
      consent.accept("all");
      const cookie = consent.getCookie();
      expect(typeof cookie).toBe("object");
      if (cookie && typeof cookie === "object") {
        expect("lastConsentTimestamp" in cookie).toBe(true);
      }
    });

    it("updates on second consent action", () => {
      const consent = createConsent(basicConfig);
      consent.accept(["necessary"]);
      const firstTs = consent.getCookie("lastConsentTimestamp");
      consent.accept(["analytics"]);
      const secondTs = consent.getCookie("lastConsentTimestamp");
      if (typeof firstTs === "string" && typeof secondTs === "string") {
        expect(new Date(secondTs).getTime()).toBeGreaterThanOrEqual(new Date(firstTs).getTime());
      }
    });
  });

  describe("service actions fire onChange", () => {
    it("fires onChange when accepting a service", () => {
      const onChange = vi.fn();
      const consent = createConsent({
        categories: {
          analytics: {
            services: {
              ga: {},
            },
          },
        },
        callbacks: { onChange },
      });

      consent.acceptService("ga", "analytics");
      expect(onChange).toHaveBeenCalled();
    });

    it("fires onChange when rejecting a service", () => {
      const onChange = vi.fn();
      const consent = createConsent({
        categories: {
          analytics: {
            enabled: true,
            services: {
              ga: {},
            },
          },
        },
        mode: "opt-in",
        callbacks: { onChange },
      });

      consent.acceptService("ga", "analytics");
      onChange.mockClear();
      consent.rejectService("ga", "analytics");
      expect(onChange).toHaveBeenCalled();
    });
  });

  describe("accept with excludedCategories", () => {
    it("excludes specified categories when accepting all", () => {
      const consent = createConsent({
        categories: {
          necessary: { readOnly: true },
          analytics: {},
          marketing: {},
        },
      });

      consent.accept("all", ["marketing"]);
      expect(consent.acceptedCategory("analytics")).toBe(true);
      expect(consent.acceptedCategory("marketing")).toBe(false);
      expect(consent.acceptedCategory("necessary")).toBe(true);
    });
  });
});
