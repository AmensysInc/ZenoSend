import React, { useState } from 'react'
import { uploadCsv, validateBulk } from '../api'

export default function UploadCSV({ onDone }: { onDone: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [log, setLog] = useState<string>('')

  const go = async () => {
    if (!file) return
    try {
      setBusy(true); setLog('Uploading...')
      const r1 = await uploadCsv(file)
      setLog(`Uploaded: inserted=${r1.inserted}, skipped=${r1.skipped}. Validating...`)
      const r2 = await validateBulk(false)
      setLog(`Validated: ${r2.validated}. Done.`)
      onDone()
    } catch (e: any) {
      setLog(e.message)
    } finally { setBusy(false) }
  }

  return (
    <div className="card">
      <h3>Upload CSV</h3>
      <p style={{ color: '#8aa0b6' }}>CSV headers supported: <code>first_name,last_name,email</code> (or single <code>email</code> column).</p>
      <input className="input" type="file" accept=".csv,text/csv" onChange={e => setFile(e.target.files?.[0] || null)} />
      <div className="row">
        <button className="btn" disabled={!file || busy} onClick={go}>Upload & Validate</button>
        <span style={{ color: '#8aa0b6' }}>{log}</span>
      </div>
    </div>
  )
}
