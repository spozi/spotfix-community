// Public monitoring API (API v2, cross-tenant, read-only, no auth).
// Kept separate from lib/api.js, which is bound to the tenant-scoped v1 surface.

const runtimeConfig = window.__APP_CONFIG__ || {};
const API_V1_BASE = String(
  runtimeConfig.API_BASE_URL || import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001/api/v1'
).replace(/\/+$/, '');
const API_V2_BASE = API_V1_BASE.replace(/\/api\/v1$/, '/api/v2');

async function getJson(path) {
  const response = await fetch(`${API_V2_BASE}${path}`, {
    headers: { Accept: 'application/json' },
  });
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  if (!response.ok || !payload?.success) {
    throw new Error(payload?.error?.message || `Request failed (${response.status})`);
  }
  return payload.data;
}

export function fetchMonitorOrgs() {
  return getJson('/monitor/orgs');
}

export function fetchOrgOverview(slug) {
  return getJson(`/monitor/orgs/${encodeURIComponent(slug)}/overview`);
}

export function fetchOrgReports(slug, { status, limit } = {}) {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (limit) params.set('limit', String(limit));
  const query = params.toString();
  return getJson(`/monitor/orgs/${encodeURIComponent(slug)}/reports${query ? `?${query}` : ''}`);
}
