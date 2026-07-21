const isNode = typeof window === 'undefined';
const windowObj = isNode ? { localStorage: new Map() } : window;
const storage = windowObj.localStorage;

const toSnakeCase = (str) => {
	return str.replace(/([A-Z])/g, '_$1').toLowerCase();
}

const getAppParamValue = (paramName, { defaultValue = undefined, removeFromUrl = false } = {}) => {
	if (isNode) {
		return defaultValue;
	}
	const storageKey = `base44_${toSnakeCase(paramName)}`;
	const urlParams = new URLSearchParams(window.location.search);
	const searchParam = urlParams.get(paramName);
	if (removeFromUrl) {
		urlParams.delete(paramName);
		const newUrl = `${window.location.pathname}${urlParams.toString() ? `?${urlParams.toString()}` : ""
			}${window.location.hash}`;
		window.history.replaceState({}, document.title, newUrl);
	}
	if (searchParam) {
		storage.setItem(storageKey, searchParam);
		return searchParam;
	}
	if (defaultValue) {
		storage.setItem(storageKey, defaultValue);
		return defaultValue;
	}
	const storedValue = storage.getItem(storageKey);
	if (storedValue) {
		return storedValue;
	}
	return null;
}

const isLocalhostOrigin = (url) => /^https?:\/\/(localhost|127\.0\.0\.1)(:|$|\/)/.test(url || "");

// The shim serves the frontend and API from one origin in production. Never
// accept a browser URL/localStorage override for the API origin: the SDK adds
// the session bearer token to API requests, so a caller-controlled server_url
// would be a persistent token-exfiltration primitive. The only cross-port
// exception is an explicitly built localhost backend while the page itself is
// also on localhost, preserving the Vite development workflow.
const resolveServerUrl = () => {
	const configured = import.meta.env.VITE_BASE44_BACKEND_URL;
	if (isNode) return configured;
	const origin = window.location.origin;
	window.localStorage.removeItem('base44_server_url');
	if (isLocalhostOrigin(origin) && isLocalhostOrigin(configured)) return configured;
	return origin;
}

const getAppParams = () => {
	return {
		appId: getAppParamValue("app_id", {
			defaultValue: import.meta.env.VITE_BASE44_APP_ID || "local-assesssuite",
		}),
		serverUrl: resolveServerUrl(),
		token: getAppParamValue("access_token", { removeFromUrl: true }),
		fromUrl: getAppParamValue("from_url", { defaultValue: window.location.href }),
		functionsVersion: getAppParamValue("functions_version"),
	}
}


export const appParams = {
	...getAppParams()
}
