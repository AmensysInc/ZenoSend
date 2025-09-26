// src/api.ts
const API_BASE = '/api';
const API_KEY = import.meta.env.VITE_API_KEY || 'dev-token-change-me';

type FetchOpts = RequestInit & { json?: any };

// pull JWT from localStorage if present
function authHeader() {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function api(path: string, opts: FetchOpts = {}) {
  const headers: Record<string, string> = {
    'x-api-key': API_KEY,
    ...authHeader(),
    ...(opts.headers as Record<string, string> || {}),
  };

  const url = `${API_BASE}${path}`;

  const hasJson = opts.json !== undefined;
  if (hasJson) headers['Content-Type'] = 'application/json';

  const res = await fetch(url, {
    ...opts,
    headers,
    body: hasJson ? JSON.stringify(opts.json) : opts.body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }

  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json') ? res.json() : res.text();
}

// ---------- AUTH ----------
export const login = (email: string, password: string) =>
  api('/auth/login', { method: 'POST', json: { email, password } });

// ---------- CONTACTS ----------
export type ContactRow = {
  id: number;
  email: string;
  status?: string | null;
  reason?: string | null;
  provider?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  linkedin_url?: string | null;
  owner_email?: string | null;   // <-- admin watermark field
};

export const getContacts = (status?: string, q?: string) => {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (q) params.set('q', q);
  const qs = params.toString();
  return api(`/contacts${qs ? `?${qs}` : ''}`) as Promise<ContactRow[]>;
};

export const createContact = (payload: {
  first_name?: string;
  last_name?: string;
  email: string;
  linkedin_url?: string;
}) => api('/contacts', { method: 'POST', json: payload });

export const uploadCsv = (file: File) => {
  const fd = new FormData();
  fd.append('file', file);
  return api('/contacts/upload', { method: 'POST', body: fd });
};

export const validateBulk = (useSmtp = false) =>
  api('/contacts/validate', { method: 'POST', json: { use_smtp_probe: useSmtp } });

export const validateOne = (email: string, useSmtp = false) =>
  api(`/contacts/validate_one?use_smtp_probe=${useSmtp}`, { method: 'POST', json: { email } }) as Promise<{
    id: number; email: string; status: string; reason?: string | null; provider?: string | null; verdict: string;
  }>;

// ---------- CAMPAIGNS ----------
export const createCampaign = (payload: any) =>
  api('/campaigns', { method: 'POST', json: payload });

export const sendSelected = (campaignId: number, ids: number[]) =>
  api(`/campaigns/${campaignId}/send_selected`, { method: 'POST', json: { contact_ids: ids } });

export const stats = (campaignId: number) =>
  api(`/campaigns/${campaignId}/stats`);

// ---------- QUICK SEND ----------
export const composeSend = (payload: any) =>
  api('/compose/send', { method: 'POST', json: payload });

// ---------- ADMIN · USERS ----------
export type AppUser = { id: number; email: string; role: 'user' | 'admin' };

export const adminListUsers = () =>
  api('/admin/users') as Promise<AppUser[]>;

export const adminCreateUser = (payload: { email: string; password: string; role: 'user' | 'admin' }) =>
  api('/admin/users', { method: 'POST', json: payload }) as Promise<AppUser>;
