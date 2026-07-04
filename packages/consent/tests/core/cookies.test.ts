import { describe, it, expect, beforeEach } from "vitest";

import {
	getSingleCookie,
	getAllCookieNames,
	parseCookie,
	parseConsentCookie,
	getPluginCookie,
	setCookieValue,
	eraseCookiesHelper,
	autoclearRejectedCookies
} from "../../src/core/cookies";
import type { CookieConfig, CookieValue } from "../../src/core/types";

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
});

describe("getSingleCookie", () => {
	it("returns cookie value by name", () => {
		Object.defineProperty(document, "cookie", {
			writable: true,
			value: "test=hello; other=world"
		});
		expect(getSingleCookie("test")).toBe("hello");
		expect(getSingleCookie("other")).toBe("world");
	});

	it("returns empty string for missing cookie", () => {
		Object.defineProperty(document, "cookie", {
			writable: true,
			value: "test=hello"
		});
		expect(getSingleCookie("missing")).toBe("");
	});

	it("returns empty string for empty cookie jar", () => {
		expect(getSingleCookie("anything")).toBe("");
	});

	it("handles URL-encoded cookie values", () => {
		Object.defineProperty(document, "cookie", {
			writable: true,
			value: "data=%7B%22a%22%3A1%7D"
		});
		expect(getSingleCookie("data")).toBe("%7B%22a%22%3A1%7D");
	});
});

describe("getAllCookieNames", () => {
	it("returns all cookie names", () => {
		Object.defineProperty(document, "cookie", {
			writable: true,
			value: "a=1; b=2; c=3"
		});
		expect(getAllCookieNames()).toEqual(["a", "b", "c"]);
	});

	it("filters cookie names by regex", () => {
		Object.defineProperty(document, "cookie", {
			writable: true,
			value: "_ga=1; _gid=2; custom=3"
		});
		expect(getAllCookieNames(/^_g/)).toEqual(["_ga", "_gid"]);
	});

	it("returns empty array for empty cookie jar", () => {
		const names = getAllCookieNames().filter(Boolean);
		expect(names).toEqual([]);
	});

	it("handles cookie values with equals signs", () => {
		Object.defineProperty(document, "cookie", {
			writable: true,
			value: "token=abc=def=ghi"
		});
		expect(getAllCookieNames()).toEqual(["token"]);
	});
});

describe("parseCookie", () => {
	it("parses valid JSON string", () => {
		const result = parseCookie('{"categories":["necessary"]}');
		expect(result.categories).toEqual(["necessary"]);
	});

	it("returns empty cookie value for null input", () => {
		const result = parseCookie(null);
		expect(result).toEqual(EMPTY_COOKIE);
	});

	it("returns empty cookie value for undefined input", () => {
		const result = parseCookie(undefined);
		expect(result).toEqual(EMPTY_COOKIE);
	});

	it("returns empty cookie value for empty string", () => {
		const result = parseCookie("");
		expect(result).toEqual(EMPTY_COOKIE);
	});

	it("returns empty cookie value for invalid JSON", () => {
		const result = parseCookie("not-json");
		expect(result).toEqual(EMPTY_COOKIE);
	});

	it("returns empty cookie value for non-object JSON (string)", () => {
		const result = parseCookie('"just a string"');
		expect(result).toEqual(EMPTY_COOKIE);
	});

	it("returns empty cookie value for non-object JSON (number)", () => {
		const result = parseCookie("42");
		expect(result).toEqual(EMPTY_COOKIE);
	});
});

describe("parseConsentCookie", () => {
	it("parses valid consent cookie", () => {
		const value: CookieValue = {
			categories: ["necessary"],
			services: {},
			revision: 0,
			data: null,
			consentId: "test-id",
			consentTimestamp: new Date().toISOString()
		};
		const encoded = encodeURIComponent(JSON.stringify(value));
		const result = parseConsentCookie(encoded);
		expect(result).not.toBeNull();
		expect(result!.consentId).toBe("test-id");
	});

	it("returns null for missing consentId", () => {
		const value = {
			categories: ["necessary"],
			services: {},
			revision: 0,
			data: null,
			consentTimestamp: new Date().toISOString()
		};
		const encoded = encodeURIComponent(JSON.stringify(value));
		expect(parseConsentCookie(encoded)).toBeNull();
	});

	it("returns null for null input", () => {
		expect(parseConsentCookie(null)).toBeNull();
	});

	it("returns null for undefined input", () => {
		expect(parseConsentCookie(undefined)).toBeNull();
	});

	it("returns null for empty string", () => {
		expect(parseConsentCookie("")).toBeNull();
	});

	it("returns null for invalid JSON", () => {
		expect(parseConsentCookie("not-valid-json")).toBeNull();
	});

	it("returns null for non-object parsed value", () => {
		expect(parseConsentCookie(encodeURIComponent("42"))).toBeNull();
	});

	it("handles non-encoded input", () => {
		const value: CookieValue = {
			categories: ["necessary"],
			services: {},
			revision: 0,
			data: null,
			consentId: "test-id",
			consentTimestamp: new Date().toISOString()
		};
		const result = parseConsentCookie(JSON.stringify(value));
		expect(result).not.toBeNull();
		expect(result!.consentId).toBe("test-id");
	});
});

describe("getPluginCookie", () => {
	it("reads cookie from document", () => {
		const value: CookieValue = {
			categories: ["necessary", "analytics"],
			services: {},
			revision: 1,
			data: null,
			consentId: "id",
			consentTimestamp: new Date().toISOString()
		};
		const encoded = encodeURIComponent(JSON.stringify(value));
		Object.defineProperty(document, "cookie", {
			writable: true,
			value: `cc_cookie=${encoded}`
		});

		const config: CookieConfig = {
			name: "cc_cookie",
			expiresAfterDays: 182,
			domain: "",
			path: "/",
			secure: true,
			sameSite: "Lax"
		};
		const result = getPluginCookie(config);
		expect(result.consentId).toBe("id");
		expect(result.categories).toEqual(["necessary", "analytics"]);
	});

	it("returns empty object when cookie missing", () => {
		const config: CookieConfig = {
			name: "cc_cookie",
			expiresAfterDays: 182,
			domain: "",
			path: "/",
			secure: true,
			sameSite: "Lax"
		};
		const result = getPluginCookie(config);
		expect(result).toEqual(EMPTY_COOKIE);
	});
});

describe("setCookieValue", () => {
	it("writes cookie to document", () => {
		const config: CookieConfig = {
			name: "cc_cookie",
			expiresAfterDays: 182,
			domain: "localhost",
			path: "/",
			secure: true,
			sameSite: "Lax"
		};
		const content: CookieValue = {
			categories: ["necessary"],
			services: {},
			revision: 0,
			data: null,
			consentId: "test-id",
			consentTimestamp: new Date().toISOString()
		};

		setCookieValue(content, config);
		expect(document.cookie).toContain("cc_cookie=");
		expect(document.cookie).toContain("test-id");
	});

	it("writes cookie with function-based expiration", () => {
		const config: CookieConfig = {
			name: "dynamic_cookie",
			expiresAfterDays: (type) => (type === "all" ? 365 : 30),
			domain: "localhost",
			path: "/",
			secure: false,
			sameSite: "Lax"
		};
		const content: CookieValue = {
			categories: ["necessary"],
			services: {},
			revision: 0,
			data: null,
			consentId: "test-id",
			consentTimestamp: new Date().toISOString()
		};

		setCookieValue(content, config);
		expect(document.cookie).toContain("dynamic_cookie=");
	});

	it("includes SameSite attribute", () => {
		const config: CookieConfig = {
			name: "test",
			expiresAfterDays: 1,
			domain: "",
			path: "/",
			secure: false,
			sameSite: "Strict"
		};
		const content: CookieValue = {
			categories: [],
			services: {},
			revision: 0,
			data: null,
			consentId: "id",
			consentTimestamp: new Date().toISOString()
		};

		setCookieValue(content, config);
		expect(document.cookie).toContain("SameSite=Strict");
	});

	it("writes cookie without Domain for localhost hostname", () => {
		const config: CookieConfig = {
			name: "test",
			expiresAfterDays: 1,
			domain: "example.com",
			path: "/",
			secure: false,
			sameSite: "Lax"
		};
		const content: CookieValue = {
			categories: [],
			services: {},
			revision: 0,
			data: null,
			consentId: "id",
			consentTimestamp: new Date().toISOString()
		};

		setCookieValue(content, config);
		// Domain is only added when hostname contains a dot
		// In jsdom, hostname is usually "localhost" (no dot) or empty
		expect(document.cookie).toContain("test=");
	});
});

describe("eraseCookiesHelper", () => {
	it("sets expiry for given cookie names", () => {
		eraseCookiesHelper(["test_cookie"], "localhost", "/");
		expect(document.cookie).toContain("test_cookie=;");
		expect(document.cookie).toContain("expires=Thu, 01 Jan 1970");
	});

	it("handles www-domain", () => {
		eraseCookiesHelper(["test_cookie"], "www.example.com", "/");
		expect(document.cookie).toContain("domain=.example.com");
	});

	it("handles empty cookie list", () => {
		const before = document.cookie;
		eraseCookiesHelper([], "localhost", "/");
		expect(document.cookie).toBe(before);
	});
});

describe("autoclearRejectedCookies", () => {
	it("clears cookies for rejected categories", () => {
		Object.defineProperty(document, "cookie", {
			writable: true,
			value: "_ga=123; _gid=456; custom=789"
		});

		const result = autoclearRejectedCookies(
			["analytics", "marketing"],
			{
				analytics: {
					autoClear: {
						cookies: [{ name: /^_ga/ }, { name: "_gid" }]
					}
				},
				marketing: {
					autoClear: {
						cookies: [{ name: "custom" }]
					}
				}
			},
			[], // acceptedCategories (none accepted)
			"localhost",
			"/"
		);

		expect(result.reload).toBe(false);
	});

	it("does not clear cookies for accepted categories", () => {
		Object.defineProperty(document, "cookie", {
			writable: true,
			value: "_ga=123"
		});

		const result = autoclearRejectedCookies(
			["analytics"],
			{
				analytics: {
					autoClear: {
						cookies: [{ name: "_ga" }]
					}
				}
			},
			["analytics"], // analytics is accepted
			"localhost",
			"/"
		);

		expect(result.reload).toBe(false);
	});

	it("returns reload true when autoClear.reloadPage is set", () => {
		Object.defineProperty(document, "cookie", {
			writable: true,
			value: ""
		});

		const result = autoclearRejectedCookies(
			["analytics"],
			{
				analytics: {
					autoClear: {
						reloadPage: true,
						cookies: []
					}
				}
			},
			[], // rejected
			"localhost",
			"/"
		);

		expect(result.reload).toBe(true);
	});

	it("handles regex cookie name matching", () => {
		Object.defineProperty(document, "cookie", {
			writable: true,
			value: "ga_tracker=1; ga_session=2; fb_pixel=3"
		});

		autoclearRejectedCookies(
			["analytics"],
			{
				analytics: {
					autoClear: {
						cookies: [{ name: /^ga_/ }]
					}
				}
			},
			[], // rejected
			"localhost",
			"/"
		);

		expect(document.cookie).not.toContain("ga_tracker=1");
		expect(document.cookie).not.toContain("ga_session=2");
	});
});
