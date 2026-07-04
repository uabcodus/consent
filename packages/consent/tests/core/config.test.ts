import { describe, it, expect, afterEach, vi } from "vitest";

import { isBot, resolveConfig } from "../../src/core/config";
import { localStorageStorage } from "../../src/core/storage";
import type { CategoryConfig, ConsentConfig } from "../../src/core/types";

describe("isBot", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("returns false for normal browsers", () => {
		vi.stubGlobal("navigator", {
			userAgent: "Mozilla/5.0 Chrome/120",
			webdriver: false
		});
		expect(isBot()).toBe(false);
	});

	it("returns true for common bot user agents", () => {
		vi.stubGlobal("navigator", {
			userAgent: "Googlebot/2.1",
			webdriver: false
		});
		expect(isBot()).toBe(true);
	});

	it("returns true for crawl-based user agents", () => {
		vi.stubGlobal("navigator", {
			userAgent: "AdsBot-Google (+http://www.google.com/adsbot.html)",
			webdriver: false
		});
		expect(isBot()).toBe(true);
	});

	it("returns true for spider user agents", () => {
		vi.stubGlobal("navigator", {
			userAgent: "DuckDuckBot/1.0",
			webdriver: false
		});
		expect(isBot()).toBe(true);
	});

	it("returns true when webdriver is true", () => {
		vi.stubGlobal("navigator", {
			userAgent: "Mozilla/5.0",
			webdriver: true
		});
		expect(isBot()).toBe(true);
	});

	it("returns false when navigator is undefined (SSR)", () => {
		vi.stubGlobal("navigator", undefined);
		expect(isBot()).toBe(false);
	});

	it("handles empty user agent", () => {
		vi.stubGlobal("navigator", {
			userAgent: "",
			webdriver: false
		});
		expect(isBot()).toBe(false);
	});
});

describe("resolveConfig", () => {
	it("returns default mode opt-in", () => {
		const config = resolveConfig({
			categories: { analytics: {} }
		});
		expect(config.mode).toBe("opt-in");
	});

	it("sets revision to 0 by default", () => {
		const config = resolveConfig({
			categories: { analytics: {} }
		});
		expect(config.revision).toBe(0);
		expect(config.revisionEnabled).toBe(false);
	});

	it("enables revision when revision > 0", () => {
		const config = resolveConfig({
			revision: 3,
			categories: { analytics: {} }
		});
		expect(config.revision).toBe(3);
		expect(config.revisionEnabled).toBe(true);
	});

	it("defaults hideFromBots to true", () => {
		const config = resolveConfig({
			categories: { analytics: {} }
		});
		expect(config.hideFromBots).toBe(true);
	});

	it("allows overriding hideFromBots", () => {
		const config = resolveConfig({
			hideFromBots: false,
			categories: { analytics: {} }
		});
		expect(config.hideFromBots).toBe(false);
	});

	it("defaults manageScripts to false", () => {
		const config = resolveConfig({
			categories: { analytics: {} }
		});
		expect(config.manageScripts).toBe(false);
	});

	it("defaults scriptType to text/consent", () => {
		const config = resolveConfig({
			categories: { analytics: {} }
		});
		expect(config.scriptType).toBe("text/consent");
	});

	it("defaults autoClearCookies to true", () => {
		const config = resolveConfig({
			categories: { analytics: {} }
		});
		expect(config.autoClearCookies).toBe(true);
	});

	it("collects category names", () => {
		const config = resolveConfig({
			categories: {
				necessary: { readOnly: true },
				analytics: {}
			}
		});
		expect(config.categoryNames).toEqual(["necessary", "analytics"]);
	});

	it("identifies readOnly categories", () => {
		const config = resolveConfig({
			categories: {
				necessary: { readOnly: true },
				analytics: {},
				functionality: { readOnly: true }
			}
		});
		expect(config.readOnlyCategories).toEqual(["necessary", "functionality"]);
	});

	it("clones service configs into services map", () => {
		const config = resolveConfig({
			categories: {
				analytics: {
					services: {
						ga: { onAccept: () => {} }
					}
				}
			}
		});
		expect(config.services.analytics).toBeDefined();
		expect(config.services.analytics!.ga).toBeDefined();
		expect(typeof config.services.analytics!.ga.onAccept).toBe("function");
	});

	it("handles categories without services", () => {
		const config = resolveConfig({
			categories: {
				analytics: {},
				marketing: {}
			}
		});
		expect(config.services.analytics).toEqual({});
		expect(config.services.marketing).toEqual({});
	});

	it("uses user-provided storage", () => {
		const storage = localStorageStorage("test_consent");
		const config = resolveConfig({
			categories: { analytics: {} },
			storage
		});
		expect(config.storage).toBe(storage);
	});

	it("creates default cookie storage when none provided", () => {
		const config = resolveConfig({
			categories: { analytics: {} }
		});
		expect(config.storage).toBeDefined();
		expect(typeof config.storage.get).toBe("function");
		expect(typeof config.storage.set).toBe("function");
		expect(typeof config.storage.remove).toBe("function");
	});

	it("handles opt-out mode", () => {
		const config = resolveConfig({
			mode: "opt-out",
			categories: { analytics: {} }
		});
		expect(config.mode).toBe("opt-out");
	});
});
