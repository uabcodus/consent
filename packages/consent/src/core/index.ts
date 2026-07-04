export { createConsent } from "./consent";
export { parseConsentCookie } from "./cookies";
export { isBot } from "./config";
export { googleConsentMode, syncGtagConsent } from "./presets";
export { cookieStorage, localStorageStorage } from "./storage";
export type { StorageAdapter } from "./storage";
export type {
  ConsentConfig,
  ConsentInstance,
  ConsentState,
  ConsentCallbacks,
  CookieValue,
  CookieItem,
  CategoryConfig,
  ServiceConfig,
  CookieConfig,
  ConsentMode,
  AcceptType,
  CategoryNames,
  CategoryAcceptArg,
  ServiceNames,
  ServiceAcceptArg,
} from "./types";
