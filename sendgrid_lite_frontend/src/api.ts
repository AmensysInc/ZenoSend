const API_BASE = import.meta.env.VITE_API_BASE || '/api'
const API_KEY = import.meta.env.VITE_API_KEY || 'dev-token-change-me'

type FetchOpts = RequestInit & { json?: any }

export async function api(path: string, opts: FetchOpts = {}) {
  const headers: Record<string, string> = { 'x-api-key': API_KEY, ...(opts.headers as Record<string, string> || {}) }
  const url = `${API_BASE}${path}`
  if (opts.json !== undefined) headers['Content-Type'] = 'application/json'
  const res = await fetch(url, { ...opts, headers, body: opts.json !== undefined ? JSON.stringify(opts.json) : opts.body })
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`)
  const ct = res.headers.get('content-type') || ''
  return ct.includes('application/json') ? res.json() : res.text()
}

// status + optional search q (backward compatible)
export const getContacts = (status?: string, q?: string) => {
  const params = new URLSearchParams()
  if (status) params.set('status', status)
  if (q) params.set('q', q)
  const qs = params.toString()
  return api(`/contacts${qs ? `?${qs}` : ''}`)
}

export const createContact = (payload: { first_name?: string; last_name?: string; email: string; linkedin_url?: string }) =>
  api('/contacts', { method: 'POST', json: payload })

export const uploadCsv = (file: File) => { const fd = new FormData(); fd.append('file', file); return api('/contacts/upload', { method: 'POST', body: fd }) }
export const validateBulk = (useSmtp = false) => api('/contacts/validate', { method: 'POST', json: { use_smtp_probe: useSmtp } })
export const validateOne = (email: string, useSmtp = false) => api(`/contacts/validate_one?use_smtp_probe=${useSmtp}`, { method: 'POST', json: { email } })
export const createCampaign = (payload: any) => api('/campaigns', { method: 'POST', json: payload })
export const sendSelected = (campaignId: number, ids: number[]) => api(`/campaigns/${campaignId}/send_selected`, { method: 'POST', json: { contact_ids: ids } })
export const stats = (campaignId: number) => api(`/campaigns/${campaignId}/stats`)  // fixed id var

// NEW quick-send endpoint
export const composeSend = (payload: any) => api('/compose/send', { method: 'POST', json: payload })
