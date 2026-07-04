export type ConsentMode = "opt-in" | "opt-out";

export interface StorageAdapter {
	get(): CookieValue;
	set(value: CookieValue): void;
	remove(): void;
}

export interface CookieItem {
	name: string | RegExp;
	path?: string;
	domain?: string;
}

export interface ServiceConfig {
	onAccept?: () => void;
	onReject?: () => void;
	cookies?: Array<CookieItem>;
}

export interface CategoryConfig {
	enabled?: boolean;
	readOnly?: boolean;
	autoClear?: {
		reloadPage?: boolean;
		cookies?: Array<CookieItem>;
	};
	services?: Record<string, ServiceConfig>;
}

export interface CookieConfig {
	name: string;
	expiresAfterDays: number | ((acceptType: AcceptType) => number);
	domain: string;
	path: string;
	secure: boolean;
	sameSite: "Lax" | "Strict" | "None";
}

export type AcceptType = "all" | "custom" | "necessary";

export interface CookieValue {
	categories: Array<string>;
	services: Record<string, Array<string>>;
	revision: number;
	data: unknown;
	consentId: string;
	consentTimestamp: string;
	lastConsentTimestamp?: string;
	expirationTime?: number;
	languageCode?: string;
}

export interface CookieChange {
	cookie: CookieValue;
	changedCategories: Array<string>;
	changedServices: Record<string, Array<string>>;
}

export interface ConsentCallbacks {
	onFirstConsent?: (payload: { cookie: CookieValue }) => void;
	onConsent?: (payload: { cookie: CookieValue }) => void;
	onChange?: (payload: CookieChange) => void;
}

export interface ConsentState {
	valid: boolean;
	skipped: boolean;
	categories: Record<string, { accepted: boolean; readOnly: boolean }>;
	services: Record<string, Record<string, boolean>>;
	cookie: CookieValue | null;
	mode: ConsentMode;
	acceptType: AcceptType;
}

export type CategoryNames<TCategories extends Record<string, CategoryConfig>> = keyof TCategories &
	string;

export type CategoryAcceptArg<TCategories extends Record<string, CategoryConfig>> =
	| "all"
	| "necessary"
	| CategoryNames<TCategories>
	| Array<CategoryNames<TCategories>>;

export type ServiceNames<
	TCategories extends Record<string, CategoryConfig>,
	TCategory extends CategoryNames<TCategories>
> =
	NonNullable<TCategories[TCategory]["services"]> extends Record<infer K, ServiceConfig>
		? K & string
		: never;

export type ServiceAcceptArg<
	TCategories extends Record<string, CategoryConfig>,
	TCategory extends CategoryNames<TCategories>
> = "all" | ServiceNames<TCategories, TCategory> | Array<ServiceNames<TCategories, TCategory>>;

export interface ConsentInstance<TCategories extends Record<string, CategoryConfig>> {
	readonly state: Readonly<ConsentState>;
	accept: (categories: CategoryAcceptArg<TCategories>, excludedCategories?: Array<string>) => void;
	reject: (categories: CategoryAcceptArg<TCategories>) => void;
	acceptedCategory: (category: CategoryNames<TCategories>) => boolean;
	acceptService: (
		service: ServiceAcceptArg<TCategories, CategoryNames<TCategories>>,
		category: CategoryNames<TCategories>
	) => void;
	rejectService: (
		service: ServiceAcceptArg<TCategories, CategoryNames<TCategories>>,
		category: CategoryNames<TCategories>
	) => void;
	acceptedService: (
		service: ServiceNames<TCategories, CategoryNames<TCategories>>,
		category: CategoryNames<TCategories>
	) => boolean;
	eraseCookies: (
		cookies: string | RegExp | Array<string | RegExp>,
		path?: string,
		domain?: string
	) => void;
	getCookie: (field?: string) => unknown;
	setCookieData: (props: { value: unknown; mode: "set" | "update" }) => boolean;
	getConfig: <K extends string>(field?: K) => unknown;
	validConsent: () => boolean;
	loadScript: (src: string, attrs?: Record<string, string>) => Promise<boolean>;
	reset: (deleteCookie?: boolean) => void;
	subscribe: (listener: (state: Readonly<ConsentState>) => void) => () => void;
	on: (event: string, listener: (...args: Array<unknown>) => void) => () => void;
	off: (event: string, listener: (...args: Array<unknown>) => void) => void;
	destroy: () => void;
}

export interface ConsentConfig<TCategories extends Record<string, CategoryConfig>> {
	preset?: Partial<ConsentConfig<Record<string, CategoryConfig>>>;
	mode?: ConsentMode;
	revision?: number;
	hideFromBots?: boolean;
	manageScripts?: boolean;
	scriptType?: string;
	autoClearCookies?: boolean;
	categories: TCategories;
	storage?: StorageAdapter;
	initialCookie?: CookieValue | string | null;
	callbacks?: ConsentCallbacks;
}
