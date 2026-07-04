import type { CategoryConfig, ConsentConfig, ConsentState, CookieValue } from "./types";
import type { ConsentConfigResolved } from "./config";
import type { ScriptInfo } from "./scripts";
import { isBot } from "./config";
import { parseConsentCookie } from "./cookies";
import { unique, resolveAcceptType } from "./utils";

export type Events = Record<string, Set<(...args: Array<unknown>) => void>>;

export interface InternalState {
  config: ConsentConfigResolved<Record<string, CategoryConfig>>;
  valid: boolean;
  skipped: boolean;
  mode: "opt-in" | "opt-out";
  acceptType: "all" | "custom" | "necessary";
  categoryNames: Array<string>;
  readOnlyCategories: Array<string>;
  acceptedCategories: Array<string>;
  acceptedServices: Record<string, Array<string>>;
  definedServices: Record<
    string,
    Record<
      string,
      {
        onAccept?: () => void;
        onReject?: () => void;
        _enabled?: boolean;
        cookies?: Array<{ name: string | RegExp; path?: string; domain?: string }>;
      }
    >
  >;
  defaultEnabledCategories: Array<string>;
  enabledServices: Record<string, Array<string>>;
  cookieContent: CookieValue | null;
  consentId: string;
  consentTimestamp: Date | null;
  lastConsentTimestamp: Date | null;
  cookieData: unknown;
  allScriptTags: Array<ScriptInfo>;
  lastChangedCategoryNames: Array<string>;
  lastChangedServices: Record<string, Array<string>>;
  lastEnabledServices: Record<string, Array<string>>;
  revisionValid: boolean;
  events: Events;
}

export function buildPublicState(internal: InternalState): ConsentState {
  const categories: Record<string, { accepted: boolean; readOnly: boolean }> = {};
  for (const name of internal.categoryNames) {
    categories[name] = {
      accepted: internal.acceptedCategories.includes(name),
      readOnly: internal.readOnlyCategories.includes(name),
    };
  }

  const services: Record<string, Record<string, boolean>> = {};
  for (const cat of internal.categoryNames) {
    const svcMap: Record<string, boolean> = {};
    const allSvcs = Object.keys(internal.definedServices[cat] ?? {});
    for (const svc of allSvcs) {
      svcMap[svc] = (internal.acceptedServices[cat] ?? []).includes(svc);
    }
    services[cat] = svcMap;
  }

  return {
    valid: internal.valid,
    skipped: internal.skipped,
    categories,
    services,
    cookie: internal.cookieContent,
    mode: internal.mode,
    acceptType: internal.acceptType,
  };
}

function parseInitialCookie(initial: CookieValue | string | null | undefined): CookieValue | null {
  if (!initial) return null;
  if (typeof initial === "string") return parseConsentCookie(initial);
  return initial;
}

export function createInitialInternalState(
  merged: ConsentConfig<Record<string, CategoryConfig>>,
  config: ConsentConfigResolved<Record<string, CategoryConfig>>,
): InternalState {
  const initialCookie = parseInitialCookie(
    merged.initialCookie as CookieValue | string | null | undefined,
  );
  const cookieValue = initialCookie ?? config.storage.get();

  const categories = cookieValue?.categories;
  const savedServices = cookieValue?.services;
  const consentId = cookieValue?.consentId;
  const consentTimestamp = cookieValue?.consentTimestamp;
  const lastConsentTimestamp = cookieValue?.lastConsentTimestamp;
  const savedData = cookieValue?.data;
  const savedRevision = cookieValue?.revision;

  const validCategories = Array.isArray(categories) && categories.length > 0;
  const validConsentId = !!consentId && typeof consentId === "string";
  const isBotDetected = config.hideFromBots && isBot();

  const revisionValid =
    !config.revisionEnabled || !validConsentId || savedRevision === config.revision;

  let valid =
    validConsentId &&
    revisionValid &&
    !!consentTimestamp &&
    !!lastConsentTimestamp &&
    validCategories;

  if (valid && (cookieValue as CookieValue)?.expirationTime) {
    valid = new Date().getTime() <= ((cookieValue as CookieValue).expirationTime ?? 0);
    if (!valid) {
      config.storage.remove();
    }
  }

  const defaultEnabled: Array<string> = [];
  const initialServices: Record<string, Array<string>> = {};
  const enabledSvcs: Record<string, Array<string>> = {};

  for (const name of config.categoryNames) {
    initialServices[name] = [];
    enabledSvcs[name] = [];
    const cat = config.categories[name]!;
    if (cat.readOnly || cat.enabled) {
      defaultEnabled.push(name);
      for (const svc of Object.keys(config.services[name] ?? {})) {
        enabledSvcs[name]!.push(svc);
        if (config.mode === "opt-out") {
          initialServices[name]!.push(svc);
        }
      }
    }
  }

  const acceptedCategories = valid
    ? unique([...config.readOnlyCategories, ...(categories ?? [])])
    : config.mode === "opt-out"
      ? unique([...config.readOnlyCategories, ...defaultEnabled])
      : [...config.readOnlyCategories];

  const acceptedServices: Record<string, Array<string>> = valid
    ? { ...initialServices, ...((savedServices ?? {}) as Record<string, Array<string>>) }
    : { ...initialServices };

  return {
    config,
    valid: isBotDetected ? true : valid,
    skipped: isBotDetected,
    mode: config.mode,
    acceptType: resolveAcceptType(
      acceptedCategories,
      config.categoryNames,
      config.readOnlyCategories,
    ),
    categoryNames: config.categoryNames,
    readOnlyCategories: config.readOnlyCategories,
    acceptedCategories,
    acceptedServices,
    definedServices: config.services as Record<
      string,
      Record<
        string,
        {
          onAccept?: () => void;
          onReject?: () => void;
          _enabled?: boolean;
          cookies?: Array<{ name: string | RegExp; path?: string; domain?: string }>;
        }
      >
    >,
    defaultEnabledCategories: defaultEnabled,
    enabledServices: enabledSvcs,
    cookieContent: valid ? (cookieValue as CookieValue) : null,
    consentId: consentId ?? "",
    consentTimestamp: consentTimestamp ? new Date(consentTimestamp) : null,
    lastConsentTimestamp: lastConsentTimestamp ? new Date(lastConsentTimestamp) : null,
    cookieData: savedData ?? null,
    allScriptTags: [],
    lastChangedCategoryNames: [],
    lastChangedServices: {},
    lastEnabledServices: {},
    revisionValid: true,
    events: {},
  };
}
