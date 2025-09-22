import React, { useEffect, useMemo, useState } from 'react'
import { createContact, getContacts } from '../api'

type Contact = {
    id: number
    first_name?: string | null
    last_name?: string | null
    email: string
    linkedin_url?: string | null
    status: string
    reason?: string | null
    provider?: string | null
}

const STATUS_OPTIONS = ['', 'new', 'valid', 'invalid', 'risky', 'unknown']

export default function ContactsPage() {
    const [list, setList] = useState<Contact[]>([])
    const [status, setStatus] = useState<string>('') // all
    const [q, setQ] = useState('')
    const [loading, setLoading] = useState(false)
    const [msg, setMsg] = useState('')

    // form
    const [firstName, setFirstName] = useState('')
    const [lastName, setLastName] = useState('')
    const [email, setEmail] = useState('')
    const [linkedin, setLinkedin] = useState('')

    const load = async () => {
        setLoading(true)
        try {
            const rows = await getContacts(status || undefined, q || undefined)
            setList(rows as Contact[])
        } catch (e: any) {
            setMsg(e.message || 'Failed to load contacts')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { load() /* on mount */ }, [])
    useEffect(() => { load() /* on filter/search change */ }, [status])

    const onSearch = async (e: React.FormEvent) => { e.preventDefault(); load() }

    const onCreate = async (e: React.FormEvent) => {
        e.preventDefault()
        setMsg('')
        if (!email.trim()) { setMsg('Email is required'); return }
        try {
            await createContact({
                first_name: firstName || undefined,
                last_name: lastName || undefined,
                email: email.trim(),
                linkedin_url: linkedin || undefined,
            })
            setFirstName(''); setLastName(''); setEmail(''); setLinkedin('')
            setMsg('Contact saved')
            await load()
        } catch (err: any) {
            setMsg(err.message || 'Failed to save contact')
        }
    }

    const rows = useMemo(() => list, [list])

    return (
        <>
            <div className="card">
                <h2>Contacts</h2>
                <p style={{ color: '#8aa0b6', marginTop: -10 }}>Create a contact and manage your list. Validation happens from the Validate page or via bulk validate.</p>
            </div>

            <div className="card" style={{ display: 'grid', gap: 12 }}>
                <h3 style={{ margin: 0 }}>Create Contact</h3>
                <form onSubmit={onCreate} className="row" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                    <input placeholder="First name" value={firstName} onChange={e => setFirstName(e.target.value)} />
                    <input placeholder="Last name" value={lastName} onChange={e => setLastName(e.target.value)} />
                    <input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
                    <input placeholder="LinkedIn URL" value={linkedin} onChange={e => setLinkedin(e.target.value)} />
                    <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 10, alignItems: 'center' }}>
                        <button className="btn" type="submit">Save</button>
                        {msg && <span style={{ color: '#8aa0b6' }}>{msg}</span>}
                    </div>
                </form>
            </div>

            <div className="card" style={{ display: 'grid', gap: 12 }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        <label>Filter by status:</label>
                        <select value={status} onChange={e => setStatus(e.target.value)}>
                            <option value="">all</option>
                            {STATUS_OPTIONS.slice(1).map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                    <form onSubmit={onSearch} style={{ display: 'flex', gap: 8 }}>
                        <input placeholder="Search name/email/linkedin..." value={q} onChange={e => setQ(e.target.value)} />
                        <button className="btn" type="submit">Search</button>
                        <button className="btn" type="button" onClick={load}>Refresh</button>
                    </form>
                </div>

                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr>
                                <th style={{ textAlign: 'left', padding: '8px 6px' }}>First</th>
                                <th style={{ textAlign: 'left', padding: '8px 6px' }}>Last</th>
                                <th style={{ textAlign: 'left', padding: '8px 6px' }}>Email</th>
                                <th style={{ textAlign: 'left', padding: '8px 6px' }}>LinkedIn</th>
                                <th style={{ textAlign: 'left', padding: '8px 6px' }}>Status</th>
                                <th style={{ textAlign: 'left', padding: '8px 6px' }}>Reason</th>
                                <th style={{ textAlign: 'left', padding: '8px 6px' }}>Provider</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading && (
                                <tr><td colSpan={7} style={{ padding: 12, color: '#8aa0b6' }}>Loading…</td></tr>
                            )}
                            {!loading && rows.length === 0 && (
                                <tr><td colSpan={7} style={{ padding: 12, color: '#8aa0b6' }}>No contacts</td></tr>
                            )}
                            {rows.map(r => (
                                <tr key={r.id} style={{ borderTop: '1px solid #253041' }}>
                                    <td style={{ padding: '8px 6px' }}>{r.first_name || ''}</td>
                                    <td style={{ padding: '8px 6px' }}>{r.last_name || ''}</td>
                                    <td style={{ padding: '8px 6px' }}>{r.email}</td>
                                    <td style={{ padding: '8px 6px' }}>
                                        {r.linkedin_url ? <a href={r.linkedin_url} target="_blank" rel="noreferrer">Profile</a> : ''}
                                    </td>
                                    <td style={{ padding: '8px 6px' }}>
                                        <span className={`pill ${r.status}`}>{r.status}</span>
                                    </td>
                                    <td style={{ padding: '8px 6px' }}>{r.reason || ''}</td>
                                    <td style={{ padding: '8px 6px' }}>{r.provider || ''}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    )
}
