import type { InternalState } from "./state";
import { uuidv4, unique, resolveAcceptType, deepCopy, arrayDiff } from "./utils";

export interface ActionDependencies {
  internal: InternalState;
  persistAndSync: () => void;
  fireCallbacks: (event: "firstConsent" | "consent" | "change") => void;
}

export function acceptCategories(
  acceptArg: string | Array<string>,
  excludedCategories: Array<string>,
  deps: ActionDependencies
): void {
  const { internal } = deps;
  const prevValid = internal.valid;
  const prevCategories = [...internal.acceptedCategories];

  let enabled: Array<string>;

  if (typeof acceptArg === "string" && acceptArg === "all") {
    enabled = [...internal.categoryNames];
  } else if (typeof acceptArg === "string" && acceptArg === "necessary") {
    enabled = [...internal.readOnlyCategories];
  } else if (Array.isArray(acceptArg)) {
    enabled = [...acceptArg];
  } else if (typeof acceptArg === "string") {
    enabled = [acceptArg];
  } else {
    enabled = [...internal.acceptedCategories, ...internal.defaultEnabledCategories];
  }

  enabled = enabled.filter((c) => !excludedCategories.includes(c));

  const prevEnabledServices = deepCopy(internal.enabledServices);

  for (const cat of internal.categoryNames) {
    internal.enabledServices[cat] = enabled.includes(cat)
      ? Object.keys(internal.definedServices[cat] ?? {})
      : [];
  }

  internal.acceptedCategories = unique([...internal.readOnlyCategories, ...enabled]);

  internal.acceptType = resolveAcceptType(
    internal.acceptedCategories,
    internal.categoryNames,
    internal.readOnlyCategories
  );

  calculateLastChanged(
    internal,
    prevCategories,
    prevEnabledServices,
    internal.config.mode,
    !prevValid
  );

  if (!internal.valid) {
    internal.valid = true;
    internal.consentId = internal.consentId || uuidv4();
    internal.consentTimestamp = internal.consentTimestamp || new Date();
  }

  const isFirstConsent = !prevValid;
  internal.lastConsentTimestamp = internal.lastConsentTimestamp
    ? new Date()
    : (internal.consentTimestamp ?? null);

  deps.persistAndSync();

  if (isFirstConsent) {
    deps.fireCallbacks("firstConsent");
    return;
  }

  fireChangeIfChanged(internal, deps);
}

export function rejectCategories(
  rejectArg: string | Array<string>,
  deps: ActionDependencies
): void {
  const { internal } = deps;
  const prevCategories = [...internal.acceptedCategories];
  const prevEnabledServices = deepCopy(internal.enabledServices);

  let toReject: Array<string>;

  if (typeof rejectArg === "string" && rejectArg === "all") {
    toReject = internal.categoryNames.filter((c) => !internal.readOnlyCategories.includes(c));
  } else if (typeof rejectArg === "string" && rejectArg === "necessary") {
    toReject = [];
  } else if (Array.isArray(rejectArg)) {
    toReject = rejectArg;
  } else if (typeof rejectArg === "string") {
    toReject = [rejectArg];
  } else {
    toReject = [];
  }

  toReject = toReject.filter((c) => !internal.readOnlyCategories.includes(c));

  internal.acceptedCategories = internal.acceptedCategories.filter((c) => !toReject.includes(c));

  for (const cat of toReject) {
    internal.enabledServices[cat] = [];
  }

  internal.acceptType = resolveAcceptType(
    internal.acceptedCategories,
    internal.categoryNames,
    internal.readOnlyCategories
  );

  calculateLastChanged(internal, prevCategories, prevEnabledServices, internal.config.mode, false);

  deps.persistAndSync();

  fireChangeIfChanged(internal, deps);
}

export function acceptServiceAction(
  service: string | Array<string>,
  category: string,
  deps: ActionDependencies
): void {
  const { internal } = deps;

  if (!category || !internal.categoryNames.includes(category)) return;

  const catName = category;
  const svcNames = Object.keys(internal.definedServices[catName] ?? {});

  if (svcNames.length === 0) return;

  const prevEnabledServices = deepCopy(internal.enabledServices);
  const prevCategories = [...internal.acceptedCategories];

  if (typeof service === "string" && service === "all") {
    internal.enabledServices[catName] = [...svcNames];
  } else if (typeof service === "string") {
    if (svcNames.includes(service)) {
      internal.enabledServices[catName] = [service];
    }
  } else if (Array.isArray(service)) {
    internal.enabledServices[catName] = service.filter((s) => svcNames.includes(s));
  }

  if ((internal.enabledServices[catName] ?? []).length === 0) {
    internal.acceptedCategories = internal.acceptedCategories.filter((c) => c !== catName);
  } else {
    internal.acceptedCategories = unique([...internal.acceptedCategories, catName]);
  }

  internal.acceptedServices[catName] = unique(internal.enabledServices[catName]);

  calculateLastChanged(internal, prevCategories, prevEnabledServices, internal.config.mode, false);

  deps.persistAndSync();

  fireChangeIfChanged(internal, deps);
}

export function rejectServiceAction(
  service: string | Array<string>,
  category: string,
  deps: ActionDependencies
): void {
  const { internal } = deps;

  if (!category || !internal.categoryNames.includes(category)) return;

  const catName = category;

  const prevEnabledServices = deepCopy(internal.enabledServices);
  const prevCategories = [...internal.acceptedCategories];

  if (typeof service === "string" && service === "all") {
    internal.enabledServices[catName] = [];
  } else if (typeof service === "string") {
    internal.enabledServices[catName] = (internal.enabledServices[catName] ?? []).filter(
      (s) => s !== service
    );
  } else if (Array.isArray(service)) {
    internal.enabledServices[catName] = (internal.enabledServices[catName] ?? []).filter(
      (s) => !service.includes(s)
    );
  }

  if ((internal.enabledServices[catName] ?? []).length === 0) {
    internal.acceptedCategories = internal.acceptedCategories.filter((c) => c !== catName);
  }

  internal.acceptedServices[catName] = unique(internal.enabledServices[catName]);

  calculateLastChanged(internal, prevCategories, prevEnabledServices, internal.config.mode, false);

  deps.persistAndSync();

  fireChangeIfChanged(internal, deps);
}

function fireChangeIfChanged(internal: InternalState, deps: ActionDependencies): void {
  const changed =
    internal.lastChangedCategoryNames.length > 0 ||
    Object.values(internal.lastChangedServices).some((s) => s.length > 0);
  if (changed) deps.fireCallbacks("change");
}

function calculateLastChanged(
  internal: InternalState,
  prevAcceptedCategories: Array<string>,
  prevEnabledServices: Record<string, Array<string>>,
  mode: "opt-in" | "opt-out",
  isFirstConsent: boolean
): void {
  if (mode === "opt-out" && isFirstConsent) {
    internal.lastChangedCategoryNames = arrayDiff(
      internal.defaultEnabledCategories,
      internal.acceptedCategories
    );
  } else {
    internal.lastChangedCategoryNames = arrayDiff(
      internal.acceptedCategories,
      prevAcceptedCategories
    );
  }

  internal.lastChangedServices = {};
  for (const cat of internal.categoryNames) {
    internal.lastChangedServices[cat] = arrayDiff(
      internal.acceptedServices[cat],
      prevEnabledServices[cat]
    );
  }

  internal.lastEnabledServices = deepCopy(internal.acceptedServices);
}
