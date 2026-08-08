const runtimeConfig = window.__APP_CONFIG__ || {};
const API_BASE_URL = String(
  runtimeConfig.API_BASE_URL || import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001/api/v1'
).replace(/\/+$/, '');
const TENANT_SLUG = String(
  runtimeConfig.TENANT_SLUG || import.meta.env.VITE_TENANT_SLUG || 'example-campus'
).trim();

const TOKEN_KEY = 'spotfix.web.token';
const REFRESH_TOKEN_KEY = 'spotfix.web.refresh';
const TOKEN_TYPE_KEY = 'spotfix.web.tokenType';
const AUTH_KIND_KEY = 'spotfix.web.authKind';

function readToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(TOKEN_TYPE_KEY);
  localStorage.removeItem(AUTH_KIND_KEY);
}

function storeSession(envelope, authKind) {
  if (!envelope?.accessToken) return;
  localStorage.setItem(TOKEN_KEY, envelope.accessToken);
  localStorage.setItem(TOKEN_TYPE_KEY, envelope.tokenType || 'Bearer');
  localStorage.setItem(AUTH_KIND_KEY, authKind);

  if (envelope.refreshToken) {
    localStorage.setItem(REFRESH_TOKEN_KEY, envelope.refreshToken);
  } else {
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  }
}

async function parseJson(response) {
  const raw = await response.text();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return { message: raw };
  }
}

function extractErrorMessage(payload, fallback) {
  if (!payload) return fallback;
  if (typeof payload?.error === 'object' && payload.error?.message) return payload.error.message;
  if (typeof payload?.error === 'string') return payload.error;
  if (typeof payload?.message === 'string') return payload.message;
  return fallback;
}

async function request(path, { method = 'GET', body, auth = false, tenant = false } = {}) {
  const headers = { Accept: 'application/json' };

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (tenant && TENANT_SLUG) {
    headers['X-Tenant-Slug'] = TENANT_SLUG;
  }

  if (auth) {
    const token = readToken();
    if (!token) {
      throw new Error('Session missing. Please sign in again.');
    }
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const payload = await parseJson(response);

  if (!response.ok) {
    if (response.status === 401 && auth) {
      clearSession();
      throw new Error('Session expired. Please sign in again.');
    }

    throw new Error(extractErrorMessage(payload, `Request failed (${response.status})`));
  }

  return payload;
}

function normalizeUserFromMe(me) {
  return {
    id: me?.profile?._id || me?.auth?.userId || '',
    name: me?.profile?.name || me?.auth?.name || 'Unknown',
    role: me?.auth?.role || me?.profile?.role || 'public',
    email: me?.profile?.email || '',
    idNumber: me?.profile?.idNumber || '',
    phone: me?.profile?.phone || '',
    workLocation: me?.profile?.workLocation || '',
    permissions: Array.isArray(me?.permissions) ? me.permissions : [],
    authType: me?.auth?.authType || localStorage.getItem(AUTH_KIND_KEY) || 'user',
  };
}

export async function bootstrapSession() {
  const token = readToken();
  if (!token) return null;

  const me = await request('/me', { auth: true });
  return normalizeUserFromMe(me);
}

export async function registerAndLogin({ name, email, idNumber, phone, password }) {
  const auth = await request('/users/register', {
    method: 'POST',
    tenant: true,
    body: { name, email, idNumber, phone, password, role: 'public' },
  });

  storeSession(auth, 'user');
  const me = await request('/me', { auth: true });
  return normalizeUserFromMe(me);
}

export async function login({ identifier, password }) {
  const trimmed = identifier.trim();
  const auth = await request('/users/login', {
    method: 'POST',
    tenant: true,
    body: trimmed.includes('@')
      ? { email: trimmed.toLowerCase(), password }
      : { idNumber: trimmed, password },
  });

  storeSession(auth, 'user');
  const me = await request('/me', { auth: true });
  return normalizeUserFromMe(me);
}

export async function loginWithGoogle(idToken) {
  const auth = await request('/users/google', {
    method: 'POST',
    tenant: true,
    body: { idToken },
  });

  storeSession(auth, 'user');
  const me = await request('/me', { auth: true });
  return normalizeUserFromMe(me);
}

export async function loginMaster({ username, password }) {
  const auth = await request('/master/login', {
    method: 'POST',
    tenant: true,
    body: { username, password },
  });

  storeSession(auth, 'master');
  const me = await request('/me', { auth: true });
  return normalizeUserFromMe(me);
}

export async function logout() {
  const authKind = localStorage.getItem(AUTH_KIND_KEY);
  try {
    await request(authKind === 'master' ? '/master/logout' : '/users/logout', {
      method: 'POST',
      auth: true,
    });
  } finally {
    clearSession();
  }
}

export async function getMyReports(userId) {
  const reports = await request(`/reports/user/${encodeURIComponent(userId)}`, { auth: true });
  return Array.isArray(reports) ? reports : [];
}

export async function listReports() {
  const reports = await request('/reports', { auth: true });
  return Array.isArray(reports) ? reports : [];
}

export async function getPublicStatusBoard() {
  return request('/reports/public/status', { tenant: true });
}

export async function listUsers() {
  const users = await request('/users', { auth: true });
  return Array.isArray(users) ? users : [];
}

export async function provisionUser(payload) {
  return request('/users/provision', {
    method: 'POST',
    auth: true,
    body: {
      name: payload.name,
      email: payload.email || undefined,
      idNumber: payload.idNumber,
      phone: payload.phone,
      workLocation: payload.workLocation || undefined,
      password: payload.password,
      role: payload.role,
    },
  });
}

export async function listCleaners(query = {}) {
  const params = new URLSearchParams();
  if (query.supervisorId) params.set('supervisorId', query.supervisorId);
  if (query.workLocation) params.set('workLocation', query.workLocation);
  const suffix = params.toString() ? `?${params.toString()}` : '';
  const cleaners = await request(`/cleaners${suffix}`, { auth: true });
  return Array.isArray(cleaners) ? cleaners : [];
}

export async function createCleaner(body) {
  return request('/cleaners', {
    method: 'POST',
    auth: true,
    body: {
      name: body.name,
      workId: body.workId,
      phone: body.phone,
      workLocation: body.workLocation,
      supervisorId: body.supervisorId,
    },
  });
}

export async function assignCleaner(cleanerId, reportId) {
  return request(`/cleaners/${encodeURIComponent(cleanerId)}/assign`, {
    method: 'POST',
    auth: true,
    body: { reportId },
  });
}

export async function updateReport(reportId, body) {
  return request(`/reports/${encodeURIComponent(reportId)}`, {
    method: 'PUT',
    auth: true,
    body,
  });
}

export async function createReport(payload) {
  return request('/reports', {
    method: 'POST',
    auth: true,
    body: {
      id: payload.id,
      category: payload.category,
      location: payload.location,
      coordinates: payload.coordinates,
      details: payload.details,
      priority: payload.priority,
      reporterPhone: payload.reporterPhone,
      evidencePhoto: payload.evidencePhoto,
      photos: payload.photos,
      photoTimestamp: payload.photoTimestamp,
      status: 'Reported',
      timestamp: new Date().toISOString(),
    },
  });
}
