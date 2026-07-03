export { createConsent } from "./consent";
export { parseConsentCookie } from "./cookies";
export { isBot } from "./config";
export { googleConsentMode, syncGtagConsent } from "./presets";
export type {
  ConsentConfig,
  ConsentInstance,
  ConsentState,
  ConsentCallbacks,
  CookieValue,
  CookieItem,
  CategoryConfig,
  ServiceConfig,
  ConsentMode,
  AcceptType,
  CategoryNames,
  CategoryAcceptArg,
  ServiceNames,
  ServiceAcceptArg,
} from "./types";
