// Thin API client for the demo workspace. All writes are named commands; the
// browser never writes entity rows.

const TOKEN_KEY = 'assesssuite-reporting-demo-token';

export class ApiError extends Error {
  constructor(status, body) {
    super(body?.error || `Request failed (${status})`);
    this.name = 'ApiError';
    this.status = status;
    this.code = body?.code || 'unknown_error';
    this.detail = body?.detail;
  }
}

export function getToken() {
  try {
    return window.sessionStorage.getItem(TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

export function setToken(token) {
  try {
    if (token) window.sessionStorage.setItem(TOKEN_KEY, token);
    else window.sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable: the session lives in memory only */
  }
}

async function request(route, { method = 'GET', body, expect = 'json' } = {}) {
  const token = getToken();
  const response = await fetch(route, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (expect === 'html') {
    const text = await response.text();
    if (!response.ok) {
      let parsed = null;
      try { parsed = JSON.parse(text); } catch { /* not JSON */ }
      throw new ApiError(response.status, parsed);
    }
    return text;
  }
  const text = await response.text();
  let parsed = null;
  try { parsed = text ? JSON.parse(text) : null; } catch { /* not JSON */ }
  if (!response.ok) throw new ApiError(response.status, parsed);
  return parsed;
}

export const api = {
  identities: () => request('/api/demo/identities'),
  openSession: (identityKey) => request('/api/demo/session', { method: 'POST', body: { identity_key: identityKey } }),
  session: () => request('/api/demo/session'),
  reportTypes: () => request('/api/reporting/report-types'),
  episodes: () => request('/api/reporting/episodes'),
  episode: (id) => request(`/api/reporting/episodes/${encodeURIComponent(id)}`),
  requests: ({ status = '', episodeId = '' } = {}) => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (episodeId) params.set('episode_id', episodeId);
    const query = params.toString();
    return request(`/api/reporting/requests${query ? `?${query}` : ''}`);
  },
  createRequest: (payload) => request('/api/reporting/requests', { method: 'POST', body: payload }),
  request: (id) => request(`/api/reporting/requests/${encodeURIComponent(id)}`),
  command: (id, name, payload) => request(`/api/reporting/requests/${encodeURIComponent(id)}/commands/${name}`, { method: 'POST', body: payload }),
  aiDraftSection: (id, payload) => request(`/api/reporting/requests/${encodeURIComponent(id)}/ai/draft-section`, { method: 'POST', body: payload }),
  preview: (id) => request(`/api/reporting/requests/${encodeURIComponent(id)}/preview`, { expect: 'html' }),
  snapshot: (id) => request(`/api/reporting/snapshots/${encodeURIComponent(id)}`),
  snapshotDocument: (id) => request(`/api/reporting/snapshots/${encodeURIComponent(id)}/document`, { expect: 'html' }),
  simulateSourceChange: (payload) => request('/api/demo/simulate-source-change', { method: 'POST', body: payload }),
};

export function newCommandId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
