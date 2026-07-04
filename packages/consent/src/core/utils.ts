import type { CategoryConfig, ConsentConfig, ConsentCallbacks } from "./types";

export function deepCopy<T>(value: T): T {
  try {
    return structuredClone(value);
  } catch {
    try {
      return JSON.parse(JSON.stringify(value)) as T;
    } catch {
      return value;
    }
  }
}

export function uuidv4(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}

export function arrayDiff<T>(a: Array<T> | undefined, b: Array<T> | undefined): Array<T> {
  const arrA = a ?? [];
  const arrB = b ?? [];
  return arrA.filter((x) => !arrB.includes(x)).concat(arrB.filter((x) => !arrA.includes(x)));
}

export function unique<T>(arr: Array<T>): Array<T> {
  return [...new Set(arr)];
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
