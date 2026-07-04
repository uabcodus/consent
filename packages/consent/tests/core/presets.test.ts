import { describe, it, expect, beforeEach, vi } from "vitest";

import {
	createConsent,
	googleConsentMode,
	syncGtagConsent,
	cookieStorage
} from "../../src/core/index";

beforeEach(() => {
	Object.defineProperty(document, "cookie", {
		writable: true,
		value: ""
	});
});

describe("presets", () => {
	describe("googleConsentMode", () => {
		it("has correct category structure", () => {
			expect(googleConsentMode.categories).toBeDefined();
			expect(googleConsentMode.categories?.necessary?.readOnly).toBe(true);
			expect(googleConsentMode.categories?.analytics).toBeDefined();
			expect(googleConsentMode.categories?.advertisement?.services).toBeDefined();
		});

		it("has GCM services defined", () => {
			const analyticsServices = googleConsentMode.categories?.analytics?.services;
			expect(analyticsServices?.analytics_storage).toBeDefined();

			const adServices = googleConsentMode.categories?.advertisement?.services;
			expect(adServices?.ad_storage).toBeDefined();
			expect(adServices?.ad_user_data).toBeDefined();
			expect(adServices?.ad_personalization).toBeDefined();

			const funcServices = googleConsentMode.categories?.functionality?.services;
			expect(funcServices?.functionality_storage).toBeDefined();
			expect(funcServices?.personalization_storage).toBeDefined();
		});

		it("creates valid consent instance when used as preset", () => {
			const consent = createConsent({
				preset: googleConsentMode,
				categories: {
					necessary: { readOnly: true },
					analytics: {},
					advertisement: {},
					functionality: { readOnly: true }
				}
			});

			expect(consent.state.categories.necessary.accepted).toBe(true);
			expect(consent.state.categories.necessary.readOnly).toBe(true);
			expect(consent.state.categories.functionality.accepted).toBe(true);

			expect(consent.state.services.analytics.analytics_storage).toBe(false);
			expect(consent.state.services.advertisement.ad_storage).toBe(false);
		});
	});

	describe("preset merging", () => {
		it("merges preset categories with user categories", () => {
			const consent = createConsent({
				preset: googleConsentMode,
				categories: {
					necessary: { readOnly: true },
					analytics: {},
					marketing: { enabled: false }
				}
			});

			expect(consent.state.categories.marketing).toBeDefined();
			expect(consent.state.categories.analytics).toBeDefined();
			expect(consent.state.categories.advertisement).toBeDefined();
			expect(consent.state.categories.functionality).toBeDefined();
		});

		it("user categories override preset categories of same name", () => {
			const consent = createConsent({
				preset: googleConsentMode,
				categories: {
					analytics: {
						readOnly: true,
						autoClear: {
							cookies: [{ name: "_custom" }]
						}
					},
					advertisement: {} as const,
					necessary: { readOnly: true } as const,
					functionality: { readOnly: true } as const
				}
			});

			expect(consent.state.categories.analytics.readOnly).toBe(true);
			expect(consent.state.categories.analytics.accepted).toBe(true);
		});

		it("user services merge with preset services within same category", () => {
			const consent = createConsent({
				preset: googleConsentMode,
				categories: {
					necessary: { readOnly: true } as const,
					analytics: {
						services: {
							analytics_storage: {} as const,
							custom_tracking: {} as const
						}
					},
					advertisement: {} as const,
					functionality: { readOnly: true } as const
				}
			});

			expect(consent.state.services.analytics.analytics_storage).toBeDefined();
			expect(consent.state.services.analytics.custom_tracking).toBeDefined();
			expect(consent.state.services.advertisement.ad_storage).toBeDefined();
		});

		it("merges cookie config from preset and user", () => {
			const consent = createConsent({
				preset: googleConsentMode,
				storage: cookieStorage({
					name: "custom_consent",
					expiresAfterDays: 30,
					domain: "",
					path: "/",
					secure: true,
					sameSite: "Lax"
				}),
				categories: {
					necessary: { readOnly: true } as const,
					analytics: {} as const,
					advertisement: {} as const,
					functionality: { readOnly: true } as const
				}
			});

			consent.accept("all");

			expect(document.cookie).toContain("custom_consent=");
		});

		it("merges callbacks from preset and user", () => {
			const presetCb = vi.fn();
			const userCb = vi.fn();

			const consent = createConsent({
				preset: {
					...googleConsentMode,
					callbacks: { onFirstConsent: presetCb }
				},
				callbacks: { onFirstConsent: userCb },
				categories: {
					necessary: { readOnly: true } as const,
					analytics: {} as const,
					advertisement: {} as const,
					functionality: { readOnly: true } as const
				}
			});

			consent.accept("all");

			expect(userCb).toHaveBeenCalledTimes(1);
			expect(presetCb).not.toHaveBeenCalled();
		});

		it("works without preset", () => {
			const consent = createConsent({
				categories: {
					necessary: { readOnly: true } as const,
					analytics: {} as const
				}
			});

			expect(consent.state.categories.necessary).toBeDefined();
			expect(consent.state.categories.analytics).toBeDefined();
		});
	});
});

describe("syncGtagConsent", () => {
	it("subscribes to consent changes", () => {
		const consent = createConsent({
			preset: googleConsentMode,
			categories: {
				necessary: { readOnly: true } as const,
				analytics: {} as const,
				advertisement: {} as const,
				functionality: { readOnly: true } as const
			}
		});

		const mockGtag = vi.fn();
		window.gtag = mockGtag;
		window.dataLayer = [];

		syncGtagConsent(consent);

		consent.accept("all");

		const calls = mockGtag.mock.calls;
		expect(calls.length).toBeGreaterThanOrEqual(1);

		const lastCall = calls[calls.length - 1];
		expect(lastCall[0]).toBe("consent");
		expect(lastCall[1]).toBe("update");
		expect(lastCall[2]).toEqual(
			expect.objectContaining({
				analytics_storage: "granted",
				ad_storage: "granted",
				security_storage: "granted"
			})
		);
	});

	it("sends denied when categories are not accepted", () => {
		const consent = createConsent({
			preset: googleConsentMode,
			categories: {
				necessary: { readOnly: true } as const,
				analytics: {} as const,
				advertisement: {} as const,
				functionality: { readOnly: true } as const
			}
		});

		const mockGtag = vi.fn();
		window.gtag = mockGtag;
		window.dataLayer = [];

		syncGtagConsent(consent);

		consent.reject("analytics");

		const calls = mockGtag.mock.calls;
		const lastCall = calls[calls.length - 1];
		expect(lastCall[2]).toEqual(
			expect.objectContaining({
				analytics_storage: "denied"
			})
		);
	});

	it("returns unsubscribe function", () => {
		const consent = createConsent({
			preset: googleConsentMode,
			categories: {
				necessary: { readOnly: true } as const,
				analytics: {} as const,
				advertisement: {} as const,
				functionality: { readOnly: true } as const
			}
		});

		const mockGtag = vi.fn();
		window.gtag = mockGtag;
		window.dataLayer = [];

		const unsub = syncGtagConsent(consent);

		consent.accept("all");

		const callCount = mockGtag.mock.calls.length;
		expect(callCount).toBeGreaterThanOrEqual(1);

		unsub();
		consent.reject("analytics");

		expect(mockGtag.mock.calls.length).toBe(callCount);
	});
});
