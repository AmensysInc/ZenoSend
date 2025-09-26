// src/pages/Contacts.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth';
import {
    getContacts,
    createContact,
    validateOne,
    type ContactRow,
} from '../api';

export default function ContactsPage() {
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';

    // table data
    const [rows, setRows] = useState<ContactRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);

    // filters/search
    const [statusFilter, setStatusFilter] = useState<'all' | 'new' | 'unknown' | 'risky' | 'valid' | 'invalid'>('all');
    const [q, setQ] = useState('');

    // create form
    const [fn, setFn] = useState('');
    const [ln, setLn] = useState('');
    const [email, setEmail] = useState('');
    const [li, setLi] = useState('');
    const [checking, setChecking] = useState(false);
    const [checkBadge, setCheckBadge] = useState<string | null>(null);

    async function load() {
        setLoading(true);
        setErr(null);
        try {
            const data = await getContacts(statusFilter === 'all' ? undefined : statusFilter, q || undefined);
            setRows(data);
        } catch (e: any) {
            setErr(e.message || 'Failed to load contacts');
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    async function onSave(e: React.FormEvent) {
        e.preventDefault();
        setErr(null);
        try {
            await createContact({
                first_name: fn || undefined,
                last_name: ln || undefined,
                email,
                linkedin_url: li || undefined,
            });
            setFn(''); setLn(''); setEmail(''); setLi(''); setCheckBadge(null);
            await load();
        } catch (e: any) {
            setErr(e.message || 'Failed to create contact');
        }
    }

    async function onQuickCheck() {
        if (!email) return;
        try {
            setChecking(true);
            const r: any = await validateOne(email, false);
            setCheckBadge(`verdict: ${r.verdict}${r.reason ? ` (${r.reason})` : ''}`);
            await load();
        } catch (e: any) {
            setCheckBadge(`failed: ${e.message || 'error'}`);
        } finally {
            setChecking(false);
        }
    }

    async function validateRow(em: string) {
        try {
            await validateOne(em, false);
            await load();
        } catch {
            // ignore
        }
    }

    const data = useMemo(() => rows, [rows]);

    return (
        <div className="container mx-auto px-4 py-6">
            <div className="mb-6 flex items-center justify-between">
                <h2 className="text-xl font-semibold">Contacts</h2>
                {user && (
                    <div className="text-sm opacity-80">
                        {user.email} · <span className="uppercase">{user.role}</span>
                    </div>
                )}
            </div>

            {/* Create */}
            <form onSubmit={onSave} className="card space-y-3 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <input className="input" placeholder="First name" value={fn} onChange={(e) => setFn(e.target.value)} />
                    <input className="input" placeholder="Last name" value={ln} onChange={(e) => setLn(e.target.value)} />
                    <div className="flex gap-2">
                        <input
                            className="input flex-1"
                            placeholder="Email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                        <button type="button" className="btn" onClick={onQuickCheck} disabled={checking || !email}>
                            {checking ? 'Checking…' : 'Check'}
                        </button>
                    </div>
                    <input className="input" placeholder="LinkedIn URL" value={li} onChange={(e) => setLi(e.target.value)} />
                </div>
                {checkBadge && <div className="text-xs opacity-80">{checkBadge}</div>}
                {err && <div className="text-red-400 text-sm">{err}</div>}
                <button className="btn">Save</button>
            </form>

            {/* Filters */}
            <div className="card mb-4">
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                        <label className="text-sm">Filter by status:</label>
                        <select
                            className="input"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value as any)}
                        >
                            <option value="all">all</option>
                            <option value="new">new</option>
                            <option value="unknown">unknown</option>
                            <option value="risky">risky</option>
                            <option value="valid">valid</option>
                            <option value="invalid">invalid</option>
                        </select>
                    </div>
                    <input
                        className="input flex-1 min-w-[240px]"
                        placeholder="Search name/email/linkedin"
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                    />
                    <button className="btn" onClick={load} type="button">Search</button>
                    <button
                        className="btn"
                        type="button"
                        onClick={() => {
                            setQ('');
                            setStatusFilter('all');
                            load();
                        }}
                    >
                        Refresh
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto card">
                <table className="min-w-full text-sm">
                    <thead className="text-left opacity-70">
                        <tr>
                            <th className="py-2 pr-4">First</th>
                            <th className="py-2 pr-4">Last</th>
                            <th className="py-2 pr-4">Email</th>
                            <th className="py-2 pr-4">LinkedIn</th>
                            <th className="py-2 pr-4">Status</th>
                            <th className="py-2 pr-4">Reason</th>
                            <th className="py-2 pr-4">Provider</th>
                            {isAdmin && <th className="py-2 pr-4">Added by</th>}
                            <th className="py-2 pr-4">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={9} className="py-6 text-center opacity-70">Loading…</td></tr>
                        ) : data.length === 0 ? (
                            <tr><td colSpan={9} className="py-6 text-center opacity-70">No contacts</td></tr>
                        ) : (
                            data.map((r) => (
                                <tr key={r.id} className="border-t border-gray-800">
                                    <td className="py-2 pr-4">{r.first_name || ''}</td>
                                    <td className="py-2 pr-4">{r.last_name || ''}</td>
                                    <td className="py-2 pr-4 font-mono">{r.email}</td>
                                    <td className="py-2 pr-4 text-xs truncate max-w-[240px]">
                                        {r.linkedin_url ? (
                                            <a className="underline opacity-80" href={r.linkedin_url} target="_blank" rel="noreferrer">
                                                {r.linkedin_url}
                                            </a>
                                        ) : (
                                            '—'
                                        )}
                                    </td>
                                    <td className="py-2 pr-4">{r.status || '—'}</td>
                                    <td className="py-2 pr-4 text-xs opacity-80">{r.reason || '—'}</td>
                                    <td className="py-2 pr-4">{r.provider || '—'}</td>
                                    {isAdmin && (
                                        <td className="py-2 pr-4 text-xs">
                                            {r.owner_email ? (
                                                <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 bg-white/5 border border-white/10">
                                                    Added by <span className="font-mono">{r.owner_email}</span>
                                                </span>
                                            ) : (
                                                '—'
                                            )}
                                        </td>
                                    )}
                                    <td className="py-2 pr-4">
                                        <button className="btn" onClick={() => validateRow(r.email)}>Validate</button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
