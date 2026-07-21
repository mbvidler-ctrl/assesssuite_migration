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

// The shim serves the frontend and the API from a single origin in production,
// so window.location.origin is the correct backend URL for tunnel and hosted
// deployments. Prefer an explicit ?server_url= or a non-localhost build-time
// VITE_BASE44_BACKEND_URL; otherwise, or when a localhost value was baked into a
// build that is now served from a remote host, fall back to the current origin.
// This removes the rebuild-per-URL dependency without breaking local dev.
const resolveServerUrl = () => {
	const explicit = getAppParamValue("server_url", { defaultValue: import.meta.env.VITE_BASE44_BACKEND_URL });
	if (isNode) return explicit;
	const origin = window.location.origin;
	if (!explicit) return origin;
	// A localhost backend that was baked or stored from a different local workflow
	// must not override the origin actually serving the app. Two cases:
	//  - remote origin (deployed / tunnel) with a localhost value baked in; and
	//  - the single-origin shim served from one localhost port (e.g. :8787) while a
	//    stale value points at another localhost port (e.g. the :5173 vite-dev proxy).
	// In both, prefer the current origin. When origin and explicit are the same
	// localhost port (the vite-dev-proxy workflow), explicit is kept.
	const norm = (u) => (u || "").replace(/\/$/, "");
	if (isLocalhostOrigin(explicit) && norm(explicit) !== norm(origin)) return origin;
	return explicit;
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
