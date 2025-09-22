import React, { useEffect, useMemo, useState } from 'react'
import { composeSend, getContacts } from '../api'

type Contact = {
    id: number
    email: string
    first_name?: string | null
    last_name?: string | null
    status: string
    reason?: string | null
    provider?: string | null
}

export default function ComposeCampain() {
    const [contacts, setContacts] = useState<Contact[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const [fromEmail, setFromEmail] = useState('')
    const [subject, setSubject] = useState('')
    const [textBody, setTextBody] = useState('')
    const [htmlBody, setHtmlBody] = useState('')

    const [toIds, setToIds] = useState<number[]>([])
    const [ccIds, setCcIds] = useState<number[]>([])
    const [bccIds, setBccIds] = useState<number[]>([])

    const [toExtra, setToExtra] = useState('')
    const [ccExtra, setCcExtra] = useState('')
    const [bccExtra, setBccExtra] = useState('')
    const [validateExtras, setValidateExtras] = useState(true)

    const [result, setResult] = useState<string>('')

    useEffect(() => {
        (async () => {
            try {
                const rows = await getContacts('valid') as Contact[]
                setContacts(rows)
            } catch (e: any) {
                setError(e.message)
            } finally {
                setLoading(false)
            }
        })()
    }, [])

    const options = useMemo(() => contacts.map(c =>
        <option key={c.id} value={c.id}>{c.email}</option>
    ), [contacts])

    function selToIds(e: React.ChangeEvent<HTMLSelectElement>, setter: (ids: number[]) => void) {
        const ids = Array.from(e.target.selectedOptions).map(o => Number(o.value))
        setter(ids)
    }

    function parseExtras(s: string) {
        return s.split(/[,\s;]+/).map(x => x.trim()).filter(Boolean)
    }

    async function onSend(e: React.FormEvent) {
        e.preventDefault()
        setError(null); setResult('')
        try {
            if (!fromEmail || !subject) {
                setError('From and Subject are required'); return
            }
            const payload = {
                name: 'Quick Send',
                from_email: fromEmail,
                subject,
                text_body: textBody || undefined,
                html_body: htmlBody || undefined,
                to_ids: toIds,
                cc_ids: ccIds,
                bcc_ids: bccIds,
                to_extra: parseExtras(toExtra),
                cc_extra: parseExtras(ccExtra),
                bcc_extra: parseExtras(bccExtra),
                validate_extras: validateExtras,
            }
            const r = await composeSend(payload)
            setResult(`Campaign ${r.campaign_id} — selected: ${r.selected}, valid: ${r.valid_recipients}, enqueued: ${r.enqueued}`)
        } catch (e: any) {
            setError(e.message)
        }
    }

    if (loading) return <div className="card">Loading…</div>
    if (error) return <div className="card" style={{ color: '#ff6b6b' }}>Error: {error}</div>

    return (
        <div className="card" style={{ maxWidth: 1000 }}>
            <h2>Compose Campaign</h2>

            <form className="form" onSubmit={onSend} style={{ display: 'grid', gap: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <label className="label">
                        <span>From</span>
                        <input className="input" placeholder="you@company.com"
                            value={fromEmail} onChange={e => setFromEmail(e.target.value)} required />
                    </label>
                    <label className="label">
                        <span>Subject</span>
                        <input className="input" placeholder="Subject"
                            value={subject} onChange={e => setSubject(e.target.value)} required />
                    </label>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                    <label className="label">
                        <span>To (valid contacts)</span>
                        <select multiple className="input" style={{ height: 140 }}
                            value={toIds.map(String)} onChange={e => selToIds(e, setToIds)}>
                            {options}
                        </select>
                        <small>{toIds.length} selected</small>
                    </label>
                    <label className="label">
                        <span>CC (valid contacts)</span>
                        <select multiple className="input" style={{ height: 140 }}
                            value={ccIds.map(String)} onChange={e => selToIds(e, setCcIds)}>
                            {options}
                        </select>
                        <small>{ccIds.length} selected</small>
                    </label>
                    <label className="label">
                        <span>BCC (valid contacts)</span>
                        <select multiple className="input" style={{ height: 140 }}
                            value={bccIds.map(String)} onChange={e => selToIds(e, setBccIds)}>
                            {options}
                        </select>
                        <small>{bccIds.length} selected</small>
                    </label>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                    <label className="label">
                        <span>Add To (type emails)</span>
                        <input className="input" placeholder="a@x.com, b@x.com"
                            value={toExtra} onChange={e => setToExtra(e.target.value)} />
                    </label>
                    <label className="label">
                        <span>Add CC (type emails)</span>
                        <input className="input" placeholder="a@x.com b@x.com"
                            value={ccExtra} onChange={e => setCcExtra(e.target.value)} />
                    </label>
                    <label className="label">
                        <span>Add BCC (type emails)</span>
                        <input className="input" placeholder="a@x.com; b@x.com"
                            value={bccExtra} onChange={e => setBccExtra(e.target.value)} />
                    </label>
                </div>

                <label className="label" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <input type="checkbox" checked={validateExtras} onChange={e => setValidateExtras(e.target.checked)} />
                    <span>Validate typed emails before sending</span>
                </label>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <label className="label">
                        <span>Plain Text</span>
                        <textarea className="input" rows={8} value={textBody}
                            onChange={e => setTextBody(e.target.value)} placeholder="Hello ..." />
                    </label>
                    <label className="label">
                        <span>HTML (optional)</span>
                        <textarea className="input" rows={8} value={htmlBody}
                            onChange={e => setHtmlBody(e.target.value)} placeholder="<p>Hello</p>" />
                    </label>
                </div>

                <div>
                    <button type="submit" className="btn">Send</button>
                    {result && <span style={{ marginLeft: 12, color: '#8aa0b6' }}>{result}</span>}
                </div>
            </form>
        </div>
    )
}
