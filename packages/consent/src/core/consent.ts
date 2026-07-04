import {
	acceptCategories,
	rejectCategories,
	acceptServiceAction,
	rejectServiceAction
} from "./actions";
import { resolveConfig } from "./config";
import {
	findMatchingCookies,
	getAllCookieNames,
	eraseCookiesHelper,
	isCookiePresent
} from "./cookies";
import { persistAndSync, fireCallbacks } from "./lifecycle";
import { retrieveScriptElements, manageExistingScripts } from "./scripts";
import { createInitialInternalState, buildPublicState } from "./state";
import { createStore } from "./store";
import type {
	CategoryAcceptArg,
	CategoryConfig,
	CategoryNames,
	ConsentConfig,
	ConsentInstance,
	ConsentState,
	CookieValue,
	ServiceAcceptArg,
	ServiceNames
} from "./types";
import { deepCopy, mergeConfigs } from "./utils";

export function createConsent<TCategories extends Record<string, CategoryConfig>>(
	userConfig: ConsentConfig<TCategories>
): ConsentInstance<TCategories> {
	const merged = mergeConfigs(userConfig as ConsentConfig<Record<string, CategoryConfig>>);
	const config = resolveConfig(merged);

	const internal = createInitialInternalState(merged, config);

	if (!internal.skipped && config.manageScripts) {
		internal.allScriptTags = retrieveScriptElements(
			config.categoryNames,
			config.services,
			config.scriptType
		);
	}

	const callbacks = merged.callbacks ?? {};

	const store = createStore(buildPublicState(internal));

	if (!internal.skipped && internal.valid) {
		manageExistingScripts(
			internal.allScriptTags,
			internal.acceptedCategories,
			internal.acceptedServices,
			[],
			{},
			config.scriptType
		);
	} else if (!internal.skipped && config.mode === "opt-out") {
		manageExistingScripts(
			internal.allScriptTags,
			internal.defaultEnabledCategories,
			internal.acceptedServices,
			[],
			{},
			config.scriptType
		);
	}

	if (internal.skipped || internal.valid) {
		const cb = callbacks.onConsent;
		if (cb && internal.cookieContent) cb({ cookie: internal.cookieContent });
	}

	const doPersistAndSync = () => persistAndSync({ internal, store });

	const doFireCallbacks = (event: "firstConsent" | "consent" | "change") =>
		fireCallbacks(event, internal, callbacks, internal.events);

	const instance: ConsentInstance<TCategories> = {
		get state() {
			return store.get();
		},

		accept(acceptArg: CategoryAcceptArg<TCategories>, excludedCategories: Array<string> = []) {
			acceptCategories(acceptArg as string | Array<string>, excludedCategories, {
				internal,
				persistAndSync: doPersistAndSync,
				fireCallbacks: doFireCallbacks
			});
		},

		reject(rejectArg: CategoryAcceptArg<TCategories>) {
			rejectCategories(rejectArg as string | Array<string>, {
				internal,
				persistAndSync: doPersistAndSync,
				fireCallbacks: doFireCallbacks
			});
		},

		acceptedCategory(category: CategoryNames<TCategories>): boolean {
			return internal.acceptedCategories.includes(category);
		},

		acceptService(
			service: ServiceAcceptArg<TCategories, CategoryNames<TCategories>>,
			category: CategoryNames<TCategories>
		) {
			acceptServiceAction(service as string | Array<string>, category as string, {
				internal,
				persistAndSync: doPersistAndSync,
				fireCallbacks: doFireCallbacks
			});
		},

		rejectService(
			service: ServiceAcceptArg<TCategories, CategoryNames<TCategories>>,
			category: CategoryNames<TCategories>
		) {
			rejectServiceAction(service as string | Array<string>, category as string, {
				internal,
				persistAndSync: doPersistAndSync,
				fireCallbacks: doFireCallbacks
			});
		},

		acceptedService(
			service: ServiceNames<TCategories, CategoryNames<TCategories>>,
			category: CategoryNames<TCategories>
		): boolean {
			return (internal.acceptedServices[category as string] ?? []).includes(service as string);
		},

		eraseCookies(
			cookies: string | RegExp | Array<string | RegExp>,
			path?: string,
			domain?: string
		) {
			const allCookies = getAllCookieNames();
			const found: Array<string> = [];

			const match = (c: string | RegExp) => {
				if (typeof c === "string") {
					if (isCookiePresent(c)) {
						found.push(c);
					}
				} else {
					const matched = findMatchingCookies(allCookies, c);
					for (const name of matched) {
						found.push(name);
					}
				}
			};

			if (Array.isArray(cookies)) {
				for (const cookie of cookies) match(cookie);
			} else {
				match(cookies);
			}

			const defaultDomain = typeof location !== "undefined" ? location.hostname : "";
			eraseCookiesHelper(found, domain ?? defaultDomain, path ?? "/");
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
			return deepCopy({ ...config });
		},

		validConsent() {
			return internal.valid;
		},

		loadScript(src: string, attrs?: Record<string, string>): Promise<boolean> {
			return new Promise((resolve) => {
				const timeoutMs = 30000;

				if (typeof document === "undefined") return resolve(false);

				const existing = document.querySelector(`script[src="${src}"]`);
				if (existing) return resolve(true);

				const script = document.createElement("script");
				if (attrs) {
					for (const key of Object.keys(attrs)) {
						script.setAttribute(key, attrs[key]!);
					}
				}

				let settled = false;

				const cleanup = () => {
					script.removeEventListener("load", onLoad);
					script.removeEventListener("error", onError);
					clearTimeout(timer);
				};

				const onLoad = () => {
					if (settled) return;
					settled = true;
					cleanup();
					resolve(true);
				};

				const onError = () => {
					if (settled) return;
					settled = true;
					script.remove();
					cleanup();
					resolve(false);
				};

				const timer = setTimeout(() => {
					if (settled) return;
					settled = true;
					script.remove();
					cleanup();
					resolve(false);
				}, timeoutMs);

				script.addEventListener("load", onLoad);
				script.addEventListener("error", onError);
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
			internal.allScriptTags = [];
		}
	};

	return instance;
}
