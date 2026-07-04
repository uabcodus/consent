import type {
  CategoryConfig,
  ConsentConfig,
  ConsentInstance,
  ConsentState,
  ServiceConfig
} from "./types";

export const googleConsentMode: ConsentConfig<Record<string, CategoryConfig>> = {
  categories: {
    necessary: {
      readOnly: true,
      services: { security_storage: {} as ServiceConfig }
    },
    analytics: {
      services: { analytics_storage: {} as ServiceConfig },
      autoClear: {
        cookies: [{ name: /^_ga/ }, { name: "_gid" }]
      }
    },
    advertisement: {
      services: {
        ad_storage: {} as ServiceConfig,
        ad_user_data: {} as ServiceConfig,
        ad_personalization: {} as ServiceConfig
      }
    },
    functionality: {
      readOnly: true,
      services: {
        functionality_storage: {} as ServiceConfig,
        personalization_storage: {} as ServiceConfig
      }
    }
  }
};

export function syncGtagConsent(
  consent: ConsentInstance<Record<string, CategoryConfig>>
): () => void {
  function handler() {
    updateGtagFromState(consent.state);
  }

  const unsub = consent.subscribe(handler);

  return unsub;
}

function updateGtagFromState(state: Readonly<ConsentState>): void {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;

  const consentEntries: Record<string, "granted" | "denied"> = {};

  for (const categoryName of Object.keys(state.categories)) {
    const services = state.services[categoryName];
    if (!services) continue;
    for (const serviceName of Object.keys(services)) {
      consentEntries[serviceName] = services[serviceName] ? "granted" : "denied";
    }
  }

  window.gtag("consent", "update", consentEntries);

  if (typeof window.dataLayer !== "undefined") {
    window.dataLayer.push({ event: "consent_updated" });
  }
}

declare global {
  interface Window {
    gtag?: (...args: Array<unknown>) => void;
    dataLayer?: Array<Record<string, unknown>>;
  }
}
