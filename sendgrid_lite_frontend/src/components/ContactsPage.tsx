// src/components/ContactsPage.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { ContactRow, createContact, getContacts, validateOne } from '../api';
import { useAuth } from '../auth';

export default function ContactsPage() {
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';

    const [rows, setRows] = useState<ContactRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);

    // create form
    const [fn, setFn] = useState('');
    const [ln, setLn] = useState('');
    const [email, setEmail] = useState('');
    const [linkedin, setLinkedin] = useState('');

    // Always-on SMTP probe (UI shows checked + disabled)
    const useSmtp = true;

    // inline validate result preview (optional)
    const [valBusy, setValBusy] = useState(false);
    const [valResult, setValResult] = useState<{ status: string; reason?: string | null; provider?: string | null } | null>(null);

    // filters/search
    const [status, setStatus] = useState<'all' | 'new' | 'valid' | 'invalid' | 'risky' | 'unknown'>('all');
    const [q, setQ] = useState('');

    async function load() {
        setLoading(true);
        setErr(null);
        try {
            const data = await getContacts(status === 'all' ? undefined : status, q || undefined);
            setRows(data);
        } catch (e: any) {
            setErr(e.message || 'Failed to load contacts');
        } finally {
            setLoading(false);
        }
    }
    useEffect(() => { load(); /* eslint-disable-next-line */ }, []);
    function onRefresh() { load(); }

    // --- Actions ---
    async function onSave(e: React.FormEvent) {
        e.preventDefault();
        setErr(null);
        try {
            if (!email.trim()) throw new Error('Email is required');
            await createContact({
                first_name: fn || undefined,
                last_name: ln || undefined,
                email: email.trim().toLowerCase(),
                linkedin_url: linkedin || undefined
            });
            setFn(''); setLn(''); setEmail(''); setLinkedin(''); setValResult(null);
            await load();
        } catch (e: any) {
            setErr(e.message || 'Failed to create contact');
        }
    }

    // Validate & Save = validateOne (SMTP on) then attach names/link
    async function onValidateAndSave(e: React.FormEvent) {
        e.preventDefault();
        if (!email.trim()) { setErr('Email is required'); return; }
        setErr(null);
        setValBusy(true);
        try {
            const addr = email.trim().toLowerCase();
            const r = await validateOne(addr, useSmtp);
            setValResult({ status: r.status, reason: r.reason ?? null, provider: r.provider ?? null });
            await createContact({
                first_name: fn || undefined,
                last_name: ln || undefined,
                email: addr,
                linkedin_url: linkedin || undefined
            });
            setFn(''); setLn(''); setEmail(''); setLinkedin('');
            await load();
        } catch (e: any) {
            setErr(e.message || 'Validate & Save failed');
        } finally {
            setValBusy(false);
        }
    }

    // Row-level validate/re-validate
    async function validateRow(addr: string) {
        setErr(null);
        setValBusy(true);
        try {
            await validateOne(addr, useSmtp);
            await load();
        } catch (e: any) {
            setErr(e.message || 'Validation failed');
        } finally {
            setValBusy(false);
        }
    }

    const filtered = useMemo(() => rows, [rows]); // server filters applied

    return (
        <div className="container mx-auto p-6 max-w-6xl">
            <div className="card p-4 mb-6">
                <div className="text-lg font-semibold mb-1">Contacts</div>
                <div className="text-sm opacity-70">
                    Create a contact and manage your list. Use <b>Validate &amp; Save</b> for one-click validation
                    (SMTP probe on) or plain <b>Save</b>. You can validate later from each row as well.
                </div>
            </div>

            {/* Create + Validate & Save */}
            <form onSubmit={onSave} className="card p-4 mb-6 space-y-3">
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
                    <input className="input" placeholder="First name" value={fn} onChange={e => setFn(e.target.value)} />
                    <input className="input" placeholder="Last name" value={ln} onChange={e => setLn(e.target.value)} />
                    <input className="input" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
                    <input className="input" placeholder="LinkedIn URL" value={linkedin} onChange={e => setLinkedin(e.target.value)} />
                </div>

                <div className="flex items-center gap-3">
                    <button type="submit" className="btn">Save</button>
                    <button type="button" onClick={onValidateAndSave} className="btn" disabled={valBusy}>
                        {valBusy ? 'Validating…' : 'Validate & Save'}
                    </button>

                    <label className="flex items-center gap-2 text-sm opacity-80">
                        <input type="checkbox" checked={useSmtp} disabled />
                        Use SMTP probe (always on)
                    </label>

                    {valResult && (
                        <span className={`ml-2 text-sm px-2 py-[2px] rounded ${valResult.status === 'valid' ? 'bg-emerald-600/20 text-emerald-300' :
                            valResult.status === 'risky' ? 'bg-amber-500/20 text-amber-300' :
                                valResult.status === 'invalid' ? 'bg-red-600/20 text-red-300' :
                                    'bg-slate-600/20 text-slate-300'
                            }`}>
                            {valResult.status}
                            {valResult.provider ? ` · ${valResult.provider}` : ''}
                            {valResult.reason ? ` · ${valResult.reason}` : ''}
                        </span>
                    )}
                </div>

                {err && <div className="text-red-400 text-sm">{err}</div>}
            </form>

            {/* Filters + search */}
            <div className="card p-4 mb-4">
                <div className="flex flex-col md:flex-row items-start md:items-end gap-3">
                    <div>
                        <div className="text-xs opacity-70 mb-1">Filter by status:</div>
                        <select className="input" value={status} onChange={e => setStatus(e.target.value as any)}>
                            <option value="all">all</option>
                            <option value="new">new</option>
                            <option value="valid">valid</option>
                            <option value="invalid">invalid</option>
                            <option value="risky">risky</option>
                            <option value="unknown">unknown</option>
                        </select>
                    </div>
                    <div className="grow md:max-w-md">
                        <div className="text-xs opacity-70 mb-1">Search name/email/linkedin:</div>
                        <div className="flex gap-2">
                            <input className="input w-full" value={q} onChange={e => setQ(e.target.value)} placeholder="e.g. emily@, LinkedIn URL…" />
                            <button type="button" className="btn" onClick={load}>Search</button>
                            <button type="button" className="btn" onClick={() => { setQ(''); setStatus('all'); load(); }}>Refresh</button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="card p-0 overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-slate-900/60">
                        <tr>
                            <th className="px-4 py-3 text-left">First</th>
                            <th className="px-4 py-3 text-left">Last</th>
                            <th className="px-4 py-3 text-left">Email</th>
                            <th className="px-4 py-3 text-left">LinkedIn</th>
                            <th className="px-4 py-3 text-left">Status</th>
                            <th className="px-4 py-3 text-left">Reason</th>
                            <th className="px-4 py-3 text-left">Provider</th>
                            {isAdmin && <th className="px-4 py-3 text-left">Added by</th>}
                            <th className="px-4 py-3 text-left">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && (
                            <tr><td className="px-4 py-4 text-slate-400" colSpan={isAdmin ? 9 : 8}>Loading…</td></tr>
                        )}
                        {!loading && filtered.length === 0 && (
                            <tr><td className="px-4 py-4 text-slate-400" colSpan={isAdmin ? 9 : 8}>No contacts.</td></tr>
                        )}
                        {filtered.map(r => {
                            const needsValidation = !r.status || r.status === 'new' || r.status === 'unknown' || r.status === 'risky';
                            return (
                                <tr key={r.id} className="border-t border-slate-800/60">
                                    <td className="px-4 py-3">{r.first_name || ''}</td>
                                    <td className="px-4 py-3">{r.last_name || ''}</td>
                                    <td className="px-4 py-3">
                                        <div className="font-mono">{r.email}</div>
                                        {isAdmin && r.owner_email && (
                                            <div className="text-[11px] mt-0.5 opacity-70">Added by {r.owner_email}</div>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 truncate max-w-[240px]">
                                        {r.linkedin_url ? (
                                            <a className="underline opacity-80" href={r.linkedin_url} target="_blank" rel="noreferrer">
                                                {r.linkedin_url}
                                            </a>
                                        ) : ''}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`px-2 py-[2px] rounded ${r.status === 'valid' ? 'bg-emerald-600/20 text-emerald-300' :
                                            r.status === 'risky' ? 'bg-amber-500/20 text-amber-300' :
                                                r.status === 'invalid' ? 'bg-red-600/20 text-red-300' :
                                                    'bg-slate-600/20 text-slate-300'
                                            }`}>
                                            {r.status || '—'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">{r.reason || ''}</td>
                                    <td className="px-4 py-3">{r.provider || ''}</td>
                                    {isAdmin && <td className="px-4 py-3">{r.owner_email || ''}</td>}
                                    <td className="px-4 py-3">
                                        {needsValidation ? (
                                            <button
                                                className="btn btn-small"
                                                onClick={() => validateRow(r.email)}
                                                disabled={valBusy}
                                                title="Validate with SMTP probe"
                                            >
                                                Validate
                                            </button>
                                        ) : <span className="text-xs opacity-50">—</span>}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
