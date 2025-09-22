import React, { useState } from 'react'
import { validateOne } from '../api'

export default function ValidateSingle({ onAdded }: { onAdded: () => void }) {
  const [email, setEmail] = useState('')
  const [result, setResult] = useState<any>(null)
  const [busy, setBusy] = useState(false)
  const [useSmtp, setUseSmtp] = useState(false)

  const check = async () => {
    if (!email) return
    setBusy(true)
    try {
      const r = await validateOne(email, useSmtp)
      setResult(r); onAdded()
    } catch (e: any) {
      setResult({ error: e.message })
    } finally { setBusy(false) }
  }

  return (
    <div className="card">
      <h3>Validate Single Email</h3>
      <div className="row">
        <input className="input" placeholder="name@example.com" value={email} onChange={e => setEmail(e.target.value)} />
        <button className="btn" disabled={!email || busy} onClick={check}>Validate</button>
        <label><input type="checkbox" checked={useSmtp} onChange={e => setUseSmtp(e.target.checked)} /> Use SMTP probe</label>
      </div>
      {result && (
        <div style={{ marginTop: 10 }}>
          {result.error && <div className="tag invalid">Error: {result.error}</div>}
          {result.email && (
            <div>
              <strong>{result.email}</strong>
              <div>
                <span className={`tag ${result.status}`}>{result.status}</span>
                {result.reason && <span className="tag">{result.reason}</span>}
                {result.provider && <span className="tag">{result.provider}</span>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
