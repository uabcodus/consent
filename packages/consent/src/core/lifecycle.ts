import type { InternalState, Events } from "./state";
import type { AutoClearCategoryConfig } from "./cookies";
import type { ConsentCallbacks } from "./types";
import type { Store } from "./store";
import { uuidv4, deepCopy, unique } from "./utils";
import { autoclearRejectedCookies } from "./cookies";
import { runServiceCallbacks, manageExistingScripts } from "./scripts";
import { buildPublicState } from "./state";

export interface PersistAndSyncParams {
  internal: InternalState;
  store: Store<ReturnType<typeof buildPublicState>>;
}

export function persistAndSync({ internal, store }: PersistAndSyncParams): void {
  if (!internal.consentTimestamp) internal.consentTimestamp = new Date();
  if (!internal.consentId) internal.consentId = uuidv4();

  for (const cat of internal.categoryNames) {
    internal.acceptedServices[cat] = unique(internal.enabledServices[cat] ?? []);
  }

  internal.cookieContent = {
    categories: [...internal.acceptedCategories],
    revision: internal.config.revision,
    data: internal.cookieData,
    consentTimestamp: internal.consentTimestamp!.toISOString(),
    consentId: internal.consentId,
    services: { ...internal.acceptedServices },
  };

  if (internal.lastConsentTimestamp) {
    internal.cookieContent.lastConsentTimestamp = internal.lastConsentTimestamp.toISOString();
  }

  internal.config.storage.set(internal.cookieContent);

  if (internal.config.autoClearCookies) {
    const defaultDomain = typeof location !== "undefined" ? location.hostname : "";
    const result = autoclearRejectedCookies(
      internal.categoryNames,
      internal.config.categories as Record<string, AutoClearCategoryConfig>,
      internal.acceptedCategories,
      internal.acceptedServices,
      defaultDomain,
      "/",
    );
    if (result.reload) {
      if (typeof location !== "undefined") {
        location.reload();
      }
    }
  }

  runServiceCallbacks(
    internal.categoryNames,
    internal.definedServices as Record<
      string,
      Record<string, { onAccept?: () => void; onReject?: () => void }>
    >,
    internal.acceptedServices,
    internal.lastChangedServices,
    internal.lastEnabledServices,
  );

  if (internal.config.manageScripts) {
    manageExistingScripts(
      internal.allScriptTags,
      internal.acceptedCategories,
      internal.acceptedServices,
      internal.lastChangedCategoryNames,
      internal.lastChangedServices,
      internal.config.scriptType,
    );
  }

  store.set(buildPublicState(internal));
}

export function fireCallbacks(
  event: "firstConsent" | "consent" | "change",
  internal: InternalState,
  callbacks: ConsentCallbacks,
  events: Events,
): void {
  const cookie = internal.cookieContent!;
  const payload = deepCopy({ cookie });

  if (event === "firstConsent") {
    callbacks.onFirstConsent?.(payload);
    callbacks.onConsent?.(payload);
  } else if (event === "consent") {
    callbacks.onConsent?.(payload);
  } else if (event === "change") {
    callbacks.onChange?.(
      deepCopy({
        cookie,
        changedCategories: internal.lastChangedCategoryNames,
        changedServices: internal.lastChangedServices,
      }),
    );
  }

  emit(events, event, payload);
}

export function emit(events: Events, event: string, ...args: Array<unknown>): void {
  const handlers = events[event];
  if (handlers) {
    for (const handler of handlers) {
      handler(...args);
    }
  }
}
