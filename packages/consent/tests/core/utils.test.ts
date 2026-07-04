import { describe, it, expect } from "vitest";
import {
  deepCopy,
  uuidv4,
  arrayDiff,
  unique,
  resolveAcceptType,
  mergeConfigs,
} from "../../src/core/utils";
import type { CategoryConfig, ConsentConfig, ConsentCallbacks } from "../../src/core/types";

describe("deepCopy", () => {
  it("returns primitive values directly", () => {
    expect(deepCopy(42)).toBe(42);
    expect(deepCopy("hello")).toBe("hello");
    expect(deepCopy(null)).toBe(null);
    expect(deepCopy(undefined)).toBe(undefined);
    expect(deepCopy(true)).toBe(true);
  });

  it("deep copies a plain object", () => {
    const obj = { a: 1, b: { c: 2 } };
    const copy = deepCopy(obj);
    expect(copy).toEqual(obj);
    expect(copy).not.toBe(obj);
    expect(copy.b).not.toBe(obj.b);
  });

  it("deep copies arrays", () => {
    const arr = [1, [2, 3], { a: 4 }];
    const copy = deepCopy(arr);
    expect(copy).toEqual(arr);
    expect(copy).not.toBe(arr);
    expect(copy[1]).not.toBe(arr[1]);
    expect(copy[2]).not.toBe(arr[2]);
  });

  it("preserves Date objects", () => {
    const date = new Date("2024-01-01");
    const copy = deepCopy(date);
    expect(copy).toBeInstanceOf(Date);
    expect(copy.getTime()).toBe(date.getTime());
    expect(copy).not.toBe(date);
  });

  it("preserves RegExp objects", () => {
    const re = /test\d/gi;
    const copy = deepCopy(re);
    expect(copy).toBeInstanceOf(RegExp);
    expect(copy.source).toBe(re.source);
    expect(copy.flags).toBe(re.flags);
    expect(copy).not.toBe(re);
  });

  it("handles deeply nested structures", () => {
    const nested = {
      a: [1, { b: new Date(1000), c: /test/ }],
      d: { e: { f: "deep" } },
    };
    const copy = deepCopy(nested);
    expect(copy).toEqual(nested);
  });

  it("handles empty objects and arrays", () => {
    expect(deepCopy({})).toEqual({});
    expect(deepCopy([])).toEqual([]);
  });
});

describe("uuidv4", () => {
  it("returns a string", () => {
    expect(typeof uuidv4()).toBe("string");
  });

  it("returns a valid UUID v4 format", () => {
    const uuid = uuidv4();
    expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it("generates unique IDs", () => {
    const ids = new Set(Array.from({ length: 100 }, () => uuidv4()));
    expect(ids.size).toBe(100);
  });
});

describe("arrayDiff", () => {
  it("returns elements unique to each array", () => {
    expect(arrayDiff([1, 2, 3], [2, 3, 4])).toEqual([1, 4]);
  });

  it("returns empty for identical arrays", () => {
    expect(arrayDiff([1, 2], [1, 2])).toEqual([]);
  });

  it("handles empty first array", () => {
    expect(arrayDiff([], [1, 2])).toEqual([1, 2]);
  });

  it("handles empty second array", () => {
    expect(arrayDiff([1, 2], [])).toEqual([1, 2]);
  });

  it("handles undefined inputs", () => {
    expect(arrayDiff(undefined, [1, 2])).toEqual([1, 2]);
    expect(arrayDiff([1, 2], undefined)).toEqual([1, 2]);
    expect(arrayDiff(undefined, undefined)).toEqual([]);
  });

  it("preserves order from first then second array", () => {
    expect(arrayDiff(["a", "b", "c"], ["b", "d"])).toEqual(["a", "c", "d"]);
  });
});

describe("unique", () => {
  it("removes duplicate values", () => {
    expect(unique([1, 2, 2, 3, 1])).toEqual([1, 2, 3]);
  });

  it("returns same array if no duplicates", () => {
    expect(unique([1, 2, 3])).toEqual([1, 2, 3]);
  });

  it("handles empty array", () => {
    expect(unique([])).toEqual([]);
  });

  it("handles string arrays", () => {
    expect(unique(["a", "b", "a", "c"])).toEqual(["a", "b", "c"]);
  });
});

describe("resolveAcceptType", () => {
  it('returns "all" when all categories are accepted', () => {
    expect(resolveAcceptType(["a", "b", "c"], ["a", "b", "c"], [])).toBe("all");
  });

  it('returns "necessary" when only readOnly categories are accepted', () => {
    expect(resolveAcceptType(["necessary"], ["necessary", "a", "b"], ["necessary"])).toBe(
      "necessary",
    );
  });

  it('returns "custom" for partial acceptance', () => {
    expect(resolveAcceptType(["necessary", "a"], ["necessary", "a", "b"], ["necessary"])).toBe(
      "custom",
    );
  });

  it('returns "all" when no readOnly categories exist', () => {
    expect(resolveAcceptType(["a", "b"], ["a", "b"], [])).toBe("all");
  });

  it("handles empty accepted categories with no readOnly", () => {
    // When no categories are accepted and there are no readOnly categories,
    // length 0 === length 0? Actually: count is 0, allCategoryNames.length is 2 (a,b)
    // 0 === 2? No. 0 === 0 (readOnlyCategories.length)? Yes => "necessary"
    expect(resolveAcceptType([], ["a", "b"], [])).toBe("necessary");
  });
});

describe("mergeConfigs", () => {
  it("returns userConfig unchanged when no preset", () => {
    const config: ConsentConfig<Record<string, CategoryConfig>> = {
      categories: { analytics: {} },
    };
    const result = mergeConfigs(config);
    expect(result).toEqual(config);
  });

  it("merges preset categories with user categories", () => {
    const preset: ConsentConfig<Record<string, CategoryConfig>> = {
      categories: { analytics: { services: { ga: {} } } },
    };
    const userConfig: ConsentConfig<Record<string, CategoryConfig>> = {
      preset,
      categories: { analytics: {} as const, marketing: {} as const },
    };

    const result = mergeConfigs(userConfig);
    expect(result.categories.analytics).toBeDefined();
    expect(result.categories.marketing).toBeDefined();
    expect(result.preset).toBeUndefined();
  });

  it("merges services from preset and user in same category", () => {
    const preset: ConsentConfig<Record<string, CategoryConfig>> = {
      categories: {
        analytics: { services: { ga: {} as const, ga4: {} as const } },
      },
    };
    const userConfig: ConsentConfig<Record<string, CategoryConfig>> = {
      preset,
      categories: {
        analytics: { services: { mixpanel: {} as const } },
      },
    };

    const result = mergeConfigs(userConfig);
    const services = result.categories.analytics?.services;
    expect(services).toBeDefined();
    expect(Object.keys(services!)).toContain("ga");
    expect(Object.keys(services!)).toContain("ga4");
    expect(Object.keys(services!)).toContain("mixpanel");
  });

  it("user callbacks override preset callbacks", () => {
    const presetOnConsent = () => {};
    const userOnConsent = () => {};

    const userConfig: ConsentConfig<Record<string, CategoryConfig>> = {
      preset: {
        categories: {},
        callbacks: { onConsent: presetOnConsent },
      },
      callbacks: { onConsent: userOnConsent },
      categories: {},
    };

    const result = mergeConfigs(userConfig);
    expect(result.callbacks?.onConsent).toBe(userOnConsent);
  });

  it("merges preset callbacks when user has none", () => {
    const presetOnConsent = () => {};

    const userConfig: ConsentConfig<Record<string, CategoryConfig>> = {
      preset: {
        categories: {},
        callbacks: { onConsent: presetOnConsent },
      },
      categories: {},
    };

    const result = mergeConfigs(userConfig);
    expect(result.callbacks?.onConsent).toBe(presetOnConsent);
  });

  it("user autoClear overrides preset autoClear", () => {
    const userConfig: ConsentConfig<Record<string, CategoryConfig>> = {
      preset: {
        categories: {
          analytics: { autoClear: { cookies: [{ name: "_ga" }] } },
        },
      },
      categories: {
        analytics: { autoClear: { cookies: [{ name: "_custom" }] } },
      },
    };

    const result = mergeConfigs(userConfig);
    const autoClearCookies = result.categories.analytics?.autoClear?.cookies;
    expect(autoClearCookies).toEqual([{ name: "_custom" }]);
  });

  it("preserves preset categories that user does not override", () => {
    const userConfig: ConsentConfig<Record<string, CategoryConfig>> = {
      preset: {
        categories: {
          necessary: { readOnly: true },
          analytics: {},
        },
      },
      categories: {
        analytics: { enabled: true },
      },
    };

    const result = mergeConfigs(userConfig);
    expect(result.categories.necessary).toMatchObject({ readOnly: true });
    expect(result.categories.analytics).toMatchObject({ enabled: true });
  });

  it("handles empty preset categories", () => {
    const userConfig: ConsentConfig<Record<string, CategoryConfig>> = {
      preset: { categories: {} },
      categories: { analytics: {} },
    };

    const result = mergeConfigs(userConfig);
    expect(result.categories.analytics).toEqual({});
  });

  it("handles userConfig with no categories from preset only", () => {
    const userConfig: ConsentConfig<Record<string, CategoryConfig>> = {
      preset: {
        categories: { analytics: {} },
      },
      categories: { analytics: {} },
    };

    const result = mergeConfigs(userConfig);
    expect(result.categories.analytics).toBeDefined();
  });
});
