# Documentation Implementation Plan

## Overview

Rewrite all docs for `@uabcodus/consent` — a headless consent management library. The docs use
**Astro + Starlight** with React 19 and Tailwind v4. Tone: friendly, developer-to-developer,
TanStack-inspired structure.

---

## Files to Create/Update (18 total)

### 1. `apps/docs/astro.config.mjs` — Update sidebar and social link

Replace the entire sidebar with:

```js
sidebar: [
  {
    label: "Getting Started",
    items: [
      { label: "Installation", slug: "guides/installation" },
      { label: "Quick Start", slug: "guides/quick-start" },
    ],
  },
  {
    label: "Core Concepts",
    collapsed: true,
    items: [
      { label: "How It Works", slug: "guides/how-it-works" },
      { label: "React Integration", slug: "guides/react" },
      { label: "Managing Scripts", slug: "guides/script-management" },
      { label: "Callbacks & Events", slug: "guides/callbacks-events" },
    ],
  },
  {
    label: "Advanced",
    collapsed: true,
    items: [
      { label: "Cookie & Storage", slug: "guides/cookie-storage" },
      { label: "Revision Management", slug: "guides/revision-management" },
      { label: "Presets", slug: "guides/presets" },
      { label: "Google Consent Mode", slug: "guides/google-consent-mode" },
    ],
  },
  {
    label: "UI Components",
    collapsed: true,
    items: [{ label: "Registry Components", slug: "guides/ui-components" }],
  },
  {
    label: "Examples",
    items: [{ label: "Playground", slug: "guides/playground" }],
  },
  {
    label: "API Reference",
    items: [{ autogenerate: { directory: "reference" } }],
  },
],
```

Also change `social` GitHub link to `https://github.com/uabcodus/consent`.

---

### 2. `apps/docs/src/content/docs/index.mdx` — Homepage (rewrite)

Splash page with:

- Hero tagline: "Headless consent management that works with any framework."
- Quick code snippet showing `createConsent({ categories: { necessary: { readOnly: true }, analytics: {} } })` + `consent.accept("all")`
- Action buttons: "Get Started" → `/guides/installation/`, "View on GitHub" → repo
- Feature cards: Framework agnostic, Type-safe, Composable, Production ready
- "What you get" bullet list

---

### 3. `apps/docs/src/content/docs/guides/installation.md`

````md
---
title: Installation
description: Install @uabcodus/consent in your project.
---

import { Tabs, TabItem } from "@astrojs/starlight/components";

## Package manager

<Tabs>
  <TabItem label="npm">
    ```sh
    npm install @uabcodus/consent
    ```
  </TabItem>
  <TabItem label="pnpm">
    ```sh
    pnpm add @uabcodus/consent
    ```
  </TabItem>
  <TabItem label="yarn">
    ```sh
    yarn add @uabcodus/consent
    ```
  </TabItem>
</Tabs>

## Package exports

The library has two entry points:

| Import                    | Description                                                                                     |
| ------------------------- | ----------------------------------------------------------------------------------------------- |
| `@uabcodus/consent/core`  | Framework-agnostic core. Works in any JS/TS environment.                                        |
| `@uabcodus/consent/react` | React bindings: `ConsentProvider` + `useConsent` hook. (`react` is an optional peer dependency) |

## Requirements

- **ESM only** — `"type": "module"` or a bundler that handles ESM.
- **TypeScript** — fully typed, but works in plain JavaScript too.
- **React** (optional) — `^18.0.0` or `^19.0.0` if you want the React bindings.

## TypeScript

Types are included. If you're using TypeScript, everything is inferred from your category configuration — no extra type annotations needed.

```ts
const consent = createConsent({
  categories: {
    analytics: {},
    marketing: {},
  } as const,
});
// consent.accept() is now typed with "analytics" | "marketing" | "all" | "necessary"
```
````

````

---

### 4. `apps/docs/src/content/docs/guides/quick-start.md`

```md
---
title: Quick Start
description: Your first consent instance in under 5 minutes.
---

import { Tabs, TabItem } from "@astrojs/starlight/components";

## Core (vanilla JS)

```ts
import { createConsent } from "@uabcodus/consent/core";

const consent = createConsent({
  categories: {
    necessary: {
      readOnly: true,      // Always accepted — user can't toggle it off
    },
    analytics: {
      services: {
        googleAnalytics: {
          onAccept: () => {
            // Fire your GA initialization here
            console.log("GA enabled");
          },
          onReject: () => {
            // Tear it down if previously enabled
            console.log("GA disabled");
          },
        },
      },
    },
    marketing: {},
  },
});

// Check if consent is already valid
if (consent.state.valid) {
  // Consent was given previously — fire your tracking
}

// Show a banner, then call:
consent.accept("all");

// Or accept selectively:
consent.accept(["analytics"]);
consent.reject("marketing");

// Check what's accepted:
consent.acceptedCategory("analytics"); // true
````

## React

```tsx
import { ConsentProvider, useConsent } from "@uabcodus/consent/react";

function App() {
  return (
    <ConsentProvider
      options={{
        categories: {
          necessary: { readOnly: true },
          analytics: {},
          marketing: {},
        },
      }}
    >
      <ConsentBanner />
    </ConsentProvider>
  );
}

function ConsentBanner() {
  const consent = useConsent();

  if (consent.state.valid) return null;

  return (
    <div>
      <button onClick={() => consent.accept("all")}>Accept All</button>
      <button onClick={() => consent.accept("necessary")}>Necessary Only</button>
    </div>
  );
}
```

## Read the state

The `consent.state` object gives you everything:

```ts
consent.state.valid; // boolean — is consent given?
consent.state.skipped; // boolean — was consent skipped (bot)?
consent.state.mode; // "opt-in" | "opt-out"
consent.state.acceptType; // "all" | "necessary" | "custom"
consent.state.categories; // { [name]: { accepted: boolean; readOnly: boolean } }
consent.state.services; // { [category]: { [service]: boolean } }
consent.state.cookie; // CookieValue | null
```

## Next steps

- [How It Works →](/guides/how-it-works/) — deep dive into categories, services, and modes
- [React Integration →](/guides/react/) — patterns for React apps
- [Playground →](/playground/) — try it live

````

---

### 5. `apps/docs/src/content/docs/guides/how-it-works.md`

```md
---
title: How It Works
description: Consent modes, categories, services, and the consent lifecycle.
---

## Consent modes

The library supports two modes:

| Mode | Behavior |
|---|---|
| `opt-in` (default) | Nothing is accepted until the user explicitly gives consent. Only `readOnly` categories are pre-accepted. |
| `opt-out` | All categories with `enabled: true` are accepted by default. The user can opt out by rejecting them. |

```ts
createConsent({
  mode: "opt-out",  // User must actively opt out
  categories: {
    analytics: { enabled: true },  // Pre-accepted
    marketing: {},                 // Pre-accepted in opt-out mode
    necessary: { readOnly: true }, // Always accepted
  },
});
````

## Categories

Categories group related tracking purposes. Each category can be accepted or rejected independently.

```ts
createConsent({
  categories: {
    necessary: {
      readOnly: true, // Can never be toggled off
    },
    analytics: {
      autoClear: {
        // Erase cookies when rejected
        reloadPage: false,
        cookies: [{ name: "_ga", path: "/" }, { name: /^_ga_/ }],
      },
    },
  },
});
```

### Category options

| Option      | Type                            | Description                                                                       |
| ----------- | ------------------------------- | --------------------------------------------------------------------------------- |
| `readOnly`  | `boolean`                       | If `true`, the category is always accepted and the user can't toggle it off.      |
| `enabled`   | `boolean`                       | If `true`, the category is accepted by default (only relevant in `opt-out` mode). |
| `autoClear` | `{ reloadPage?, cookies? }`     | Auto-erase matching cookies when the category is rejected.                        |
| `services`  | `Record<string, ServiceConfig>` | Per-service sub-toggles with `onAccept`/`onReject` callbacks.                     |

## Services

Services live inside categories and give you even finer control. A category like "analytics" might
contain `googleAnalytics` and `plausible` services that can be individually toggled.

```ts
analytics: {
  services: {
    googleAnalytics: {
      cookies: [{ name: "_ga" }],
      onAccept: () => gtag("consent", "update", { analytics_storage: "granted" }),
      onReject: () => gtag("consent", "update", { analytics_storage: "denied" }),
    },
    plausible: {
      onAccept: () => { /* inject Plausible script */ },
    },
  },
},
```

Services inherit their parent category's accepted state by default. You can override
per-service toggles via `acceptService` / `rejectService`.

## The consent lifecycle

```
createConsent()
    │
    ├─ Bot detected?  →  state.skipped = true, consent skipped
    │
    ├─ Valid cookie exists?  →  state.valid = true, restore from cookie
    │
    ├─ Opt-out mode?  →  all non-readOnly categories with enabled:true are pre-accepted
    │
    └─ Opt-in mode?  →  only readOnly categories are accepted, await user action
```

On first consent, a UUID-based `consentId` and timestamp are generated and persisted.
Subsequent page loads restore consent from the cookie.

## The cookie

Consent is persisted to a cookie (or localStorage). The cookie JSON looks like:

```json
{
  "categories": ["necessary", "analytics"],
  "services": { "analytics": ["googleAnalytics"] },
  "revision": 0,
  "data": {},
  "consentId": "a1b2c3d4-...",
  "consentTimestamp": "2025-01-01T00:00:00.000Z",
  "lastConsentTimestamp": "2025-01-01T00:00:00.000Z",
  "languageCode": "en"
}
```

Everything in the library is **reactive**. Call `consent.accept()` and the cookie is written,
scripts are managed, cookies are auto-cleared, service callbacks fire, and all subscribers are
notified — all from that one call.

````

---

### 6. `apps/docs/src/content/docs/guides/react.md`

Detailed React integration guide covering:
- `ConsentProvider` — where to place it, props, SSR considerations
- `useConsent` — auto-subscribes to state changes, triggers re-renders, returns the `ConsentInstance`
- Patterns: rendering banners conditionally, preferences panels, state-driven UI
- TypeScript: generic `ConsentProvider<typeof config>` for inferred types
- Multiple providers (if you need separate consent scopes)
- SSR/hydration: how `initialCookie` works

---

### 7. `apps/docs/src/content/docs/guides/script-management.md`

- `manageScripts` option (default: `false` — must opt in)
- `data-category="analytics"` blocks script until category accepted
- `data-service="ga4"` for per-service blocking
- `data-category="!analytics"` runs script when category is *rejected* (prefix `!`)
- `type="text/plain"` prevents browser execution before consent
- External scripts (`src`) load sequentially
- How script revival works (clone, remove data-category, inject)
- Example: Google Analytics inline + external scripts

---

### 8. `apps/docs/src/content/docs/guides/callbacks-events.md`

- `onFirstConsent` — fires once on very first consent action
- `onConsent` — fires on first consent AND every page load when consent is valid
- `onChange` — fires when categories/services change, includes `changedCategories` and `changedServices`
- `subscribe(listener)` — reactive store subscription, returns unsubscribe
- `on(event, listener)` / `off(event, listener)` — custom event emitter
- Built-in events: `"firstConsent"`, `"consent"`, `"change"`
- Patterns: logging consent to backend, syncing with analytics

---

### 9. `apps/docs/src/content/docs/guides/cookie-storage.md`

- Default cookie config and how to override
- All cookie options: `name`, `expiresAfterDays` (can be a function), `domain`, `path`, `secure`, `sameSite`
- `useLocalStorage` for localStorage instead of cookies
- `getCookie(field?)` to read cookie data
- `setCookieData({ value, mode })` for custom data persistence
- `eraseCookies(cookies, path?, domain?)` for manual cookie erasure
- Subdomain handling, path matching, RegExp matching

---

### 10. `apps/docs/src/content/docs/guides/revision-management.md`

- `revision` option — increment to force re-consent
- How the library detects mismatched revisions
- What happens: consent becomes invalid, banner re-appears
- Example: updating from v1 to v2 of your privacy policy

---

### 11. `apps/docs/src/content/docs/guides/presets.md`

- What presets are — reusable config bundles
- `googleConsentMode` preset — 4 categories (necessary, analytics, advertisement, functionality) with appropriate `readOnly`, services, and `autoClear` cookie patterns
- `syncGtagConsent(consent)` — returns unsubscribe function, calls `gtag("consent", "update", ...)` on every change
- Creating custom presets — merge behavior (categories union, services merge, user takes priority)
- Example: company-wide preset shared across projects

---

### 12. `apps/docs/src/content/docs/guides/google-consent-mode.md`

Full walkthrough of setting up Google Consent Mode v2:
- Install the library
- Use the built-in `googleConsentMode` preset
- Call `syncGtagConsent(consent)` to keep gtag in sync
- How the mapping works (category → GCM service)
- Full code example with Google Tag Manager
- Testing your setup

---

### 13. `apps/docs/src/content/docs/guides/ui-components.md`

- Overview of the 4 registry components (shadcn/ui style — you copy, you own)
- `ConsentBanner` — fixed banner with Accept All / Necessary Only / Close
- `ConsentPanel` — preferences dialog with per-category toggles, service sub-toggles, cookie tables
- `ConsentTable` — read-only cookie details display
- `ConsentToggle` — labelled toggle switch
- How to install via CLI or manual copy from `packages/consent/registry/default/`
- Dependencies needed (button, card, dialog, switch, label, separator, table from shadcn/ui)
- Customizing: style overrides, behavior modification

---

### 14. `apps/docs/src/content/docs/guides/playground.md`

A short page linking to the interactive playground at `/playground` with a description of each demo.

---

### 15. `apps/docs/src/content/docs/reference/core.md`

Full API reference for the core module. Covers:

**Exports:**
- `createConsent(userConfig)` — factory function
- `parseConsentCookie(cookieString)` — decode and validate a cookie string
- `isBot()` — detect bots/crawlers
- `googleConsentMode` — built-in preset constant
- `syncGtagConsent(consent)` — GCM sync helper

**`ConsentInstance` methods** (full signature, description, example for each):
- `.state` (readonly property)
- `.accept(categories, excludedCategories?)`
- `.reject(categories)`
- `.acceptedCategory(category)`
- `.acceptService(service, category)`
- `.rejectService(service, category)`
- `.acceptedService(service, category)`
- `.eraseCookies(cookies, path?, domain?)`
- `.getCookie(field?)`
- `.setCookieData({ value, mode })`
- `.getConfig(field?)`
- `.validConsent()`
- `.loadScript(src, attrs?)`
- `.reset(deleteCookie?)`
- `.subscribe(listener)`
- `.on(event, listener)`
- `.off(event, listener)`
- `.destroy()`

**`ConsentConfig` full reference** — every option with type, default, description.

---

### 16. `apps/docs/src/content/docs/reference/react.md`

```md
---
title: React API
description: Reference for ConsentProvider and useConsent.
---

## `ConsentProvider`

```tsx
function ConsentProvider<TCategories>(props: {
  options: ConsentConfig<TCategories>;
  children: React.ReactNode;
}): React.ReactElement
````

Creates a `ConsentInstance` and provides it via React context. Place it high in your component
tree — typically wrapping your entire app.

The instance is created once (via `useRef`) and persists across re-renders.

## `useConsent`

```ts
function useConsent(): ConsentInstance<Record<string, CategoryConfig>>;
```

Returns the consent instance from the nearest `ConsentProvider`. Automatically subscribes to
state changes and re-renders your component whenever the consent state updates.

Throws if called outside a `ConsentProvider`.

```

---

### 17. `apps/docs/src/content/docs/reference/types.md`

All TypeScript types with full declarations and descriptions:

- `ConsentMode`
- `CookieItem`
- `ServiceConfig`
- `CategoryConfig`
- `CookieConfig`
- `AcceptType`
- `CookieValue`
- `CookieChange`
- `ConsentCallbacks`
- `ConsentState`
- `ConsentConfig`
- `ConsentInstance`
- Generic helpers: `CategoryNames`, `CategoryAcceptArg`, `ServiceNames`, `ServiceAcceptArg`

---

### 18. Delete stale files

- `apps/docs/src/content/docs/guides/example.md`
- `apps/docs/src/content/docs/reference/example.md`

---

## Execution Order

1. Delete stale example files
2. Write `astro.config.mjs`
3. Write `index.mdx`
4. Write all 7 guide pages (`installation`, `quick-start`, `how-it-works`, `react`, `script-management`, `callbacks-events`, `cookie-storage`)
5. Write all 4 advanced guide pages (`revision-management`, `presets`, `google-consent-mode`, `ui-components`)
6. Write `guides/playground.md`
7. Write 3 reference pages (`core`, `react`, `types`)
8. Run `pnpm run build` or `astro dev` to verify no build errors
```
