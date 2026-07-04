import type { ServiceConfig } from "./types";

export interface ScriptInfo {
	_script: HTMLScriptElement;
	_categoryName: string;
	_serviceName: string;
	_executed: boolean;
	_runOnDisable: boolean;
}

const SCRIPT_TAG_SELECTOR = "data-category";

export function retrieveScriptElements(
	allCategoryNames: Array<string>,
	existingServices: Record<string, Record<string, ServiceConfig>>,
	scriptType: string
): Array<ScriptInfo> {
	if (typeof document === "undefined") return [];

	const scripts = document.querySelectorAll<HTMLScriptElement>(`script[${SCRIPT_TAG_SELECTOR}]`);

	const scriptInfos: Array<ScriptInfo> = [];

	for (const scriptTag of scripts) {
		let categoryName = scriptTag.getAttribute(SCRIPT_TAG_SELECTOR) ?? "";
		let serviceName = scriptTag.dataset.service ?? "";
		let runOnDisable = false;

		if (categoryName.startsWith("!")) {
			categoryName = categoryName.slice(1);
			runOnDisable = true;
		}
		if (serviceName.startsWith("!")) {
			serviceName = serviceName.slice(1);
			runOnDisable = true;
		}

		if (!allCategoryNames.includes(categoryName)) continue;

		if (!scriptTag.getAttribute("type")) {
			scriptTag.setAttribute("type", scriptType);
		}

		scriptInfos.push({
			_script: scriptTag,
			_executed: false,
			_runOnDisable: runOnDisable,
			_categoryName: categoryName,
			_serviceName: serviceName
		});

		if (serviceName) {
			const services = existingServices[categoryName];
			if (services && !services[serviceName]) {
				services[serviceName] = {};
			}
		}
	}

	return scriptInfos;
}

export function manageExistingScripts(
	allScriptTags: Array<ScriptInfo>,
	acceptedCategories: Array<string>,
	acceptedServices: Record<string, Array<string>>,
	lastChangedCategoryNames: Array<string>,
	lastChangedServices: Record<string, Array<string>>,
	scriptType: string
): void {
	if (typeof document === "undefined") return;

	const loadScriptsRecursive = (index: number) => {
		if (index >= allScriptTags.length) return;

		const info = allScriptTags[index]!;
		if (info._executed) {
			loadScriptsRecursive(index + 1);
			return;
		}

		const currScript = info._script;
		const { _categoryName: cat, _serviceName: svc } = info;

		const catAccepted = acceptedCategories.includes(cat);
		const svcAccepted = svc ? (acceptedServices[cat] ?? []).includes(svc) : false;

		const catJustEnabled = !svc && !info._runOnDisable && catAccepted;
		const svcJustEnabled = svc && !info._runOnDisable && svcAccepted;
		const catJustDisabled =
			!svc && info._runOnDisable && !catAccepted && lastChangedCategoryNames.includes(cat);
		const svcJustDisabled =
			svc && info._runOnDisable && !svcAccepted && (lastChangedServices[cat] ?? []).includes(svc);

		const shouldRun = catJustEnabled || svcJustEnabled || catJustDisabled || svcJustDisabled;

		if (!shouldRun) {
			loadScriptsRecursive(index + 1);
			return;
		}

		info._executed = true;

		const dataType = currScript.getAttribute("type");
		const freshest = currScript.cloneNode(true) as HTMLScriptElement;

		if (freshest.getAttribute("type") === scriptType) {
			freshest.removeAttribute("type");
			if (dataType && dataType !== scriptType) {
				freshest.setAttribute("type", dataType);
			}
		}

		freshest.removeAttribute(SCRIPT_TAG_SELECTOR);
		freshest.removeAttribute("data-service");

		const src = freshest.getAttribute("src");
		const externalScript =
			!!src &&
			(!dataType ||
				dataType === "text/javascript" ||
				dataType === "module" ||
				dataType === scriptType);

		if (externalScript) {
			freshest.addEventListener("load", () => {
				loadScriptsRecursive(index + 1);
			});
			freshest.addEventListener("error", () => {
				loadScriptsRecursive(index + 1);
			});
		}

		currScript.replaceWith(freshest);

		if (externalScript) return;
		loadScriptsRecursive(index + 1);
	};

	loadScriptsRecursive(0);
}

export function runServiceCallbacks(
	allCategoryNames: Array<string>,
	definedServices: Record<string, Record<string, ServiceConfig>>,
	acceptedServices: Record<string, Array<string>>,
	lastChangedServices: Record<string, Array<string>>,
	prevEnabledServices?: Record<string, Array<string>>
): void {
	for (const cat of allCategoryNames) {
		const svcs = lastChangedServices[cat] ?? acceptedServices[cat] ?? [];
		for (const svc of svcs) {
			const service = definedServices[cat]?.[svc];
			if (!service) continue;

			const wasEnabled = prevEnabledServices
				? (prevEnabledServices[cat] ?? []).includes(svc)
				: !!(acceptedServices[cat] ?? []).includes(svc);
			const isEnabled = (acceptedServices[cat] ?? []).includes(svc);

			if (!wasEnabled && isEnabled) {
				if (typeof service.onAccept === "function") service.onAccept();
			} else if (wasEnabled && !isEnabled) {
				if (typeof service.onReject === "function") service.onReject();
			}
		}
	}
}
