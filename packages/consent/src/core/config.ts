import type { CategoryConfig, ConsentConfig, ServiceConfig } from "./types";
import { resolveCookieConfig } from "./cookies";

export interface ConsentConfigResolved<TCategories extends Record<string, CategoryConfig>> {
  mode: "opt-in" | "opt-out";
  revision: number;
  hideFromBots: boolean;
  manageScripts: boolean;
  autoClearCookies: boolean;
  revisionEnabled: boolean;
  categories: TCategories;
  categoryNames: Array<string>;
  readOnlyCategories: Array<string>;
  services: Record<string, Record<string, ServiceConfig>>;
  cookie: ReturnType<typeof resolveCookieConfig>;
}

export function isBot(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /bot|crawl|spider|slurp|teoma/i.test(ua) || !!navigator.webdriver;
}

export function resolveConfig<TCategories extends Record<string, CategoryConfig>>(
  userConfig: ConsentConfig<TCategories>,
): ConsentConfigResolved<TCategories> {
  const categories = userConfig.categories;
  const categoryNames = Object.keys(categories);
  const readOnlyCategories: Array<string> = [];

  const allServices: Record<string, Record<string, ServiceConfig>> = {};

  for (const name of categoryNames) {
    const cat = categories[name]!;
    allServices[name] = {};

    if (cat.readOnly) {
      readOnlyCategories.push(name);
    }

    const services = cat.services ?? {};
    const serviceNames = Object.keys(services);
    for (const svcName of serviceNames) {
      const service = { ...services[svcName] };
      allServices[name]![svcName] = service;
    }
  }

  const userMode = userConfig.mode;
  const hideFromBots = userConfig.hideFromBots ?? true;
  const revision = userConfig.revision ?? 0;

  return {
    mode: userMode === "opt-out" ? "opt-out" : "opt-in",
    revision,
    revisionEnabled: revision > 0,
    hideFromBots,
    manageScripts: userConfig.manageScripts ?? false,
    autoClearCookies: userConfig.autoClearCookies ?? true,
    categories,
    categoryNames,
    readOnlyCategories,
    services: allServices,
    cookie: resolveCookieConfig(userConfig.cookie),
  };
}
