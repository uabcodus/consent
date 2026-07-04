import { describe, it, expect, beforeEach, vi } from "vitest";

import { resolveConfig } from "../../src/core/config";
import { buildPublicState, createInitialInternalState } from "../../src/core/state";
import type { InternalState } from "../../src/core/state";
import type { CategoryConfig, ConsentConfig } from "../../src/core/types";

beforeEach(() => {
	document.cookie = "";
	vi.stubGlobal("navigator", {
		userAgent:
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36"
	});
});

function mockInternal(overrides: Partial<InternalState> = {}): InternalState {
	return {
		config: {
			mode: "opt-in",
			revision: 0,
			hideFromBots: false,
			manageScripts: false,
			scriptType: "text/consent",
			autoClearCookies: false,
			revisionEnabled: false,
			categories: {},
			categoryNames: [],
			readOnlyCategories: [],
			services: {},
			storage: {
				get: () => ({
					categories: [],
					services: {},
					revision: 0,
					data: null,
					consentId: "",
					consentTimestamp: ""
				}),
				set: vi.fn(),
				remove: vi.fn()
			}
		},
		valid: false,
		skipped: false,
		mode: "opt-in",
		acceptType: "necessary",
		categoryNames: [],
		readOnlyCategories: [],
		acceptedCategories: [],
		acceptedServices: {},
		definedServices: {},
		defaultEnabledCategories: [],
		enabledServices: {},
		cookieContent: null,
		consentId: "",
		consentTimestamp: null,
		lastConsentTimestamp: null,
		cookieData: null,
		allScriptTags: [],
		lastChangedCategoryNames: [],
		lastChangedServices: {},
		lastEnabledServices: {},
		revisionValid: true,
		events: {},
		...overrides
	};
}

describe("buildPublicState", () => {
	it("builds public state from internal state", () => {
		const internal = mockInternal({
			valid: true,
			skipped: false,
			mode: "opt-in",
			acceptType: "all",
			categoryNames: ["necessary", "analytics"],
			readOnlyCategories: ["necessary"],
			acceptedCategories: ["necessary", "analytics"],
			definedServices: {
				necessary: {},
				analytics: { ga: {}, gtm: {} }
			},
			acceptedServices: { analytics: ["ga"] },
			cookieContent: {
				categories: ["necessary", "analytics"],
				services: { analytics: ["ga"] },
				revision: 1,
				data: null,
				consentId: "test-id",
				consentTimestamp: "2024-01-01T00:00:00.000Z"
			}
		});

		const state = buildPublicState(internal);

		expect(state.valid).toBe(true);
		expect(state.skipped).toBe(false);
		expect(state.mode).toBe("opt-in");
		expect(state.acceptType).toBe("all");
		expect(state.cookie).toBe(internal.cookieContent);
	});

	it("maps categories with accepted and readOnly flags", () => {
		const internal = mockInternal({
			categoryNames: ["necessary", "analytics", "advertisement"],
			readOnlyCategories: ["necessary"],
			acceptedCategories: ["necessary", "analytics"],
			definedServices: {
				necessary: {},
				analytics: {},
				advertisement: {}
			}
		});

		const state = buildPublicState(internal);

		expect(state.categories.necessary).toEqual({
			accepted: true,
			readOnly: true
		});
		expect(state.categories.analytics).toEqual({
			accepted: true,
			readOnly: false
		});
		expect(state.categories.advertisement).toEqual({
			accepted: false,
			readOnly: false
		});
	});

	it("maps services with boolean values per category", () => {
		const internal = mockInternal({
			categoryNames: ["analytics"],
			definedServices: {
				analytics: { ga: {}, gtm: {}, fb: {} }
			},
			acceptedServices: { analytics: ["ga"] }
		});

		const state = buildPublicState(internal);

		expect(state.services.analytics).toEqual({
			ga: true,
			gtm: false,
			fb: false
		});
	});

	it("handles empty categories and services", () => {
		const internal = mockInternal({
			categoryNames: [],
			definedServices: {}
		});

		const state = buildPublicState(internal);

		expect(state.categories).toEqual({});
		expect(state.services).toEqual({});
	});

	it("returns correct state for skipped (bot) scenario", () => {
		const internal = mockInternal({
			valid: true,
			skipped: true,
			cookieContent: null
		});

		const state = buildPublicState(internal);

		expect(state.valid).toBe(true);
		expect(state.skipped).toBe(true);
		expect(state.cookie).toBeNull();
	});
});

describe("createInitialInternalState", () => {
	it("creates default state with no cookie and opt-in mode", () => {
		const merged: ConsentConfig<Record<string, CategoryConfig>> = {
			mode: "opt-in",
			categories: {
				necessary: { readOnly: true },
				analytics: {}
			}
		};
		const config = resolveConfig(merged);

		const state = createInitialInternalState(merged, config);

		expect(state.valid).toBe(false);
		expect(state.mode).toBe("opt-in");
		expect(state.acceptedCategories).toEqual(["necessary"]);
		expect(state.acceptedServices).toEqual({
			necessary: [],
			analytics: []
		});
		expect(state.cookieContent).toBeNull();
		expect(state.consentId).toBe("");
	});

	it("enables default categories in opt-out mode", () => {
		const merged: ConsentConfig<Record<string, CategoryConfig>> = {
			mode: "opt-out",
			categories: {
				necessary: { readOnly: true },
				analytics: { enabled: true }
			}
		};
		const config = resolveConfig(merged);

		const state = createInitialInternalState(merged, config);

		expect(state.valid).toBe(false);
		expect(state.acceptedCategories).toContain("necessary");
		expect(state.acceptedCategories).toContain("analytics");
		expect(state.defaultEnabledCategories).toContain("analytics");
		expect(state.defaultEnabledCategories).toContain("necessary");
	});

	it("creates initial state from valid cookie data", () => {
		const cookieValue = JSON.stringify({
			categories: ["necessary", "analytics"],
			services: { analytics: ["ga"] },
			revision: 1,
			data: null,
			consentId: "saved-id",
			consentTimestamp: "2024-01-01T00:00:00.000Z",
			lastConsentTimestamp: "2024-02-01T00:00:00.000Z"
		});

		const merged: ConsentConfig<Record<string, CategoryConfig>> = {
			revision: 1,
			initialCookie: cookieValue,
			categories: {
				necessary: { readOnly: true },
				analytics: {}
			}
		};
		const config = resolveConfig(merged);

		const state = createInitialInternalState(merged, config);

		expect(state.valid).toBe(true);
		expect(state.acceptedCategories).toEqual(["necessary", "analytics"]);
		expect(state.acceptedServices.analytics).toEqual(["ga"]);
		expect(state.consentId).toBe("saved-id");
		expect(state.cookieContent).toBeTruthy();
		expect(state.cookieContent!.consentId).toBe("saved-id");
	});

	it("invalidates when cookie revision does not match config revision", () => {
		const cookieValue = JSON.stringify({
			categories: ["necessary", "analytics"],
			services: {},
			revision: 1,
			data: null,
			consentId: "saved-id",
			consentTimestamp: "2024-01-01T00:00:00.000Z",
			lastConsentTimestamp: "2024-02-01T00:00:00.000Z"
		});

		const merged: ConsentConfig<Record<string, CategoryConfig>> = {
			revision: 2,
			initialCookie: cookieValue,
			categories: {
				necessary: { readOnly: true },
				analytics: {}
			}
		};
		const config = resolveConfig(merged);

		const state = createInitialInternalState(merged, config);

		expect(state.valid).toBe(false);
	});

	it("keeps valid when revision matches and revisionEnabled is true", () => {
		const cookieValue = JSON.stringify({
			categories: ["necessary", "analytics"],
			services: {},
			revision: 2,
			data: null,
			consentId: "saved-id",
			consentTimestamp: "2024-01-01T00:00:00.000Z",
			lastConsentTimestamp: "2024-02-01T00:00:00.000Z"
		});

		const merged: ConsentConfig<Record<string, CategoryConfig>> = {
			revision: 2,
			initialCookie: cookieValue,
			categories: {
				necessary: { readOnly: true },
				analytics: {}
			}
		};
		const config = resolveConfig(merged);

		const state = createInitialInternalState(merged, config);

		expect(state.valid).toBe(true);
	});

	it("treats revision=0 as revision disabled (always valid)", () => {
		const cookieValue = JSON.stringify({
			categories: ["necessary"],
			services: {},
			revision: 99,
			data: null,
			consentId: "saved-id",
			consentTimestamp: "2024-01-01T00:00:00.000Z",
			lastConsentTimestamp: "2024-02-01T00:00:00.000Z"
		});

		const merged: ConsentConfig<Record<string, CategoryConfig>> = {
			revision: 0,
			initialCookie: cookieValue,
			categories: {
				necessary: { readOnly: true }
			}
		};
		const config = resolveConfig(merged);

		const state = createInitialInternalState(merged, config);

		expect(state.valid).toBe(true);
	});

	it("detects bot and marks as skipped with valid=true", () => {
		vi.stubGlobal("navigator", { userAgent: "Googlebot/2.1" });

		const merged: ConsentConfig<Record<string, CategoryConfig>> = {
			hideFromBots: true,
			categories: {
				necessary: { readOnly: true },
				analytics: {}
			}
		};
		const config = resolveConfig(merged);

		const state = createInitialInternalState(merged, config);

		expect(state.skipped).toBe(true);
		expect(state.valid).toBe(true);
	});

	it("does not skip bot when hideFromBots is false", () => {
		vi.stubGlobal("navigator", { userAgent: "Googlebot/2.1" });

		const merged: ConsentConfig<Record<string, CategoryConfig>> = {
			hideFromBots: false,
			categories: {
				necessary: { readOnly: true }
			}
		};
		const config = resolveConfig(merged);

		const state = createInitialInternalState(merged, config);

		expect(state.skipped).toBe(false);
	});

	it("initialCookie takes precedence over storage", () => {
		const initialCookieValue = JSON.stringify({
			categories: ["necessary", "analytics"],
			services: {},
			revision: 1,
			data: null,
			consentId: "initial-cookie-id",
			consentTimestamp: "2024-01-01T00:00:00.000Z",
			lastConsentTimestamp: "2024-02-01T00:00:00.000Z"
		});

		const merged: ConsentConfig<Record<string, CategoryConfig>> = {
			revision: 1,
			initialCookie: initialCookieValue,
			categories: {
				necessary: { readOnly: true },
				analytics: {}
			}
		};
		const config = resolveConfig(merged);

		const state = createInitialInternalState(merged, config);

		expect(state.consentId).toBe("initial-cookie-id");
	});

	it("falls back to storage when no initialCookie", () => {
		const cookieContent = JSON.stringify({
			categories: ["necessary", "analytics"],
			services: {},
			revision: 1,
			data: null,
			consentId: "storage-id",
			consentTimestamp: "2024-01-01T00:00:00.000Z",
			lastConsentTimestamp: "2024-02-01T00:00:00.000Z"
		});
		document.cookie = `cc_cookie=${encodeURIComponent(cookieContent)}`;

		const merged: ConsentConfig<Record<string, CategoryConfig>> = {
			revision: 1,
			categories: {
				necessary: { readOnly: true },
				analytics: {}
			}
		};
		const config = resolveConfig(merged);

		const state = createInitialInternalState(merged, config);

		expect(state.consentId).toBe("storage-id");
		expect(state.valid).toBe(true);
	});

	it("invalidates when consent cookie has expired", () => {
		const pastDate = new Date(Date.now() - 86400000).getTime();
		const cookieValue = JSON.stringify({
			categories: ["necessary", "analytics"],
			services: {},
			revision: 1,
			data: null,
			consentId: "expired-id",
			consentTimestamp: "2024-01-01T00:00:00.000Z",
			lastConsentTimestamp: "2024-02-01T00:00:00.000Z",
			expirationTime: pastDate
		});

		const merged: ConsentConfig<Record<string, CategoryConfig>> = {
			revision: 1,
			initialCookie: cookieValue,
			categories: {
				necessary: { readOnly: true },
				analytics: {}
			}
		};
		const config = resolveConfig(merged);

		const state = createInitialInternalState(merged, config);

		expect(state.valid).toBe(false);
	});

	it("creates initial state with all InternalState fields populated", () => {
		const merged: ConsentConfig<Record<string, CategoryConfig>> = {
			categories: {
				necessary: { readOnly: true }
			}
		};
		const config = resolveConfig(merged);
		const state = createInitialInternalState(merged, config);

		expect(state.config).toBeDefined();
		expect(typeof state.valid).toBe("boolean");
		expect(typeof state.skipped).toBe("boolean");
		expect(state.mode).toBeDefined();
		expect(state.acceptType).toBeDefined();
		expect(Array.isArray(state.categoryNames)).toBe(true);
		expect(Array.isArray(state.readOnlyCategories)).toBe(true);
		expect(Array.isArray(state.acceptedCategories)).toBe(true);
		expect(state.acceptedServices).toBeDefined();
		expect(state.definedServices).toBeDefined();
		expect(Array.isArray(state.defaultEnabledCategories)).toBe(true);
		expect(state.enabledServices).toBeDefined();
		expect(Array.isArray(state.allScriptTags)).toBe(true);
		expect(Array.isArray(state.lastChangedCategoryNames)).toBe(true);
		expect(state.lastChangedServices).toBeDefined();
		expect(state.lastEnabledServices).toBeDefined();
		expect(typeof state.revisionValid).toBe("boolean");
		expect(state.events).toBeDefined();
	});
});
