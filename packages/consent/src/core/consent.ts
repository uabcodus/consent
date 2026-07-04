import type {
  CategoryAcceptArg,
  CategoryConfig,
  CategoryNames,
  ConsentCallbacks,
  ConsentConfig,
  ConsentInstance,
  ConsentState,
  CookieValue,
  ServiceAcceptArg,
  ServiceNames,
} from "./types";
import { createStore } from "./store";
import { resolveConfig, isBot } from "./config";
import {
  getSingleCookie,
  getAllCookieNames,
  parseConsentCookie,
  eraseCookiesHelper,
  autoclearRejectedCookies,
  type AutoClearCategoryConfig,
} from "./cookies";
import {
  retrieveScriptElements,
  manageExistingScripts,
  runServiceCallbacks,
  type ScriptInfo,
} from "./scripts";
import { uuidv4, deepCopy, arrayDiff, unique, resolveAcceptType, mergeConfigs } from "./utils";

type Events = Record<string, Set<(...args: Array<unknown>) => void>>;

function buildPublicState(internal: InternalState): ConsentState {
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

interface InternalState {
  config: ReturnType<typeof resolveConfig<any>>;
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
  callbacks: ConsentCallbacks;
  events: Events;
}

export function createConsent<TCategories extends Record<string, CategoryConfig>>(
  userConfig: ConsentConfig<TCategories>,
): ConsentInstance<TCategories> {
  const merged = mergeConfigs(userConfig);
  const config = resolveConfig(merged);

  const initialCookie = parseInitialCookie(merged.initialCookie);
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

  if (valid && (cookieValue as CookieValue).expirationTime) {
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
    ? { ...initialServices, ...(savedServices as Record<string, Array<string>>) }
    : { ...initialServices };

  const internal: InternalState = {
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
    callbacks: merged.callbacks ?? {},
    events: {},
  };

  if (!isBotDetected && config.manageScripts) {
    internal.allScriptTags = retrieveScriptElements(
      config.categoryNames,
      config.services,
      config.scriptType,
    );
  }

  if (valid && !isBotDetected) {
    manageExistingScripts(
      internal.allScriptTags,
      internal.acceptedCategories,
      internal.acceptedServices,
      [],
      {},
      config.scriptType,
    );
  } else if (!isBotDetected && config.mode === "opt-out") {
    manageExistingScripts(
      internal.allScriptTags,
      internal.defaultEnabledCategories,
      internal.acceptedServices,
      [],
      {},
      config.scriptType,
    );
  }

  if (isBotDetected || valid) {
    const cb = internal.callbacks.onConsent;
    if (cb) cb({ cookie: internal.cookieContent! });
  }

  const store = createStore(buildPublicState(internal));

  function emit(event: string, ...args: Array<unknown>) {
    const handlers = internal.events[event];
    if (handlers) {
      for (const handler of handlers) {
        handler(...args);
      }
    }
  }

  function fireCallbacks(event: "firstConsent" | "consent" | "change") {
    const cbs = internal.callbacks;
    const cookie = internal.cookieContent!;

    if (event === "firstConsent") {
      cbs.onFirstConsent?.(deepCopy({ cookie }));
      cbs.onConsent?.(deepCopy({ cookie }));
    } else if (event === "consent") {
      cbs.onConsent?.(deepCopy({ cookie }));
    } else if (event === "change") {
      cbs.onChange?.(
        deepCopy({
          cookie,
          changedCategories: internal.lastChangedCategoryNames,
          changedServices: internal.lastChangedServices,
        }),
      );
    }

    emit(event, deepCopy({ cookie }));
  }

  function persistAndSync() {
    if (!internal.consentTimestamp) internal.consentTimestamp = new Date();
    if (!internal.consentId) internal.consentId = uuidv4();

    for (const cat of internal.categoryNames) {
      internal.acceptedServices[cat] = unique(internal.enabledServices[cat] ?? []);
    }

    internal.cookieContent = {
      categories: deepCopy(internal.acceptedCategories),
      revision: config.revision,
      data: internal.cookieData,
      consentTimestamp: internal.consentTimestamp!.toISOString(),
      consentId: internal.consentId,
      services: deepCopy(internal.acceptedServices),
    };

    if (internal.lastConsentTimestamp) {
      internal.cookieContent.lastConsentTimestamp = internal.lastConsentTimestamp.toISOString();
    }

    config.storage.set(internal.cookieContent);

    if (config.autoClearCookies) {
      autoclearRejectedCookies(
        internal.categoryNames,
        config.categories as Record<string, AutoClearCategoryConfig>,
        internal.acceptedCategories,
        internal.acceptedServices,
        config.cookie,
      );
    }

    runServiceCallbacks(
      internal.categoryNames,
      internal.definedServices as Record<
        string,
        Record<string, { onAccept?: () => void; onReject?: () => void; _enabled?: boolean }>
      >,
      internal.acceptedServices,
      internal.lastChangedServices,
    );

    if (config.manageScripts) {
      manageExistingScripts(
        internal.allScriptTags,
        internal.acceptedCategories,
        internal.acceptedServices,
        internal.lastChangedCategoryNames,
        internal.lastChangedServices,
        config.scriptType,
      );
    }

    store.set(buildPublicState(internal));
  }

  function calculateLastChanged(
    prevAcceptedCategories: Array<string>,
    _prevAcceptedServices: Record<string, Array<string>>,
  ) {
    const mode = config.mode;
    const isFirstConsent = !internal.valid;

    if (mode === "opt-out" && isFirstConsent) {
      internal.lastChangedCategoryNames = arrayDiff(
        internal.defaultEnabledCategories,
        internal.acceptedCategories,
      );
    } else {
      internal.lastChangedCategoryNames = arrayDiff(
        internal.acceptedCategories,
        prevAcceptedCategories,
      );
    }

    internal.lastChangedServices = {};
    for (const cat of internal.categoryNames) {
      internal.lastChangedServices[cat] = arrayDiff(
        internal.acceptedServices[cat],
        internal.lastEnabledServices[cat],
      );
    }

    internal.lastEnabledServices = deepCopy(internal.acceptedServices);
  }

  const instance: ConsentInstance<TCategories> = {
    get state() {
      return store.get();
    },

    accept(acceptArg: CategoryAcceptArg<TCategories>, excludedCategories: Array<string> = []) {
      const prevValid = internal.valid;
      const prevCategories = [...internal.acceptedCategories];
      const prevServices = deepCopy(internal.acceptedServices);

      let enabled: Array<string>;

      if (typeof acceptArg === "string" && acceptArg === "all") {
        enabled = [...internal.categoryNames];
      } else if (typeof acceptArg === "string" && acceptArg === "necessary") {
        enabled = [...internal.readOnlyCategories];
      } else if (Array.isArray(acceptArg)) {
        enabled = [...(acceptArg as Array<string>)];
      } else if (typeof acceptArg === "string") {
        enabled = [acceptArg];
      } else {
        enabled = [...internal.acceptedCategories, ...internal.defaultEnabledCategories];
      }

      enabled = enabled.filter((c) => !excludedCategories.includes(c));

      for (const cat of internal.categoryNames) {
        internal.enabledServices[cat] = enabled.includes(cat)
          ? Object.keys(internal.definedServices[cat] ?? {})
          : [];
      }

      internal.acceptedCategories = unique([...internal.readOnlyCategories, ...enabled]);

      internal.acceptType = resolveAcceptType(
        internal.acceptedCategories,
        internal.categoryNames,
        internal.readOnlyCategories,
      );

      calculateLastChanged(prevCategories, prevServices);

      const isFirstConsent = !prevValid;
      internal.lastConsentTimestamp = internal.lastConsentTimestamp
        ? new Date()
        : internal.consentTimestamp;

      if (!internal.valid) {
        internal.valid = true;
        internal.consentId = internal.consentId || uuidv4();
        internal.consentTimestamp = internal.consentTimestamp || new Date();
      }

      persistAndSync();

      if (isFirstConsent) {
        fireCallbacks("firstConsent");
        return;
      }

      const changed =
        internal.lastChangedCategoryNames.length > 0 ||
        Object.values(internal.lastChangedServices).some((s) => s.length > 0);

      if (changed) fireCallbacks("change");
    },

    reject(rejectArg: CategoryAcceptArg<TCategories>) {
      const prevCategories = [...internal.acceptedCategories];
      const prevServices = deepCopy(internal.acceptedServices);

      let toReject: Array<string>;

      if (typeof rejectArg === "string" && rejectArg === "all") {
        toReject = internal.categoryNames.filter((c) => !internal.readOnlyCategories.includes(c));
      } else if (typeof rejectArg === "string" && rejectArg === "necessary") {
        toReject = [];
      } else if (Array.isArray(rejectArg)) {
        toReject = rejectArg as Array<string>;
      } else if (typeof rejectArg === "string") {
        toReject = [rejectArg];
      } else {
        toReject = [];
      }

      toReject = toReject.filter((c) => !internal.readOnlyCategories.includes(c));

      internal.acceptedCategories = internal.acceptedCategories.filter(
        (c) => !toReject.includes(c),
      );

      for (const cat of toReject) {
        internal.enabledServices[cat] = [];
      }

      internal.acceptType = resolveAcceptType(
        internal.acceptedCategories,
        internal.categoryNames,
        internal.readOnlyCategories,
      );

      calculateLastChanged(prevCategories, prevServices);

      persistAndSync();

      const changed =
        internal.lastChangedCategoryNames.length > 0 ||
        Object.values(internal.lastChangedServices).some((s) => s.length > 0);

      if (changed) fireCallbacks("change");
    },

    acceptedCategory(category: CategoryNames<TCategories>): boolean {
      return internal.acceptedCategories.includes(category);
    },

    acceptService(
      service: ServiceAcceptArg<TCategories, CategoryNames<TCategories>>,
      category: CategoryNames<TCategories>,
    ) {
      if (!category || !internal.categoryNames.includes(category)) return;

      const catName = category as string;
      const svcNames = Object.keys(internal.definedServices[catName] ?? {});

      if (svcNames.length === 0) return;

      if (typeof service === "string" && service === "all") {
        internal.enabledServices[catName] = [...svcNames];
      } else if (typeof service === "string") {
        if (svcNames.includes(service as string)) {
          internal.enabledServices[catName] = [service as string];
        }
      } else if (Array.isArray(service)) {
        internal.enabledServices[catName] = (service as Array<string>).filter((s) =>
          svcNames.includes(s),
        );
      }

      if ((internal.enabledServices[catName] ?? []).length === 0) {
        internal.acceptedCategories = internal.acceptedCategories.filter((c) => c !== catName);
      } else {
        internal.acceptedCategories = unique([...internal.acceptedCategories, catName]);
      }

      internal.acceptedServices[catName] = unique(internal.enabledServices[catName]);

      persistAndSync();
    },

    rejectService(
      service: ServiceAcceptArg<TCategories, CategoryNames<TCategories>>,
      category: CategoryNames<TCategories>,
    ) {
      if (!category || !internal.categoryNames.includes(category)) return;

      const catName = category as string;

      if (typeof service === "string" && service === "all") {
        internal.enabledServices[catName] = [];
      } else if (typeof service === "string") {
        internal.enabledServices[catName] = (internal.enabledServices[catName] ?? []).filter(
          (s) => s !== service,
        );
      } else if (Array.isArray(service)) {
        internal.enabledServices[catName] = (internal.enabledServices[catName] ?? []).filter(
          (s) => !(service as Array<string>).includes(s),
        );
      }

      if ((internal.enabledServices[catName] ?? []).length === 0) {
        internal.acceptedCategories = internal.acceptedCategories.filter((c) => c !== catName);
      }

      internal.acceptedServices[catName] = unique(internal.enabledServices[catName]);

      persistAndSync();
    },

    acceptedService(
      service: ServiceNames<TCategories, CategoryNames<TCategories>>,
      category: CategoryNames<TCategories>,
    ): boolean {
      return (internal.acceptedServices[category as string] ?? []).includes(service as string);
    },

    eraseCookies(
      cookies: string | RegExp | Array<string | RegExp>,
      path?: string,
      domain?: string,
    ) {
      const allCookies = getAllCookieNames();
      const found: Array<string> = [];

      const match = (c: string | RegExp) => {
        if (typeof c === "string") {
          const name = getSingleCookie(c);
          if (name) found.push(name);
        } else {
          for (const name of allCookies) {
            try {
              if (c.test(name)) found.push(name);
            } catch {
              /* noop */
            }
          }
        }
      };

      if (Array.isArray(cookies)) {
        for (const cookie of cookies) match(cookie);
      } else {
        match(cookies);
      }

      eraseCookiesHelper(found, domain ?? config.cookie.domain, path ?? config.cookie.path);
    },

    getCookie(field?: string) {
      const cookie = config.storage.get();
      return field ? cookie[field as keyof CookieValue] : cookie;
    },

    setCookieData(props: { value: unknown; mode: "set" | "update" }) {
      let newData: unknown;
      let changed = false;

      if (props.mode === "update") {
        const current = internal.cookieData;
        if (
          typeof current === "object" &&
          current !== null &&
          typeof props.value === "object" &&
          props.value !== null
        ) {
          newData = { ...(current as Record<string, unknown>) };
          let objChanged = false;
          for (const key of Object.keys(props.value as Record<string, unknown>)) {
            const val = (props.value as Record<string, unknown>)[key];
            if ((newData as Record<string, unknown>)[key] !== val) {
              (newData as Record<string, unknown>)[key] = val;
              objChanged = true;
            }
          }
          changed = objChanged;
        } else if (current !== props.value) {
          newData = props.value;
          changed = true;
        } else {
          newData = current;
        }
      } else {
        if (internal.cookieData !== props.value) {
          newData = props.value;
          changed = true;
        } else {
          newData = internal.cookieData;
        }
      }

      if (changed) {
        internal.cookieData = newData;
        if (internal.cookieContent) {
          internal.cookieContent.data = newData;
          config.storage.set(internal.cookieContent);
        }
      }

      return changed;
    },

    getConfig() {
      return deepCopy({ ...config, categories: config.categories });
    },

    validConsent() {
      return internal.valid;
    },

    loadScript(src: string, attrs?: Record<string, string>): Promise<boolean> {
      return new Promise((resolve) => {
        if (typeof document === "undefined") return resolve(false);

        const existing = document.querySelector(`script[src="${src}"]`);
        if (existing) return resolve(true);

        const script = document.createElement("script");
        if (attrs) {
          for (const key of Object.keys(attrs)) {
            script.setAttribute(key, attrs[key]!);
          }
        }

        script.addEventListener("load", () => resolve(true));
        script.addEventListener("error", () => {
          script.remove();
          resolve(false);
        });
        script.src = src;
        document.head.appendChild(script);
      });
    },

    reset(deleteCookie?: boolean) {
      if (deleteCookie) {
        config.storage.remove();
      }

      internal.valid = false;
      internal.acceptedCategories = [...config.readOnlyCategories];
      internal.acceptedServices = {};
      internal.consentId = "";
      internal.consentTimestamp = null;
      internal.lastConsentTimestamp = null;
      internal.cookieData = null;
      internal.cookieContent = null;
      internal.allScriptTags = [];
      internal.lastChangedCategoryNames = [];
      internal.lastChangedServices = {};
      internal.lastEnabledServices = {};

      store.set(buildPublicState(internal));
    },

    subscribe(listener: (state: Readonly<ConsentState>) => void) {
      return store.subscribe(listener);
    },

    on(event: string, listener: (...args: Array<unknown>) => void) {
      if (!internal.events[event]) {
        internal.events[event] = new Set();
      }
      internal.events[event]?.add(listener);
      return () => {
        internal.events[event]?.delete(listener);
      };
    },

    off(event: string, listener: (...args: Array<unknown>) => void) {
      internal.events[event]?.delete(listener);
    },

    destroy() {
      store.destroy();
      internal.events = {};
    },
  };

  return instance;
}

function parseInitialCookie(initial: CookieValue | string | null | undefined): CookieValue | null {
  if (!initial) return null;
  if (typeof initial === "string") return parseConsentCookie(initial);
  return initial;
}
