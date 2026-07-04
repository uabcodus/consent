import { describe, it, expect, beforeEach, vi } from "vitest";

import { createConsent } from "../../src/core/consent";
import { localStorageStorage } from "../../src/core/storage";

function clearCookies() {
	Object.defineProperty(document, "cookie", {
		writable: true,
		value: ""
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
		marketing: {} as const
	}
};

describe("edge cases", () => {
	describe("empty/null configurations", () => {
		it("handles categories with no services", () => {
			const consent = createConsent({
				categories: {
					necessary: { readOnly: true } as const,
					empty: {} as const
				}
			});

			expect(consent.state.categories.empty.accepted).toBe(false);
			consent.accept("all");
			expect(consent.state.categories.empty.accepted).toBe(true);
		});

		it("handles all readOnly categories (only necessary)", () => {
			const consent = createConsent({
				categories: {
					necessary: { readOnly: true } as const,
					functional: { readOnly: true } as const
				}
			});

			expect(consent.state.acceptType).toBe("all");
			expect(consent.state.categories.necessary.accepted).toBe(true);
			expect(consent.state.categories.functional.accepted).toBe(true);
		});

		it("handles calling accept with empty array", () => {
			const consent = createConsent(basicConfig);
			consent.accept([] as unknown as "all");
			// Empty array means enabling no additional categories beyond readOnly
			expect(consent.state.categories.analytics.accepted).toBe(false);
		});

		it("handles calling reject with empty array", () => {
			const consent = createConsent(basicConfig);
			consent.accept("all");
			consent.reject([] as unknown as "all");
			// Empty array means reject nothing
			expect(consent.state.categories.analytics.accepted).toBe(true);
		});
	});

	describe("multiple accept/reject sequences", () => {
		it("handles rapid accept/reject/accept cycles", () => {
			const consent = createConsent(basicConfig);

			consent.accept("all");
			consent.reject("analytics");
			consent.accept("analytics");
			consent.reject("marketing");
			consent.accept("marketing");

			expect(consent.state.valid).toBe(true);
		});

		it("handles multiple resets and re-accepts", () => {
			const consent = createConsent(basicConfig);

			for (let i = 0; i < 3; i++) {
				consent.accept("all");
				expect(consent.state.valid).toBe(true);
				consent.reset(true);
				expect(consent.state.valid).toBe(false);
			}

			// After final reset, should be back to initial state
			expect(consent.state.categories.analytics.accepted).toBe(false);
		});

		it("acceptType stays consistent through changes", () => {
			const consent = createConsent(basicConfig);

			consent.accept("all");
			expect(consent.state.acceptType).toBe("all");

			consent.reject("analytics");
			expect(consent.state.acceptType).toBe("custom");

			consent.reject("marketing");
			expect(consent.state.acceptType).toBe("necessary");

			consent.accept("analytics");
			expect(consent.state.acceptType).toBe("custom");

			// accept single category by name replaces enabled set (only that + readOnly)
			consent.accept("marketing");
			expect(consent.state.acceptType).toBe("custom");

			// accept all to get everything
			consent.accept("all");
			expect(consent.state.acceptType).toBe("all");
		});
	});

	describe("localStorage adapter", () => {
		it("works with localStorage adapter", () => {
			const storage = localStorageStorage("edge_test_consent");
			const consent = createConsent({
				...basicConfig,
				storage
			});

			consent.accept("all");

			const cookie = consent.getCookie() as Record<string, unknown>;
			expect(cookie.consentId).toBeDefined();
			expect(cookie.categories).toContain("analytics");

			// Clean up
			storage.remove();
		});

		it("reads valid consent from localStorage on init", () => {
			const storage = localStorageStorage("edge_test_consent");

			const savedValue = {
				categories: ["necessary", "analytics"],
				services: {},
				revision: 0,
				data: null,
				consentId: "test-id",
				consentTimestamp: new Date().toISOString(),
				lastConsentTimestamp: new Date().toISOString()
			};

			storage.set(savedValue as import("../../src/core/types").CookieValue);

			const consent = createConsent({
				...basicConfig,
				storage
			});

			expect(consent.state.valid).toBe(true);
			expect(consent.state.categories.analytics.accepted).toBe(true);

			storage.remove();
		});
	});

	describe("service + category interaction", () => {
		it("accepting a service auto-accepts its category", () => {
			const consent = createConsent({
				categories: {
					analytics: {
						services: {
							ga: {} as const
						}
					}
				}
			});

			expect(consent.state.categories.analytics.accepted).toBe(false);

			consent.acceptService("ga", "analytics");

			expect(consent.state.categories.analytics.accepted).toBe(true);
		});

		it("rejecting all services from a category removes category acceptance", () => {
			const consent = createConsent({
				categories: {
					analytics: {
						services: {
							ga: {} as const,
							mixpanel: {} as const
						}
					}
				}
			});

			consent.acceptService("all", "analytics");
			expect(consent.state.categories.analytics.accepted).toBe(true);

			consent.rejectService("all", "analytics");
			expect(consent.state.categories.analytics.accepted).toBe(false);
		});

		it("rejecting one service keeps category accepted if others remain", () => {
			const consent = createConsent({
				categories: {
					analytics: {
						services: {
							ga: {} as const,
							mixpanel: {} as const
						}
					}
				}
			});

			consent.acceptService("all", "analytics");
			consent.rejectService("ga", "analytics");

			expect(consent.state.categories.analytics.accepted).toBe(true);
			expect(consent.state.services.analytics.ga).toBe(false);
			expect(consent.state.services.analytics.mixpanel).toBe(true);
		});
	});

	describe("reset edge cases", () => {
		it("reset without deleteCookie keeps cookie", () => {
			const consent = createConsent(basicConfig);
			consent.accept("all");

			const beforeReset = consent.getCookie("consentId");

			consent.reset();

			const afterReset = consent.getCookie("consentId");
			expect(afterReset).toBe(beforeReset);
		});

		it("resetting twice is safe", () => {
			const consent = createConsent(basicConfig);
			consent.accept("all");

			consent.reset(true);
			consent.reset(true);

			expect(consent.state.valid).toBe(false);
		});

		it("can accept after reset", () => {
			const consent = createConsent(basicConfig);
			consent.accept("all");
			consent.reset(true);

			consent.accept("analytics");
			expect(consent.state.valid).toBe(true);
			expect(consent.state.categories.analytics.accepted).toBe(true);
		});
	});

	describe("destroy edge cases", () => {
		it("calling destroy multiple times is safe", () => {
			const consent = createConsent(basicConfig);
			consent.destroy();
			expect(() => consent.destroy()).not.toThrow();
		});

		it("methods still work after destroy (no-op)", () => {
			const consent = createConsent(basicConfig);
			consent.destroy();

			expect(consent.validConsent()).toBe(false);
			expect(() => consent.accept("all")).not.toThrow();
		});
	});

	describe("off edge cases", () => {
		it("calling off before on is safe", () => {
			const consent = createConsent(basicConfig);
			const listener = () => {};

			expect(() => {
				consent.off("change", listener);
			}).not.toThrow();
		});

		it("calling off with wrong event name is safe", () => {
			const consent = createConsent(basicConfig);
			const listener = () => {};

			consent.on("change", listener);
			expect(() => {
				consent.off("nonexistent", listener);
			}).not.toThrow();
		});
	});

	describe("bot detection", () => {
		it("skips consent when bot is detected", () => {
			vi.stubGlobal("navigator", {
				userAgent: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"
			});

			const consent = createConsent(basicConfig);
			expect(consent.state.skipped).toBe(true);
			expect(consent.state.valid).toBe(true);

			vi.unstubAllGlobals();
		});
	});

	describe("loadScript", () => {
		it("resolves to false in SSR context", async () => {
			const doc = global.document;
			delete (global as Record<string, unknown>).document;

			const consent = createConsent(basicConfig);
			const result = await consent.loadScript("https://example.com/script.js");
			expect(result).toBe(false);

			global.document = doc as Document;
		});

		it("resolves when existing script is already present", async () => {
			const existing = document.createElement("script");
			existing.src = "https://example.com/existing.js";
			document.head.appendChild(existing);

			const consent = createConsent(basicConfig);
			const result = await consent.loadScript("https://example.com/existing.js");
			expect(result).toBe(true);

			existing.remove();
		});
	});
});
