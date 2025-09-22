import React, { useState } from 'react'
import { createCampaign, sendSelected, stats } from '../api'

export default function CampaignForm({ selectedIds }: { selectedIds: number[] }) {
  const [name, setName] = useState('My Campaign')
  const [subject, setSubject] = useState('Hello from SendGrid-Lite')
  const [fromEmail, setFromEmail] = useState('rama.k@amensys.com')
  const [textBody, setTextBody] = useState('Hi there!')
  const [htmlBody, setHtmlBody] = useState('<h2>Hi there!</h2><p>This is a test.</p>')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string>('')

  const go = async () => {
    if (selectedIds.length === 0) { setMessage('Please select at least one contact.'); return; }
    try {
      setBusy(true); setMessage('Creating campaign...')
      const camp = await createCampaign({ name, subject, from_email: fromEmail, text_body: textBody, html_body: htmlBody })
      setMessage(`Campaign #${camp.id} created. Sending ${selectedIds.length} messages...`)
      const res = await sendSelected(camp.id, selectedIds)
      setMessage(`Enqueued: ${res.enqueued}. Checking stats...`)
      const s = await stats(camp.id)
      setMessage(`Queued: ${s.queued}, Sent: ${s.sent}, Failed: ${s.failed}`)
    } catch (e: any) {
      setMessage(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card">
      <h3>Send Campaign</h3>
      <div className="grid two">
        <div>
          <label>From</label>
          <input className="input" value={fromEmail} onChange={e => setFromEmail(e.target.value)} />
        </div>
        <div>
          <label>Subject</label>
          <input className="input" value={subject} onChange={e => setSubject(e.target.value)} />
        </div>
      </div>
      <div className="grid">
        <label>Plain Text</label>
        <textarea className="input" rows={3} value={textBody} onChange={e => setTextBody(e.target.value)} />
        <label>HTML Body</label>
        <textarea className="input" rows={6} value={htmlBody} onChange={e => setHtmlBody(e.target.value)} />
      </div>
      <div className="row" style={{ marginTop: 10 }}>
        <button className="btn" disabled={busy || selectedIds.length === 0} onClick={go}>Send to Selected</button>
        <span style={{ color: '#8aa0b6' }}>{message}</span>
      </div>
    </div>
  )
}
