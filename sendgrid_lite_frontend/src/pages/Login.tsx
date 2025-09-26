import React, { useState } from 'react';
import { useAuth } from '../auth';
import { useNavigate } from 'react-router-dom';

export default function LoginPage() {
    const { login } = useAuth();
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [err, setErr] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        setErr(null); setBusy(true);
        try {
            await login(email, password);
            navigate('/', { replace: true });   // ✅ router-aware redirect
        } catch (e: any) {
            setErr(e.message || 'Login failed');
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
            <form onSubmit={onSubmit} className="card w-full max-w-sm space-y-4 p-6">
                <h1 className="text-xl font-semibold">Sign in</h1>
                <label className="label"><span>Email</span>
                    <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
                </label>
                <label className="label"><span>Password</span>
                    <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
                </label>
                {err && <div style={{ color: '#f87171', fontSize: 12 }}>{err}</div>}
                <button className="btn" disabled={busy}>{busy ? 'Signing in...' : 'Sign in'}</button>
            </form>
        </div>
    );
}
