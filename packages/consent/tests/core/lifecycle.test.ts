import { describe, it, expect, vi, beforeEach } from "vitest";

import { emit, fireCallbacks, persistAndSync } from "../../src/core/lifecycle";
import { buildPublicState } from "../../src/core/state";
import type { InternalState, Events } from "../../src/core/state";
import type { Store } from "../../src/core/store";

function mockStore(): Store<ReturnType<typeof buildPublicState>> {
	const listeners = new Set<(state: ReturnType<typeof buildPublicState>) => void>();
	let state = {} as ReturnType<typeof buildPublicState>;
	return {
		get: () => state,
		set: (updater) => {
			if (typeof updater === "function") {
				state = (updater as (s: typeof state) => typeof state)(state);
			} else {
				state = {
					...state,
					...(updater as Partial<typeof state>)
				} as typeof state;
			}
			for (const listener of listeners) listener(state);
		},
		subscribe: (listener) => {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		destroy: () => listeners.clear()
	};
}

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

describe("emit", () => {
	it("calls all registered handlers for an event", () => {
		const events: Events = {};
		const handler1 = vi.fn();
		const handler2 = vi.fn();

		events["customEvent"] = new Set([handler1, handler2]);
		emit(events, "customEvent", { key: "value" });

		expect(handler1).toHaveBeenCalledWith({ key: "value" });
		expect(handler2).toHaveBeenCalledWith({ key: "value" });
	});

	it("does nothing when event has no handlers", () => {
		const events: Events = {};
		expect(() => emit(events, "nonexistent", "arg")).not.toThrow();
	});

	it("does nothing when events object is empty", () => {
		const events: Events = {};
		emit(events, "anything", 123);
		expect(true).toBe(true);
	});
});

describe("fireCallbacks", () => {
	it("fires onFirstConsent and onConsent for firstConsent event", () => {
		const internal = mockInternal({
			cookieContent: {
				categories: ["necessary"],
				services: {},
				revision: 1,
				data: null,
				consentId: "test-id",
				consentTimestamp: "2024-01-01T00:00:00.000Z"
			}
		});
		const onFirstConsent = vi.fn();
		const onConsent = vi.fn();
		const onChange = vi.fn();
		const events: Events = {};

		fireCallbacks("firstConsent", internal, { onFirstConsent, onConsent, onChange }, events);

		expect(onFirstConsent).toHaveBeenCalledTimes(1);
		expect(onConsent).toHaveBeenCalledTimes(1);
		expect(onChange).not.toHaveBeenCalled();
	});

	it("fires onConsent for consent event", () => {
		const internal = mockInternal({
			cookieContent: {
				categories: ["necessary"],
				services: {},
				revision: 1,
				data: null,
				consentId: "test-id",
				consentTimestamp: "2024-01-01T00:00:00.000Z"
			}
		});
		const onFirstConsent = vi.fn();
		const onConsent = vi.fn();
		const onChange = vi.fn();
		const events: Events = {};

		fireCallbacks("consent", internal, { onFirstConsent, onConsent, onChange }, events);

		expect(onFirstConsent).not.toHaveBeenCalled();
		expect(onConsent).toHaveBeenCalledTimes(1);
		expect(onChange).not.toHaveBeenCalled();
	});

	it("fires onChange with changed categories and services", () => {
		const internal = mockInternal({
			cookieContent: {
				categories: ["necessary", "analytics"],
				services: { analytics: ["ga"] },
				revision: 1,
				data: null,
				consentId: "test-id",
				consentTimestamp: "2024-01-01T00:00:00.000Z"
			},
			lastChangedCategoryNames: ["analytics"],
			lastChangedServices: { analytics: ["ga"] }
		});
		const onFirstConsent = vi.fn();
		const onConsent = vi.fn();
		const onChange = vi.fn();
		const events: Events = {};

		fireCallbacks("change", internal, { onFirstConsent, onConsent, onChange }, events);

		expect(onFirstConsent).not.toHaveBeenCalled();
		expect(onConsent).not.toHaveBeenCalled();
		expect(onChange).toHaveBeenCalledTimes(1);
		expect(onChange).toHaveBeenCalledWith(
			expect.objectContaining({
				changedCategories: ["analytics"],
				changedServices: { analytics: ["ga"] }
			})
		);
	});

	it("also emits to custom event system", () => {
		const internal = mockInternal({
			cookieContent: {
				categories: ["necessary"],
				services: {},
				revision: 1,
				data: null,
				consentId: "test-id",
				consentTimestamp: "2024-01-01T00:00:00.000Z"
			}
		});
		const events: Events = {};
		const customHandler = vi.fn();
		events["firstConsent"] = new Set([customHandler]);

		fireCallbacks("firstConsent", internal, {}, events);

		expect(customHandler).toHaveBeenCalledTimes(1);
		expect(customHandler).toHaveBeenCalledWith(
			expect.objectContaining({ cookie: expect.any(Object) })
		);
	});

	it("works with no callbacks defined", () => {
		const internal = mockInternal({
			cookieContent: {
				categories: ["necessary"],
				services: {},
				revision: 1,
				data: null,
				consentId: "test-id",
				consentTimestamp: "2024-01-01T00:00:00.000Z"
			}
		});
		const events: Events = {};

		expect(() => fireCallbacks("consent", internal, {}, events)).not.toThrow();
	});
});

describe("persistAndSync", () => {
	it("generates consentId and timestamp if not present", () => {
		const store = mockStore();
		const internal = mockInternal({
			categoryNames: ["necessary"],
			readOnlyCategories: ["necessary"]
		});

		persistAndSync({ internal, store });

		expect(internal.consentId).toBeTruthy();
		expect(internal.consentTimestamp).toBeInstanceOf(Date);
	});

	it("preserves existing consentId and timestamp", () => {
		const store = mockStore();
		const existingDate = new Date("2024-01-01T00:00:00.000Z");
		const internal = mockInternal({
			consentId: "existing-id",
			consentTimestamp: existingDate
		});

		persistAndSync({ internal, store });

		expect(internal.consentId).toBe("existing-id");
		expect(internal.consentTimestamp).toBe(existingDate);
	});

	it("builds cookieContent and writes to storage", () => {
		const store = mockStore();
		const setSpy = vi.fn();
		const internal = mockInternal({
			consentId: "test-id",
			consentTimestamp: new Date("2024-01-01T00:00:00.000Z"),
			categoryNames: ["necessary", "analytics"],
			readOnlyCategories: ["necessary"],
			acceptedCategories: ["necessary", "analytics"],
			acceptedServices: { analytics: ["ga"] },
			enabledServices: { analytics: ["ga"] },
			config: {
				mode: "opt-in",
				revision: 0,
				hideFromBots: false,
				manageScripts: false,
				scriptType: "text/consent",
				autoClearCookies: false,
				revisionEnabled: false,
				categories: {},
				categoryNames: ["necessary", "analytics"],
				readOnlyCategories: ["necessary"],
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
					set: setSpy,
					remove: vi.fn()
				}
			}
		});

		persistAndSync({ internal, store });

		expect(setSpy).toHaveBeenCalledTimes(1);
		const cookieArg = setSpy.mock.calls[0]![0] as Record<string, unknown>;
		expect(cookieArg.categories).toEqual(["necessary", "analytics"]);
		expect(cookieArg.services).toEqual({
			analytics: ["ga"],
			necessary: []
		});
		expect(cookieArg.consentId).toBe("test-id");
	});

	it("includes lastConsentTimestamp in cookie when set", () => {
		const store = mockStore();
		const setSpy = vi.fn();
		const lastTime = new Date("2024-06-01T00:00:00.000Z");
		const internal = mockInternal({
			consentId: "test-id",
			consentTimestamp: new Date("2024-01-01T00:00:00.000Z"),
			lastConsentTimestamp: lastTime,
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
					set: setSpy,
					remove: vi.fn()
				}
			}
		});

		persistAndSync({ internal, store });

		const cookieArg = setSpy.mock.calls[0]![0] as Record<string, unknown>;
		expect(cookieArg.lastConsentTimestamp).toBe(lastTime.toISOString());
	});

	it("updates store after persistence", () => {
		const store = mockStore();
		const internal = mockInternal({
			consentId: "test-id",
			consentTimestamp: new Date("2024-01-01T00:00:00.000Z"),
			categoryNames: ["necessary"],
			readOnlyCategories: ["necessary"],
			acceptedCategories: ["necessary"]
		});

		persistAndSync({ internal, store });

		const publicState = store.get();
		expect(publicState.valid).toBe(false);
		expect(publicState.categories).toEqual({
			necessary: { accepted: true, readOnly: true }
		});
	});

	it("deduplicates acceptedServices", () => {
		const store = mockStore();
		const setSpy = vi.fn();
		const internal = mockInternal({
			consentId: "test-id",
			consentTimestamp: new Date("2024-01-01T00:00:00.000Z"),
			categoryNames: ["analytics"],
			enabledServices: { analytics: ["ga", "ga", "gtm", "ga"] },
			config: {
				mode: "opt-in",
				revision: 0,
				hideFromBots: false,
				manageScripts: false,
				scriptType: "text/consent",
				autoClearCookies: false,
				revisionEnabled: false,
				categories: {},
				categoryNames: ["analytics"],
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
					set: setSpy,
					remove: vi.fn()
				}
			}
		});

		persistAndSync({ internal, store });

		const cookieArg = setSpy.mock.calls[0]![0] as Record<string, unknown>;
		const services = cookieArg.services as Record<string, string[]>;
		expect(services.analytics).toEqual(["ga", "gtm"]);
	});
});
