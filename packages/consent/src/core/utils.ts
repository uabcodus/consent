export function deepCopy<T>(value: T): T {
  if (typeof value !== "object" || value === null) return value;
  if (value instanceof Date) return new Date(value.getTime()) as unknown as T;
  if (value instanceof RegExp) return new RegExp(value.source, value.flags) as unknown as T;

  const clone = (Array.isArray(value) ? [] : {}) as Record<string, unknown>;
  for (const key of Object.keys(value as Record<string, unknown>)) {
    clone[key] = deepCopy((value as Record<string, unknown>)[key]);
  }
  return clone as T;
}

export function uuidv4(): string {
  return (([1e7] as unknown as string) + -1e3 + -4e3 + -8e3 + -1e11).replace(
    /[018]/g,
    (c: string) =>
      (
        Number(c) ^
        (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (Number(c) / 4)))
      ).toString(16),
  );
}

export function arrayDiff<T>(a: Array<T> | undefined, b: Array<T> | undefined): Array<T> {
  const arrA = a ?? [];
  const arrB = b ?? [];
  return arrA.filter((x) => !arrB.includes(x)).concat(arrB.filter((x) => !arrA.includes(x)));
}

export function unique<T>(arr: Array<T>): Array<T> {
  return Array.from(new Set(arr));
}

export function resolveAcceptType(
  acceptedCategories: Array<string>,
  allCategoryNames: Array<string>,
  readOnlyCategories: Array<string>,
): "all" | "custom" | "necessary" {
  const count = acceptedCategories.length;
  if (count === allCategoryNames.length) return "all";
  if (count === readOnlyCategories.length) return "necessary";
  return "custom";
}

export function safeRun<T>(fn: () => T, fallback?: T): T | false | undefined {
  try {
    return fn();
  } catch {
    return fallback ?? false;
  }
}

import type { CategoryConfig, ConsentConfig, ConsentCallbacks } from "./types";

export function mergeConfigs<TCategories extends Record<string, CategoryConfig>>(
  userConfig: ConsentConfig<TCategories>,
): ConsentConfig<TCategories> {
  const preset = userConfig.preset;
  if (!preset) return userConfig;

  return {
    ...preset,
    ...userConfig,
    categories: mergeCategories(preset.categories, userConfig.categories) as TCategories,
    callbacks: mergeCallbacks(preset.callbacks, userConfig.callbacks),
    preset: undefined,
  };
}

function mergeCategories(
  presetCategories: Record<string, CategoryConfig> | undefined,
  userCategories: Record<string, CategoryConfig>,
): Record<string, CategoryConfig> {
  if (!presetCategories) return { ...userCategories };

  const merged: Record<string, CategoryConfig> = {};
  const allKeys = new Set([...Object.keys(presetCategories), ...Object.keys(userCategories)]);

  for (const key of allKeys) {
    const presetCat = presetCategories[key];
    const userCat = userCategories[key];

    if (presetCat && userCat) {
      merged[key] = {
        ...presetCat,
        ...userCat,
        services: {
          ...presetCat.services,
          ...userCat.services,
        },
        autoClear: userCat.autoClear ?? presetCat.autoClear,
      };
    } else {
      merged[key] = userCat ?? presetCat!;
    }
  }

  return merged;
}

function mergeCallbacks(
  presetCallbacks: ConsentCallbacks | undefined,
  userCallbacks: ConsentCallbacks | undefined,
): ConsentCallbacks | undefined {
  if (!presetCallbacks) return userCallbacks;
  if (!userCallbacks) return presetCallbacks;
  return { ...presetCallbacks, ...userCallbacks };
}
